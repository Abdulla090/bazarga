"use client";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { updateOrderStatusAction } from "@/server/actions/dashboard";
import { CONFIRM_FIRST, ORDER_TRANSITIONS, PRIMARY_NEXT, type OrderStatus } from "@/lib/order-status";

/**
 * Quick status actions on the order page: the next happy-path step as one big primary button (with courier +
 * tracking number fields when it is "out for delivery"), the other legal moves as secondary buttons, and a
 * confirm dialog before anything that takes the order off the delivery path (refused / returned / cancelled).
 * Every button is ≥44 px; the server re-checks the transition, so this list is only a convenience.
 */
export function StatusActions({
  orderId,
  number,
  status,
  courierName,
  trackingNumber,
}: {
  orderId: string;
  number: number;
  status: OrderStatus;
  courierName: string | null;
  trackingNumber: string | null;
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<OrderStatus | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const next = ORDER_TRANSITIONS[status];
  if (!next.length) return null;

  const primary = PRIMARY_NEXT[status] && next.includes(PRIMARY_NEXT[status]) ? PRIMARY_NEXT[status] : undefined;
  const secondary = next.filter((s) => s !== primary && !CONFIRM_FIRST.includes(s));
  const destructive = next.filter((s) => CONFIRM_FIRST.includes(s));

  const run = (to: OrderStatus, extra: { note?: string; courierName?: string; trackingNumber?: string } = {}) =>
    start(async () => {
      const r = await updateOrderStatusAction(orderId, to, extra);
      setError(r.ok ? undefined : r.error);
      if (r.ok) dialog.current?.close();
      // Someone else (another tab / device) moved the order first: reload so the buttons match its real status.
      else if (r.error === "CONFLICT" || r.error === "invalid_transition") router.refresh();
    });

  const ask = (to: OrderStatus) => {
    setConfirming(to);
    dialog.current?.showModal();
  };

  return (
    <section className="card grid gap-3" aria-label={t("status")} data-testid="status-actions">
      {primary === "shipped" ? (
        <form
          className="grid gap-3"
          data-testid="ship-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run("shipped", { courierName: String(fd.get("courierName") ?? ""), trackingNumber: String(fd.get("trackingNumber") ?? "") });
          }}
        >
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 font-bold">{t("shipDetails")}</legend>
            <label className="block">
              <span className="label">{t("courierName")}</span>
              <input name="courierName" className="input" maxLength={80} defaultValue={courierName ?? ""} autoComplete="off" />
            </label>
            <label className="block">
              <span className="label">{t("trackingNumber")}</span>
              <input name="trackingNumber" className="input num" dir="ltr" maxLength={80} defaultValue={trackingNumber ?? ""} autoComplete="off" />
            </label>
          </fieldset>
          <button type="submit" disabled={pending} className="btn-gold min-h-12 w-full text-lg sm:w-auto" data-status="shipped">
            {t("action_shipped")}
          </button>
        </form>
      ) : primary ? (
        <button type="button" disabled={pending} className="btn-gold min-h-12 w-full text-lg sm:w-auto" data-status={primary} onClick={() => run(primary)}>
          {t(`action_${primary}`)}
        </button>
      ) : null}

      {(secondary.length > 0 || destructive.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {secondary.map((s) => (
            <button key={s} type="button" disabled={pending} className="btn-ghost" data-status={s} onClick={() => run(s)}>
              {t(`action_${s}`)}
            </button>
          ))}
          {destructive.map((s) => (
            <button key={s} type="button" disabled={pending} className="btn-danger" data-status={s} onClick={() => ask(s)}>
              {t(`action_${s}`)}
            </button>
          ))}
        </div>
      )}
      {error && !confirming && <p role="alert" className="field-error">{te(error as "generic")}</p>}

      <dialog
        ref={dialog}
        onClose={() => setConfirming(null)}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-white p-0 text-ink backdrop:bg-ink/50"
        aria-labelledby="status-confirm-title"
        data-testid="status-confirm"
      >
        {confirming && (
          <form
            method="dialog"
            className="grid gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(confirming, { note: String(fd.get("note") ?? "") });
            }}
          >
            <h2 id="status-confirm-title" className="text-lg font-extrabold">{t("confirmTitle", { number })}</h2>
            <p className="font-semibold">{t(`action_${confirming}`)}</p>
            <p className="text-ink-70">{t(`confirmBody_${confirming as "cancelled" | "returned" | "refused"}`)}</p>
            <label className="block">
              <span className="label">{t("note")}</span>
              <textarea name="note" className="input min-h-20" maxLength={300} rows={2} />
            </label>
            {error && <p role="alert" className="field-error">{te(error as "generic")}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>{t("confirmKeep")}</button>
              <button type="submit" disabled={pending} className="btn bg-danger text-white hover:bg-danger/90" data-testid="status-confirm-yes">
                {pending ? tc("loading") : t(`action_${confirming}`)}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
