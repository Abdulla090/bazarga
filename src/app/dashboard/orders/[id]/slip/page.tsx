import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPackingSlip } from "@/server/services/orders";
import { currentLocale } from "@/server/locale";
import { env } from "@/server/env";
import { formatIQD } from "@/lib/money";
import { phoneDisplay } from "@/lib/phone";
import { PAYMENT_LABEL } from "@/lib/order-status";
import { trackingPath } from "@/lib/order-tracking";
import { qrMatrix, qrPath } from "@/lib/share-kit";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { ArrowBack } from "@/components/ui/icons";

export async function generateMetadata() {
  const t = await getTranslations("orders");
  return { title: t("packingSlip"), robots: { index: false } };
}

/**
 * Printable packing slip for one order of the seller's own store (A6/A5 friendly, no forced paper size).
 * Tenant-safe: the store comes from the session, an order of another store is a plain 404.
 * The tracking link is printed as text and as a QR code (uqr, server-only, so no client JS), so the courier or the
 * customer can scan it from the parcel.
 */
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { store } = await requireStore();
  const slip = await getPackingSlip(db(), store.id, id);
  if (!slip) notFound();
  const { order, items, codToCollect } = slip;

  const t = await getTranslations("orders");
  const tp = await getTranslations("payments");
  const tc = await getTranslations("common");
  const ts = await getTranslations("store");
  const locale = await currentLocale();
  const trackUrl = `${env().APP_URL.replace(/\/$/, "")}${trackingPath(slip.store.slug, order.number)}`;
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-IQ-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baghdad",
  }).format(order.createdAt);
  const storePhone = slip.store.phone || slip.store.whatsapp;
  const qr = qrMatrix(trackUrl);
  const qrSize = qr.size + 8; // 4-module quiet zone on each side

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/dashboard/orders/${order.id}`} className="me-auto inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-70">
          <ArrowBack /> {tc("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>
      <p className="text-sm text-ink-70 print:hidden">{t("slipHint")}</p>

      <article
        className="slip-sheet mx-auto grid w-full max-w-md gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 text-ink print:max-w-none print:rounded-none print:border-0 print:p-0"
        data-testid="packing-slip"
      >
        <header className="flex items-center gap-3 border-b border-line pb-3">
          {slip.store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slip.store.logoUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{slip.store.name}</p>
            {storePhone && <p className="num text-sm text-ink-70" dir="ltr">{phoneDisplay(storePhone)}</p>}
          </div>
          <div className="text-end">
            <p className="num text-xl font-extrabold" data-testid="slip-number">#{order.number}</p>
            <p className="num text-xs text-ink-70">{date}</p>
          </div>
        </header>

        <section className="grid gap-1" aria-label={t("slipDeliverTo")}>
          <h2 className="text-xs font-bold uppercase text-ink-50">{t("slipDeliverTo")}</h2>
          <p className="text-lg font-bold">{order.customerName}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            <dt className="font-semibold">{t("slipPhone")}</dt>
            <dd className="num font-semibold" dir="ltr">{phoneDisplay(order.customerPhone)}</dd>
            <dt className="font-semibold">{t("slipCity")}</dt>
            <dd>{order.cityName}</dd>
            {order.areaName && (<><dt className="font-semibold">{t("slipArea")}</dt><dd>{order.areaName}</dd></>)}
            {order.landmark && (<><dt className="font-semibold">{t("slipLandmark")}</dt><dd className="break-words">{order.landmark}</dd></>)}
            {order.address && (<><dt className="font-semibold">{t("address")}</dt><dd className="break-words">{order.address}</dd></>)}
          </dl>
        </section>

        <section className="border-t border-line pt-3" aria-label={t("items")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-50">
                <th className="pb-1 text-start font-semibold">{t("items")}</th>
                <th className="pb-1 text-center font-semibold">{t("slipQty")}</th>
                <th className="pb-1 text-end font-semibold">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-line align-top">
                  <td className="py-1 pe-2 break-words">
                    {i.name}
                    {i.variantTitle && <span className="text-ink-70"> · {i.variantTitle}</span>}
                    {i.sku && <span className="num block text-xs text-ink-50">{i.sku}</span>}
                  </td>
                  <td className="num py-1 text-center font-bold">{i.quantity}</td>
                  <td className="num py-1 text-end whitespace-nowrap">{formatIQD(i.lineTotal, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-2 grid grid-cols-2 gap-1 border-t border-line pt-2 text-sm">
            <dt>{t("subtotal")}</dt><dd className="num text-end">{formatIQD(order.subtotal, locale)}</dd>
            {order.discountAmount > 0 && (
              <>
                <dt>{ts("discount")}{order.discountCode && <span className="num"> · {order.discountCode}</span>}</dt>
                <dd className="num text-end">−{formatIQD(order.discountAmount, locale)}</dd>
              </>
            )}
            <dt>{t("deliveryFee")}</dt><dd className="num text-end">{formatIQD(order.deliveryFee, locale)}</dd>
            <dt className="font-bold">{t("total")}</dt><dd className="num text-end font-bold">{formatIQD(order.total, locale)}</dd>
            <dt>{t("payment")}</dt>
            <dd className="text-end">{order.paymentMethod === "cod" ? tp("cod") : PAYMENT_LABEL[order.paymentMethod]}</dd>
          </dl>
        </section>

        <section className="rounded-xl border-2 border-ink p-3 text-center" data-testid="slip-cod">
          {codToCollect > 0 ? (
            <>
              <p className="text-sm font-bold">{t("slipCollect")}</p>
              <p className="num text-2xl font-extrabold">{formatIQD(codToCollect, locale)}</p>
            </>
          ) : (
            <p className="text-base font-bold">{t("slipNothing")}</p>
          )}
        </section>

        {order.notes && (
          <section className="text-sm">
            <span className="font-semibold">{t("notes")}:</span> <span className="break-words">{order.notes}</span>
          </section>
        )}
        {(order.courierName || order.trackingNumber) && (
          <p className="text-sm">
            {order.courierName && <><span className="font-semibold">{t("courier")}:</span> {order.courierName} </>}
            {order.trackingNumber && <><span className="font-semibold">{t("tracking")}:</span> <span className="num" dir="ltr">{order.trackingNumber}</span></>}
          </p>
        )}

        <footer className="flex items-center gap-3 border-t border-line pt-2 text-xs">
          <svg
            viewBox={`0 0 ${qrSize} ${qrSize}`}
            width={88}
            height={88}
            shapeRendering="crispEdges"
            role="img"
            aria-label={t("slipScan")}
            className="shrink-0"
            data-testid="slip-qr"
          >
            <rect width={qrSize} height={qrSize} fill="#ffffff" />
            <path fill="#000000" d={qrPath(qr, 4)} />
          </svg>
          <div className="min-w-0">
            <p className="font-semibold">{t("slipTrack")}</p>
            <p className="text-ink-70">{t("slipScan")}</p>
            <p className="num break-all text-ink-70" dir="ltr" data-testid="slip-track-url">{trackUrl}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
