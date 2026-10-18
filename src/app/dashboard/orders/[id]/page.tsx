import { mapsLink } from "@/lib/maps";
import { parseSource, SOURCE_COLOR, SOURCE_LABEL } from "@/lib/social";
import Link from "next/link";
import { phoneDisplay } from "@/lib/phone";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { getOrder } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL } from "@/lib/order-status";
import { fullAddress, waLink } from "@/lib/whatsapp";
import { PaymentBadge, StatusBadge } from "@/components/dashboard/Badges";
import { StatusActions } from "./StatusActions";
import { ArrowBack, Icon, Printer } from "@/components/ui/icons";
import { CopyButton } from "@/components/CopyButton";
import { waTemplateLink, WA_TEMPLATE_KINDS } from "@/lib/wa-templates";
import { trackingPath } from "@/lib/order-tracking";
import { env } from "@/server/env";
import { isPhoneBlocked } from "@/server/services/blocklist";
import { knownRiskFlags } from "@/lib/order-risk";
import { BlockToggle } from "@/components/dashboard/BlockPhoneForms";
import { CheckPaymentButton } from "@/components/dashboard/CheckPaymentButton";
import { quickReplyLink, QUICK_REPLY_KINDS, type QuickReplyKind } from "@/lib/quick-replies";
import { payReminderLink } from "@/lib/pay-reminder";
import { listPaymentAttempts } from "@/server/payments/service";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { store } = await requireStore();
  const order = await getOrder(db(), store.id, id);
  if (!order) notFound();
  const t = await getTranslations("orders");
  const tp = await getTranslations("payments");
  const tc = await getTranslations("common");
  const ts = await getTranslations("store");
  const tr = await getTranslations("risk");
  const flags = knownRiskFlags(order.riskFlags);
  const sourceKey = parseSource(order.source);
  const online = order.paymentMethod !== "cod";
  const [blocked, attempts, tps] = await Promise.all([
    isPhoneBlocked(db(), store.id, order.customerPhone),
    online ? listPaymentAttempts(db(), store.id, order.id) : Promise.resolve([]),
    getTranslations("payStatus"),
  ]);
  const locale = await currentLocale();
  const trackUrl = `${env().APP_URL.replace(/\/$/, "")}${trackingPath(store.slug, order.number)}`;
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <Link href="/dashboard/orders" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-ink-70"><ArrowBack /> {tc("back")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline">{t("order", { number: order.number })}</h1>
        <StatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} />
        {sourceKey && (
          <span className="chip border border-line bg-white text-ink" data-testid="order-source" data-source={sourceKey}>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SOURCE_COLOR[sourceKey] }} />
            {t("fromSource", { source: SOURCE_LABEL[sourceKey] })}
          </span>
        )}
      </div>
      {(flags.length > 0 || blocked) && (
        <section className="grid gap-2 border-y border-ink py-5" aria-labelledby="risk-title" data-testid="order-risk">
          <h2 id="risk-title" className="font-bold">{tr("title")}</h2>
          {flags.length > 0 && (
            <>
              <p className="text-sm text-ink-70">{tr("hint")}</p>
              <ul className="list-disc ps-5 text-sm">
                {flags.map((f) => <li key={f} data-risk={f}>{tr(`flag_${f}`)}</li>)}
              </ul>
            </>
          )}
          {blocked && <p className="text-sm font-semibold text-danger">{tr("blocked")}</p>}
        </section>
      )}
      <StatusActions
        orderId={order.id}
        number={order.number}
        status={order.status}
        courierName={order.courierName}
        trackingNumber={order.trackingNumber}
      />
      {online && (
        <section className="grid gap-3 border-t border-line pt-6" aria-labelledby="pay-title" data-testid="order-payment">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pay-title" className="font-bold">{tps("title")} · {PAYMENT_LABEL[order.paymentMethod]}</h2>
            <PaymentBadge status={order.paymentStatus} />
          </div>
          {order.expiredAt && order.paymentStatus !== "paid" && (
            <p className="text-sm font-semibold text-ink-70" data-testid="order-expired">{tps("expired", { minutes: env().PAYMENT_ORDER_TTL_MINUTES })}</p>
          )}
          {order.status === "cancelled" && order.paymentStatus === "paid" && (
            <p className="border-s-2 border-ink ps-3 text-sm font-semibold" data-testid="paid-after-expiry">{tps("paidAfterExpiry")}</p>
          )}
          {attempts.length === 0 ? (
            <p className="text-sm text-ink-70">{tps("noAttempts")}</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1" data-attempt-status={a.status}>
                  <PaymentBadge status={a.status} />
                  <span className="num text-ink-70" dir="ltr">{tps("ref")}: {a.providerRef.slice(0, 18)}</span>
                  <span className="num text-ink-50">{fmt.format(a.createdAt)}</span>
                  <span className="text-ink-50">{a.lastCheckedAt ? tps("checked", { time: fmt.format(a.lastCheckedAt) }) : tps("neverChecked")}</span>
                </li>
              ))}
            </ul>
          )}
          {attempts.length > 0 && order.paymentStatus !== "paid" && <CheckPaymentButton orderId={order.id} />}
          {order.paymentStatus !== "paid" && order.status !== "cancelled" && (() => {
            const href = payReminderLink({ storeName: store.name, orderNumber: order.number, total: order.total, customerPhone: order.customerPhone, payUrl: trackUrl }, locale);
            return href ? <a className="btn-ghost btn-sm w-fit" href={href} target="_blank" rel="noopener noreferrer" data-testid="remind-pay">{tps("remind")}</a> : null;
          })()}
          <p className="text-xs text-ink-50">{tps("auto")}</p>
        </section>
      )}
      {order.status !== "cancelled" && order.customerPhone.replace(/\D/g, "") && (
        <section className="grid gap-3 border-t border-line pt-6" aria-label={t("quickReplies")}>
          <h2 className="text-sm font-semibold">{t("quickReplies")}</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLY_KINDS.map((k: QuickReplyKind) => {
              const href = quickReplyLink(k, { storeName: store.name, orderNumber: order.number, total: order.total, customerPhone: order.customerPhone }, locale);
              const label = { confirmed: t("qrConfirmed"), onTheWay: t("qrOnTheWay"), needLandmark: t("qrNeedLandmark") }[k];
              return href ? <a key={k} className="btn-ghost btn-sm" href={href} target="_blank" rel="noopener noreferrer" data-testid={`quick-reply-${k}`}>{label}</a> : null;
            })}
          </div>
        </section>
      )}
      {order.status !== "cancelled" && order.customerPhone.replace(/\D/g, "") && (
        <section className="grid gap-3 border-t border-line pt-6" aria-label={t("waTemplates.title")} data-testid="wa-templates">
          <h2 className="text-sm font-semibold">{t("waTemplates.title")}</h2>
          <div className="flex flex-wrap gap-2">
            {WA_TEMPLATE_KINDS.map((k) => {
              const href = waTemplateLink(k, { storeName: store.name, orderNumber: order.number, total: order.total, customerPhone: order.customerPhone, trackingNumber: order.trackingNumber, trackUrl }, locale);
              return href ? <a key={k} className="btn-ghost btn-sm min-h-11" href={href} target="_blank" rel="noopener noreferrer" data-testid={`wa-template-${k}`}>{t(`waTemplates.${k}`)}</a> : null;
            })}
          </div>
        </section>
      )}
      <section className="grid gap-3 border-t border-line pt-6" aria-label={t("copyTrackingLink")}>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={trackUrl} label={t("copyTrackingLink")} className="btn-ink" testId="copy-tracking-link" />
          <Link href={`/dashboard/orders/${order.id}/slip`} className="btn-ghost" data-testid="packing-slip-link">
            <Icon as={Printer} /> {t("packingSlip")}
          </Link>
        </div>
        <p className="text-sm text-ink-70">{t("trackingLinkHint")}</p>
        <p className="num break-all text-sm text-ink-50" dir="ltr">{trackUrl}</p>
      </section>
      {(order.courierName || order.trackingNumber) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-line pt-6" data-testid="order-courier">
          {order.courierName && (<><dt className="font-semibold">{t("courier")}</dt><dd>{order.courierName}</dd></>)}
          {order.trackingNumber && (<><dt className="font-semibold">{t("tracking")}</dt><dd className="num" dir="ltr">{order.trackingNumber}</dd></>)}
        </dl>
      )}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-12">
        <section className="grid gap-3 border-t border-line pt-6">
          <h2 className="font-bold">{t("customer")}</h2>
          <p className="text-lg font-semibold">{order.customerName}</p>
          <p className="num" dir="ltr">{phoneDisplay(order.customerPhone)}</p>
          <p><span className="font-semibold">{t("address")}:</span> {order.cityName} — {fullAddress(order)}</p>
          {order.notes && <p><span className="font-semibold">{t("notes")}:</span> {order.notes}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn-ink btn-sm" href={waLink(order.customerPhone, `${store.name} — #${order.number}\n${t("slipTrack")}: ${trackUrl}`)} target="_blank" rel="noopener noreferrer">{t("whatsappCustomer")}</a>
            <a className="btn-ghost btn-sm" href={`tel:${phoneDisplay(order.customerPhone)}`}>{t("call")}</a>
            <a className="btn-ghost btn-sm" href={mapsLink(order.cityName, fullAddress(order))} target="_blank" rel="noopener noreferrer" data-testid="order-map-link">{t("openMap")}</a>
          </div>
          <BlockToggle phone={order.customerPhone} phoneLabel={phoneDisplay(order.customerPhone)} orderId={order.id} blocked={blocked} />
        </section>
        <section className="border-t border-line pt-6">
          <h2 className="mb-2 font-bold">{t("items")}</h2>
          <ul className="divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 py-2">
                <span>{i.name}{i.variantTitle && <span className="text-ink-70"> · {i.variantTitle}</span>}{i.sku && <span className="num text-xs text-ink-50"> {i.sku}</span>} <span className="num text-ink-70">×{i.quantity}</span></span>
                <span className="num">{formatIQD(i.lineTotal, locale)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-2 gap-1 border-t border-line pt-3">
            <dt>{t("subtotal")}</dt><dd className="num text-end">{formatIQD(order.subtotal, locale)}</dd>
            {order.discountAmount > 0 && (
              <>
                <dt>{ts("discount")}{order.discountCode && <span className="num"> · {order.discountCode}</span>}</dt><dd className="num text-end">−{formatIQD(order.discountAmount, locale)}</dd>
              </>
            )}
            <dt>{t("deliveryFee")}</dt><dd className="num text-end">{formatIQD(order.deliveryFee, locale)}</dd>
            <dt className="font-bold">{t("total")}</dt><dd className="num text-end font-bold">{formatIQD(order.total, locale)}</dd>
            <dt>{t("payment")}</dt><dd className="text-end">{order.paymentMethod === "cod" ? tp("cod") : PAYMENT_LABEL[order.paymentMethod]}</dd>
          </dl>
        </section>
      </div>
      <section className="border-t border-line pt-6">
        <h2 className="mb-2 font-bold">{t("history")}</h2>
        <ol className="grid gap-1 text-sm">
          {order.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="num text-ink-50">{fmt.format(e.createdAt)}</span>
              <span>
                {t(`status_${e.toStatus}`)}
                {e.note && <span className="text-ink-70"> — {e.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
