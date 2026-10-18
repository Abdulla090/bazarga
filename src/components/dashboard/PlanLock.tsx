import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { PlanId } from "@/lib/plans";

/** Upgrade card shown in place of a tool the store's plan does not include. Server component, works without JS. */
export async function PlanLock({ min, title, body, children }: { min: PlanId; title: string; body: string; children?: React.ReactNode }) {
  const t = await getTranslations("planGate");
  const tu = await getTranslations("upgrade");
  return (
    <section data-testid="plan-lock" data-min-plan={min} className="grid max-w-2xl gap-3 rounded-2xl border border-line bg-white p-5">
      <span className="w-fit rounded-full bg-[#2563EB]/10 px-3 py-1 text-[13px] font-semibold text-[#2563EB]">{t("badge", { plan: tu(`name.${min}`) })}</span>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-ink-70">{body}</p>
      {children}
      <Link href="/dashboard/upgrade" data-testid="plan-lock-cta" className="inline-flex min-h-11 w-fit items-center rounded-full bg-[#2563EB] px-5 font-semibold text-white">{t("cta", { plan: tu(`name.${min}`) })}</Link>
    </section>
  );
}
