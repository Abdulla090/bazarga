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
import { orderSummaryText, waLink } from "@/lib/whatsapp";
import { PaymentPanel } from "@/components/store/PaymentPanel";
import { CircleCheck, Icon, MessageCircle } from "@/components/ui/icons";

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
      customerName: order.customerName,
      cityName: order.cityName,
      address: order.address,
      paymentLabel,
    },
    locale,
  );

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <div className="card text-center">
        <Icon as={CircleCheck} className="text-5xl text-green" />
        <h1 className="mt-2 text-2xl font-extrabold">{t("orderReceived")}</h1>
        <p className="num mt-1 text-lg font-bold">{t("orderNumber", { number: order.number })}</p>
        <p className="mt-2 text-ink-70">{t("orderThanks", { name: order.customerName })}</p>
      </div>

      <PaymentPanel slug={store.slug} publicId={order.publicId} method={order.paymentMethod} status={order.paymentStatus} fib={fib} />

      {sellerPhone && (
        <a href={waLink(sellerPhone, message)} target="_blank" rel="noopener noreferrer" className="btn min-h-14 bg-whatsapp text-ink hover:brightness-95">
          <Icon as={MessageCircle} /> {t("messageSeller")}
        </a>
      )}

      <div className="card">
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2 py-2">
              <span>{i.name} <span className="num text-ink-70">×{i.quantity}</span></span>
              <span className="num">{formatIQD(i.lineTotal, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid grid-cols-2 gap-1 border-t border-line pt-2">
          <dt>{t("subtotal")}</dt><dd className="num text-end">{formatIQD(order.subtotal, locale)}</dd>
          <dt>{t("delivery")} · {order.cityName}</dt><dd className="num text-end">{formatIQD(order.deliveryFee, locale)}</dd>
          <dt className="font-extrabold">{t("total")}</dt><dd className="num text-end font-extrabold">{formatIQD(order.total, locale)}</dd>
          <dt>{t("payment")}</dt><dd className="text-end">{paymentLabel}</dd>
        </dl>
      </div>
      <Link href={`/s/${store.slug}`} className="btn-ghost">{t("backToStore")}</Link>
    </div>
  );
}
