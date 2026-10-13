"use client";
import { useEffect, useState } from "react";
import { Check, Icon } from "@/components/ui/icons";

type Status = "pending" | "paid" | "failed" | "expired" | "refunded";
export type ReturnLabels = Record<"checking" | "paid" | "failed" | "expired" | "refunded" | "pendingLong" | "continue" | "tryAgain", string>;

/**
 * Polls GET /api/payments/status (which asks the gateway) — the redirect itself proves nothing. Backs off from 2s to 10s
 * and stops after ~3 minutes; the webhook + reconciliation cron finish the job if the shopper closes the tab.
 */
export function PaymentReturnStatus({ paymentId, initial, next, labels: L }: { paymentId: string; initial: Status; next: string | null; labels: ReturnLabels }) {
  const [status, setStatus] = useState<Status>(initial);
  const [nextUrl, setNextUrl] = useState(next);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== "pending") return;
    let stopped = false;
    let delay = 2000;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/payments/status?p=${encodeURIComponent(paymentId)}`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { status: Status; next: string | null };
          if (stopped) return;
          setNextUrl(j.next);
          if (j.status !== "pending") return setStatus(j.status);
        }
      } catch {
        /* network blip: keep polling */
      }
      if (stopped) return;
      if (Date.now() - started > 20_000) setSlow(true);
      if (Date.now() - started > 180_000) return;
      delay = Math.min(10_000, Math.round(delay * 1.5));
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 600);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paymentId, status]);

  const tone = status === "paid" ? "bg-green text-white" : status === "pending" ? "bg-gold/10 text-gold" : "bg-danger/10 text-danger";
  return (
    <div className="grid justify-items-center gap-5 text-center" role="status" aria-live="polite" data-testid="payment-return" data-status={status}>
      <span className={`grid size-16 place-items-center rounded-full text-2xl font-bold ${tone}`} aria-hidden>
        {status === "pending" ? <span className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" /> : status === "paid" ? <Icon as={Check} className="h-7 w-7" /> : "!"}
      </span>
      <p className="max-w-sm text-lg font-medium">{status === "pending" ? L.checking : L[status]}</p>
      {status === "pending" && slow && <p className="max-w-sm text-sm text-ink-70">{L.pendingLong}</p>}
      {nextUrl && status !== "pending" && (
        <a href={nextUrl} className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-7 font-medium text-white">
          {status === "paid" ? L.continue : L.tryAgain}
        </a>
      )}
    </div>
  );
}
