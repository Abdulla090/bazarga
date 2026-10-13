import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/server/db";
import { gateway } from "@/server/payments/gateway/registry";
import { publicPaymentView } from "@/server/payments/gateway/service";
import { PaymentReturnStatus, type ReturnLabels } from "@/components/payments/PaymentReturnStatus";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { robots: { index: false }, title: "Payment" };

/**
 * Where the hosted payment page sends people back (GET /payments/return?p=<payment id>). Shows what the PROVIDER
 * says (polled server-side), never what the redirect claims. 404 while PAYMENTS_PROVIDER is none.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  if (!gateway()) notFound();
  const id = z.uuid().safeParse((await searchParams).p);
  if (!id.success) notFound();
  const view = await publicPaymentView(db(), id.data);
  if (!view) notFound();
  const t = await getTranslations("gatewayPay");
  const keys = ["checking", "paid", "failed", "expired", "refunded", "pendingLong", "continue", "tryAgain"] as const;
  const labels = Object.fromEntries(keys.map((k) => [k, t(k)])) as ReturnLabels;
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-md content-center gap-10 px-5 py-12">
      <div className="flex justify-center"><Logo /></div>
      <section className="rounded-3xl border border-line bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-sm font-medium uppercase tracking-wide text-ink-70">{t("returnTitle")}</h1>
        <PaymentReturnStatus paymentId={view.id} initial={view.status} next={view.next} labels={labels} />
      </section>
    </main>
  );
}
