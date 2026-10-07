"use client";
import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { updateOrderStatusAction } from "@/server/actions/dashboard";
import { ORDER_TRANSITIONS, type OrderStatus } from "@/lib/order-status";

const DESTRUCTIVE: readonly OrderStatus[] = ["cancelled", "refused", "returned"];

export function StatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const t = useTranslations("orders");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const next = ORDER_TRANSITIONS[status];
  if (!next.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          className={DESTRUCTIVE.includes(s) ? "btn-danger" : "btn-gold"}
          onClick={() => {
            if (DESTRUCTIVE.includes(s) && !confirm((s === "cancelled" ? t("cancel") : t(`status_${s}`)) + "?")) return;
            start(async () => {
              const r = await updateOrderStatusAction(orderId, s);
              setError(r.ok ? undefined : r.error);
            });
          }}
        >
          {s === "cancelled" ? t("cancel") : t("moveTo", { status: t(`status_${s}`) })}
        </button>
      ))}
      {error && <p role="alert" className="field-error w-full">{te(error as "generic")}</p>}
    </div>
  );
}
