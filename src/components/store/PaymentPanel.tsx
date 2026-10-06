"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { refreshPaymentAction, retryPaymentAction } from "@/server/actions/storefront";

type Props = {
  slug: string;
  publicId: string;
  method: string;
  status: string;
  fib?: { qrCode: string | null; readableCode: string | null; appLink: string | null } | null;
};

export function PaymentPanel({ slug, publicId, method, status, fib }: Props) {
  const t = useTranslations("store");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  if (method === "cod") return null;
  if (status === "paid") return <p className="rounded-xl bg-green/10 px-3 py-2 font-bold text-green">{t("paid")}</p>;

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
    <div className="card grid gap-3">
      {method === "fib" && fib && status === "pending" && (
        <>
          <h2 className="text-lg font-bold">{t("fibTitle")}</h2>
          {fib.qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fib.qrCode} alt="FIB QR" className="mx-auto h-48 w-48" />
          )}
          {fib.readableCode && (
            <p className="text-center text-sm">
              {t("fibScan")} <strong className="num block text-xl tracking-widest" dir="ltr">{fib.readableCode}</strong>
            </p>
          )}
          {fib.appLink && <a className="btn-ink" href={fib.appLink}>{t("openFib")}</a>}
        </>
      )}
      {status === "pending" && <p className="text-center text-ink-70">{t("payPending")}</p>}
      {(status === "failed" || (status === "pending" && !fib && method === "fib") || err) && <p className="text-danger">{t("paymentFailed")}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "pending" && <button type="button" className="btn-gold btn-sm" disabled={pending} onClick={check}>{t("checkStatus")}</button>}
        <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={retry}>{t("retryPayment")}</button>
      </div>
    </div>
  );
}
