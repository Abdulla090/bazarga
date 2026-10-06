"use client";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleProductAction } from "@/server/actions/dashboard";

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations("products");
  const [optimistic, set] = useOptimistic(active);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      disabled={pending}
      onClick={() =>
        start(async () => {
          set(!optimistic);
          await toggleProductAction(id, !optimistic);
        })
      }
      className={`chip min-h-8 px-3 ${optimistic ? "bg-green/15 text-green" : "bg-ink/10 text-ink-70"}`}
    >
      {optimistic ? t("active") : t("hidden")}
    </button>
  );
}
