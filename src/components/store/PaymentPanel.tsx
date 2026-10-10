"use client";
import type { PaymentPanelLabels } from "./cart-labels";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshPaymentAction, retryPaymentAction } from "@/server/actions/storefront";


type Props = {
  /** Translated on the server (storefronts ship no i18n runtime). */
  labels: PaymentPanelLabels;
  slug: string;
  publicId: string;
  method: string;
  status: string;
  fib?: { qrCode: string | null; readableCode: string | null; appLink: string | null } | null;
};

export function PaymentPanel({ labels: L, slug, publicId, method, status, fib }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  if (method === "cod") return null;
  if (status === "paid") return <p className="rounded-2xl border border-st-border px-5 py-4 text-center font-medium">{L.paid}</p>;

  const check = () =>
    start(async () => {
      const r = await refreshPaymentAction(slug, publicId);
      setErr(!r.ok);
      router.refresh();
    });
  const retry = () =>
    start(async () => {
      const r = await retryPaymentAction(slug, publicId);
      if (r.external && r.redirectTo) window.location.assign(r.redirectTo);
      else router.refresh();
    });

  return (
    <div className="grid gap-4 rounded-2xl border border-st-border bg-st-surface p-5 sm:p-6">
      {method === "fib" && fib && status === "pending" && (
        <>
          <h2 className="display text-[22px]">{L.fibTitle}</h2>
          {fib.qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fib.qrCode} alt="FIB QR" className="mx-auto h-48 w-48" />
          )}
          {fib.readableCode && (
            <p className="text-center text-sm">
              {L.fibScan} <strong className="num block text-xl tracking-widest" dir="ltr">{fib.readableCode}</strong>
            </p>
          )}
          {fib.appLink && <a className="btn-gold min-h-12" href={fib.appLink}>{L.openFib}</a>}
        </>
      )}
      {status === "pending" && <p className="text-center text-sm text-muted">{L.payPending}</p>}
      {(status === "failed" || (status === "pending" && !fib && method === "fib") || err) && <p className="text-sm font-medium text-danger">{L.paymentFailed}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "pending" && <button type="button" className="btn-gold btn-sm flex-1" disabled={pending} onClick={check}>{L.checkStatus}</button>}
        <button type="button" className="btn-ghost btn-sm flex-1" disabled={pending} onClick={retry}>{L.retryPayment}</button>
      </div>
    </div>
  );
}
