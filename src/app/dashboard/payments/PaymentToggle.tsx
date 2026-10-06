"use client";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { togglePaymentAction } from "@/server/actions/dashboard";

export function PaymentToggle({ method, enabled, available, stub }: { method: string; enabled: boolean; available: boolean; stub: boolean }) {
  const t = useTranslations("payments");
  const [on, setOn] = useOptimistic(enabled);
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t(method as "cod")}</p>
        {stub ? (
          <p className="hint">{t("comingSoon")}</p>
        ) : (
          !available && <p className="hint">{t("notConfigured")}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending || stub}
        onClick={() =>
          start(async () => {
            setOn(!on);
            await togglePaymentAction(method, !on);
          })
        }
        className={`chip min-h-9 px-4 ${on ? "bg-green text-white" : "bg-ink/10 text-ink-70"}`}
      >
        {on ? t("on") : t("off")}
      </button>
    </div>
  );
}
