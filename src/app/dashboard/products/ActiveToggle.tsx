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
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150 ${optimistic ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink-70"}`}
    >
      {optimistic ? t("active") : t("hidden")}
    </button>
  );
}
