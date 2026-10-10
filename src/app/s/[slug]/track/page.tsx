import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { loadStore } from "../data";
import { db } from "@/server/db";
import { getTrackedOrder, type TrackedOrder } from "@/server/services/tracking";
import { trackOrderAction } from "@/server/actions/storefront";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL } from "@/lib/order-status";
import { buildTrackingTimeline, parseOrderNumber, TRACK_COOKIE, type TimelineStep } from "@/lib/order-tracking";
import { waLink } from "@/lib/whatsapp";
import type { Locale } from "@/lib/i18n";
import { Check, Icon, MessageCircle, Package, Truck, X, Clock } from "@/components/ui/icons";

// Always fresh and never indexed: reads the order directly (not through the storefront cache).
export const metadata: Metadata = { robots: { index: false } };

type Search = { n?: string | string[]; e?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function dateFmt(locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" });
}

export default async function TrackOrderPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await loadStore(slug);
  const t = await getTranslations("track");
  const ts = await getTranslations("store");
  const tp = await getTranslations("payments");
  const locale = await currentLocale();

  const error = one(sp.e);
  const prefill = parseOrderNumber(one(sp.n) ?? "");
  // A successful lookup leaves the order's public id in an httpOnly cookie (see trackOrderAction); it only
  // resolves for this store, so a cookie from another store's lookup is simply ignored.
  const publicId = error ? undefined : (await cookies()).get(TRACK_COOKIE)?.value;
  const order = publicId ? await getTrackedOrder(db(), store.id, publicId) : null;
  const sellerPhone = store.whatsapp ?? store.phone;

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      {order ? (
        <TrackedOrderView order={order} storeName={store.name} sellerPhone={sellerPhone} locale={locale} t={t} ts={ts} tp={tp} />
      ) : (
        <h1 className="display pt-2 text-[28px] sm:pt-6 sm:text-[40px]">{t("title")}</h1>
      )}

      <form action={trackOrderAction} className="grid gap-4 rounded-2xl border border-st-border bg-st-surface p-5 sm:p-6" data-testid="track-form">
        {order ? <h2 className="display text-[22px]">{t("another")}</h2> : <p className="text-[15px] text-muted">{t("intro")}</p>}
        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 px-4 py-3 text-sm font-medium text-danger" data-testid="track-error">
            {error === "rl" ? t("rateLimited") : t("notFound")}
          </p>
        )}
        <input type="hidden" name="slug" value={store.slug} />
        <div>
          <label htmlFor="trk-number" className="label">{t("orderNumber")}</label>
          <input
            id="trk-number"
            name="number"
            className="input num"
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={order ? "" : (prefill ?? "")}
            aria-describedby="trk-number-hint"
            maxLength={20}
            required
          />
          <p id="trk-number-hint" className="hint">{t("orderNumberHint")}</p>
        </div>
        <div>
          <label htmlFor="trk-phone" className="label">{t("phone")}</label>
          <input
            id="trk-phone"
            name="phone"
            className="input num"
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07XX XXX XXXX"
            aria-describedby="trk-phone-hint"
            maxLength={20}
            required
          />
          <p id="trk-phone-hint" className="hint">{t("phoneHint")}</p>
        </div>
        <button type="submit" className="btn-gold min-h-12 w-full">{t("submit")}</button>
      </form>

      <Link href={`/s/${store.slug}`} className="mx-auto inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-st-accent">{ts("backToStore")}</Link>
    </div>
  );
}

type Tr = Awaited<ReturnType<typeof getTranslations>>;

function TrackedOrderView({
  order,
  storeName,
  sellerPhone,
  locale,
  t,
  ts,
  tp,
}: {
  order: TrackedOrder;
  storeName: string;
  sellerPhone: string | null;
  locale: Locale;
  t: Tr;
  ts: Tr;
  tp: Tr;
}) {
  const fmt = dateFmt(locale);
  const steps = buildTrackingTimeline(order.status, order.events);
  const current = steps.find((s) => s.state === "current") ?? steps.at(-1)!;
  const paymentLabel = order.paymentMethod === "cod" ? tp("cod") : PAYMENT_LABEL[order.paymentMethod];
  return (
    <>
      <section className="grid gap-1 pt-2 sm:pt-6" data-testid="track-result" aria-labelledby="trk-title">
        <h1 id="trk-title" className="display num text-[28px] sm:text-[40px]"><bdi>{ts("orderNumber", { number: order.number })}</bdi></h1>
        <p className="text-sm text-muted">{t("placedOn", { date: fmt.format(order.createdAt) })}</p>
        <p className="mt-5 text-[13px] font-medium text-muted">{t("statusNow")}</p>
        <p className={`text-xl font-medium ${toneText(current)}`} data-testid="track-status">{t(`step_${current.status}`)}</p>
      </section>

      <section className="rounded-2xl border border-st-border bg-st-surface p-5 sm:p-6" aria-labelledby="trk-timeline">
        <h2 id="trk-timeline" className="mb-4 text-[13px] font-medium text-muted">{t("timeline")}</h2>
        <ol className="grid" data-testid="track-timeline">
          {steps.map((s, i) => (
            <li key={`${s.status}-${i}`} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
              {i < steps.length - 1 && (
                <span aria-hidden className={`absolute start-[0.9375rem] top-8 bottom-0 w-0.5 ${s.state === "done" ? "bg-st-fg" : "bg-st-border"}`} />
              )}
              <span aria-hidden className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${dotClass(s)}`}>
                <Icon as={stepIcon(s)} className="text-base" />
              </span>
              <div className="min-w-0 pt-1">
                <p className={`font-medium ${s.state === "upcoming" ? "text-faint" : toneText(s)}`}>{t(`step_${s.status}`)}</p>
                {s.at && <p className="num text-sm text-muted">{fmt.format(s.at)}</p>}
                {s.status === "shipped" && s.state !== "upcoming" && (order.courierName || order.trackingNumber) && (
                  <p className="text-sm text-muted">
                    {order.courierName && <>{t("courier")}: <bdi>{order.courierName}</bdi></>}
                    {order.courierName && order.trackingNumber && " · "}
                    {order.trackingNumber && <>{t("trackingNumber")}: <bdi className="num">{order.trackingNumber}</bdi></>}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {sellerPhone && (
        <a
          href={waLink(sellerPhone, t("waAbout", { store: storeName, number: order.number }))}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost min-h-12"
          data-testid="track-whatsapp"
        >
          <Icon as={MessageCircle} /> {t("askStore")}
        </a>
      )}

      <section className="rounded-2xl border border-st-border bg-st-surface p-5 sm:p-6" aria-labelledby="trk-items">
        <h2 id="trk-items" className="mb-1 text-[13px] font-medium text-muted">{t("items")}</h2>
        <ul className="divide-y divide-st-border">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-3 text-[15px]">
              <span className="min-w-0 break-words">
                {i.name}
                {i.variantTitle && <span className="text-muted"> · {i.variantTitle}</span>} <span className="num text-muted">×{i.quantity}</span>
              </span>
              <span className="num shrink-0">{formatIQD(i.lineTotal, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t border-st-border pt-3 text-sm">
          <dt>{ts("subtotal")}</dt>
          <dd className="num text-end">{formatIQD(order.subtotal, locale)}</dd>
          {order.discountAmount > 0 && (
            <>
              <dt>{ts("discount")}{order.discountCode && <span className="num"> · {order.discountCode}</span>}</dt>
              <dd className="num text-end">−{formatIQD(order.discountAmount, locale)}</dd>
            </>
          )}
          <dt>{ts("delivery")} · {order.cityName}</dt>
          <dd className="num text-end">{formatIQD(order.deliveryFee, locale)}</dd>
          <dt className="font-medium">{ts("total")}</dt>
          <dd className="num text-end font-medium">{formatIQD(order.total, locale)}</dd>
        </dl>
        <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t border-st-border pt-3 text-sm text-sm">
          <dt className="text-muted">{t("deliveryArea")}</dt>
          <dd className="text-end" data-testid="track-area">{[order.cityName, order.areaName].filter(Boolean).join(" · ")}</dd>
          <dt className="text-muted">{ts("payment")}</dt>
          <dd className="text-end">{paymentLabel}</dd>
          <dt className="text-muted">{t("paymentStatus")}</dt>
          <dd className="text-end">{t(`pay_${order.paymentStatus}`)}</dd>
        </dl>
      </section>
    </>
  );
}

function stepIcon(s: TimelineStep) {
  if (s.tone === "bad") return X;
  if (s.tone === "warn") return Clock;
  if (s.state === "done") return Check;
  return s.status === "shipped" ? Truck : Package;
}

function dotClass(s: TimelineStep) {
  // Monochrome timeline: done = ink fill, current = ink ring, upcoming = hairline; problems (refused/cancelled) ink too,
  // told apart by their icon and label rather than colour.
  if (s.tone === "bad" || s.tone === "warn") return "border-st-fg bg-st-surface text-st-fg";
  if (s.state === "done") return "border-st-fg bg-st-fg text-st-bg";
  if (s.state === "current") return "border-st-fg bg-st-surface text-st-fg ring-2 ring-st-fg/15";
  return "border-st-border bg-st-surface text-faint";
}

function toneText(s: TimelineStep) {
  void s;
  return "text-st-fg";
}
