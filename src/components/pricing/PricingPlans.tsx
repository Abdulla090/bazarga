"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PLANS, usd, yearlyMonthsFree, type Plan } from "@/lib/plans";

function Price({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const t = useTranslations("pricing");
  if (plan.id === "free") {
    return (
      <>
        <p className="num text-5xl font-light tracking-tight" dir="ltr">$0</p>
        <p className="mt-1 text-sm text-ink-70">{t("forever")}</p>
      </>
    );
  }
  const amount = yearly ? plan.yearly : plan.monthly;
  return (
    <>
      <p className="flex items-baseline gap-1" dir="ltr">
        <span className="num text-5xl font-light tracking-tight">{usd(amount)}</span>
        <span className="text-sm text-ink-70">{yearly ? "/yr" : "/mo"}</span>
      </p>
      <p className="mt-1 text-sm text-ink-70">
        {yearly ? t("twoFree") : plan.firstMonth ? `${t("firstMonth")} · ${t("then")}` : ""}
        {yearly && yearlyMonthsFree(plan) !== 2 ? "" : ""}
      </p>
    </>
  );
}

export function PricingPlans({ showToggle = true }: { showToggle?: boolean }) {
  const t = useTranslations("pricing");
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      {showToggle && (
        <div role="group" aria-label={t("monthly") + " / " + t("yearly")} className="mx-auto mb-8 flex w-fit rounded-full border border-line p-1">
          {([false, true] as const).map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${yearly === y ? "bg-ink text-paper" : "text-ink-70 hover:text-ink"}`}
            >
              {y ? t("yearly") : t("monthly")}
              {y && <span className="ms-2 text-xs font-semibold text-[#2563EB]">{t("twoFree")}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <article
            key={p.id}
            data-plan={p.id}
            className={`relative flex flex-col rounded-3xl border p-6 ${p.highlight ? "border-[#2563EB] bg-white shadow-[0_0_0_1px_#2563EB,0_20px_50px_-24px_rgba(37,99,235,.45)]" : "border-line bg-white"}`}
          >
            {p.highlight && (
              <span className="absolute -top-3 start-6 rounded-full bg-[#2563EB] px-3 py-1 text-xs font-bold text-white">
                {t("popular")} · {t("firstMonth")}
              </span>
            )}
            <h3 className="text-lg font-bold">{t(p.id)}</h3>
            <p className="mt-1 min-h-10 text-sm text-ink-70">{t(`${p.id}Desc` as "freeDesc")}</p>
            <div className="mt-5 min-h-[5.5rem]"><Price plan={p} yearly={yearly} /></div>
            <Link
              href="/signup"
              className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${p.highlight ? "bg-[#2563EB] text-white hover:bg-[#1d4ed8]" : "border border-ink text-ink hover:bg-ink hover:text-paper"} transition-colors duration-200`}
            >
              {t(p.id === "free" ? "ctaFree" : p.id === "pro" ? "ctaPro" : "ctaBusiness")}
            </Link>
            <ul className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t(`features.${f}` as "features.cod")}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
