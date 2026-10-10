import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { loadStore } from "../../data";
import { db } from "@/server/db";
import { getOrderByPublicId } from "@/server/services/orders";
import { latestPaymentForOrder } from "@/server/payments/service";
import { currentLocale } from "@/server/locale";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL } from "@/lib/order-status";
import { fullAddress, orderSummaryText, waLink } from "@/lib/whatsapp";
import { trackingPath } from "@/lib/order-tracking";
import { env } from "@/server/env";
import dynamic from "next/dynamic";

// Only online-payment orders need it (COD renders nothing): split so cash orders never download its code.
const PaymentPanel = dynamic(() => import("@/components/store/PaymentPanel").then((m) => m.PaymentPanel));
import { PAYMENT_PANEL_KEYS } from "@/components/store/cart-labels";
import { pickLabels } from "@/lib/fmt";
import { Check, Icon, MessageCircle, Truck } from "@/components/ui/icons";

// Always fresh: reads the order directly (never through the storefront cache).
export const metadata: Metadata = { robots: { index: false } };

export default async function OrderConfirmationPage({ params }: { params: Promise<{ slug: string; publicId: string }> }) {
  const { slug, publicId } = await params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(publicId)) notFound();
  const store = await loadStore(slug);
  const order = await getOrderByPublicId(db(), store.id, publicId);
  if (!order) notFound();
  const t = await getTranslations("store");
  const tp = await getTranslations("payments");
  const locale = await currentLocale();
  const paymentLabel = order.paymentMethod === "cod" ? tp("cod") : PAYMENT_LABEL[order.paymentMethod];

  let fib: { qrCode: string | null; readableCode: string | null; appLink: string | null } | null = null;
  if (order.paymentMethod === "fib") {
    const tx = await latestPaymentForOrder(db(), order.id);
    const init = (tx?.raw as { init?: { qrCode?: string; readableCode?: string; appLinks?: { personal?: string } } } | undefined)?.init;
    if (init) fib = { qrCode: init.qrCode ?? null, readableCode: init.readableCode ?? null, appLink: init.appLinks?.personal ?? null };
  }

  const sellerPhone = store.whatsapp ?? store.phone;
  const message = orderSummaryText(
    {
      storeName: store.name,
      orderNumber: order.number,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      discountCode: order.discountCode,
      discountAmount: order.discountAmount,
      customerName: order.customerName,
      cityName: order.cityName,
      address: fullAddress(order),
      paymentLabel,
      trackUrl: `${env().APP_URL.replace(/\/$/, "")}${trackingPath(store.slug, order.number)}`,
    },
    locale,
  );

  return (
    <div className="mx-auto grid max-w-xl gap-8">
      <div className="grid justify-items-center gap-3 pt-4 text-center sm:pt-8">
        <span className="order-success-ring grid size-14 place-items-center rounded-full bg-st-fg text-st-bg"><Icon as={Check} className="h-7 w-7" /></span>
        <h1 className="display mt-2 text-[28px] sm:text-[40px]">{t("orderReceived")}</h1>
        <p className="num text-sm font-medium text-muted"><bdi>{t("orderNumber", { number: order.number })}</bdi></p>
        <p className="max-w-sm text-[15px] text-muted">{t("orderThanks", { name: order.customerName })}</p>
      </div>

      {order.paymentMethod !== "cod" && <PaymentPanel labels={pickLabels((k) => t(k), PAYMENT_PANEL_KEYS)} slug={store.slug} publicId={order.publicId} method={order.paymentMethod} status={order.paymentStatus} fib={fib} />}

      <div className="grid gap-2">
        <Link href={trackingPath(store.slug, order.number)} className="btn-gold min-h-12" data-testid="track-link">
          <Icon as={Truck} /> {t("trackOrder")}
        </Link>
        {sellerPhone && (
          <a href={waLink(sellerPhone, message)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-12">
            <Icon as={MessageCircle} /> {t("messageSeller")}
          </a>
        )}
      </div>

      <section className="rounded-2xl border border-st-border bg-st-surface p-5 sm:p-6">
        <ul className="divide-y divide-st-border">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-3 text-[15px] first:pt-0">
              <span className="min-w-0">{i.name}{i.variantTitle && <span className="text-muted"> · {i.variantTitle}</span>} <span className="num text-muted">×{i.quantity}</span></span>
              <span className="num shrink-0">{formatIQD(i.lineTotal, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 border-t border-st-border pt-4 text-sm">
          <dt className="text-muted">{t("subtotal")}</dt><dd className="num text-end">{formatIQD(order.subtotal, locale)}</dd>
          {order.discountAmount > 0 && (
            <>
              <dt className="text-muted">{t("discount")}{order.discountCode && <span className="num"> · {order.discountCode}</span>}</dt><dd className="num text-end">−{formatIQD(order.discountAmount, locale)}</dd>
            </>
          )}
          <dt className="text-muted">{t("delivery")} · {order.cityName}</dt><dd className="num text-end">{formatIQD(order.deliveryFee, locale)}</dd>
          <dt className="text-muted">{t("payment")}</dt><dd className="text-end">{paymentLabel}</dd>
          <dt className="mt-2 border-t border-st-border pt-3 text-base font-medium">{t("total")}</dt><dd className="num mt-2 border-t border-st-border pt-3 text-end text-base font-medium">{formatIQD(order.total, locale)}</dd>
        </dl>
      </section>
      <Link href={`/s/${store.slug}`} className="mx-auto inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-st-accent">{t("backToStore")}</Link>
    </div>
  );
}
