"use client";
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PLANS, usd, yearlyMonthsFree, type Plan } from "@/lib/plans";
import { PromoPrice } from "./PromoPrice";
import { Check, Icon } from "@/components/ui/icons";

/** CSS custom properties for the blur-swap stagger (style-src allows inline attributes; see src/server/csp.ts). */
const vars = (v: Record<string, number>) => Object.fromEntries(Object.entries(v).map(([k, n]) => [`--${k}`, n])) as CSSProperties;

/** One staggered piece of a swap layer. */
function Sw({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return <span className={["sw motion-reduce:transition-none", className].filter(Boolean).join(" ")} style={vars({ i })}>{children}</span>;
}

/** A price split per character, so the digits roll in one after another. Read once by AT via the sr-only copy. */
export function RollText({ text, from = 0, className }: { text: string; from?: number; className?: string }) {
  return (
    <span className={className} dir="ltr">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((ch, k) => (
          <Sw key={k} i={from + k} className="sw-ch">{ch}</Sw>
        ))}
      </span>
    </span>
  );
}

function PriceState({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const t = useTranslations("pricing");
  // Pro, monthly: the $1 first-month treatment. Yearly has no promo, so it falls back to the plain price.
  if (plan.firstMonth && !yearly) {
    return (
      <div data-promo>
        <PromoPrice srLabel={t("wasNow")} roll />
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
          <Sw i={4} className="font-semibold text-[#2563EB]">{t("firstMonthOnly")}</Sw>
          <Sw i={5} className="text-ink-50"><span aria-hidden="true">·</span></Sw>
          <Sw i={6} className="text-ink-70">{t("after")}</Sw>
        </p>
      </div>
    );
  }
  const amount = usd(yearly ? plan.yearly : plan.monthly);
  return (
    <>
      <p className="flex items-baseline gap-1.5">
        <RollText text={amount} className="num text-6xl font-light tracking-tight" />
        <Sw i={amount.length} className="text-sm text-ink-70">{yearly ? t("perYear") : t("perMonth")}</Sw>
      </p>
      <p className="mt-3 text-sm text-ink-70">
        <Sw i={amount.length + 1}>{yearly && yearlyMonthsFree(plan) > 0 ? t("twoFree") : "\u00a0"}</Sw>
      </p>
    </>
  );
}

/** Both states stacked in one cell; the inactive one is blurred out and hidden from AT. */
function Price({ plan, yearly, card }: { plan: Plan; yearly: boolean; card: number }) {
  const t = useTranslations("pricing");
  if (plan.id === "free") {
    return (
      <>
        <p className="num text-6xl font-light tracking-tight" dir="ltr">$0</p>
        <p className="mt-3 text-sm text-ink-70">{t("forever")}</p>
      </>
    );
  }
  return (
    <div className="swap" style={vars({ card })} data-swap>
      {(["monthly", "yearly"] as const).map((layer) => {
        const on = (layer === "yearly") === yearly;
        return (
          <div key={layer} className="swap-layer" data-layer={layer} data-on={String(on)} aria-hidden={on ? undefined : true}>
            <PriceState plan={plan} yearly={layer === "yearly"} />
          </div>
        );
      })}
    </div>
  );
}

export function PricingPlans({ showToggle = true, defaultYearly = false }: { showToggle?: boolean; defaultYearly?: boolean }) {
  const t = useTranslations("pricing");
  const [yearly, setYearly] = useState(defaultYearly);
  return (
    <div>
      {showToggle && (
        <div
          data-plans-toggle
          data-yearly={String(yearly)}
          role="group"
          aria-label={t("monthly") + " / " + t("yearly")}
          className="relative mx-auto mb-8 grid w-fit grid-cols-2 rounded-full border border-line p-1"
        >
          <span aria-hidden="true" className="plans-thumb pointer-events-none absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-full bg-ink shadow-[0_6px_16px_-8px_rgba(10,10,11,.6)] motion-reduce:transition-none" />
          {([false, true] as const).map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`relative z-10 min-h-11 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors duration-300 ${yearly === y ? "text-paper" : "text-ink-70 hover:text-ink"}`}
            >
              {y ? t("yearly") : t("monthly")}
              {y && <span className={`ms-2 text-xs font-semibold transition-colors duration-300 ${yearly ? "text-[#93b4ff]" : "text-[#2563EB]"}`}>{t("twoFree")}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p, idx) => (
          <article
            key={p.id}
            data-plan={p.id}
            className={`relative flex flex-col rounded-3xl border p-6 ${p.highlight ? "border-[#2563EB] bg-[linear-gradient(180deg,rgba(37,99,235,.06),#fff_45%)] shadow-[0_0_0_1px_#2563EB,0_24px_60px_-28px_rgba(37,99,235,.55)]" : "border-line bg-white"}`}
          >
            {p.highlight && (
              <span className="absolute -top-3 start-6 rounded-full bg-[#2563EB] px-3 py-1 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,.6)]">
                {t("popular")}
              </span>
            )}
            <h3 className="text-lg font-bold">{t(p.id)}</h3>
            <p className="mt-1 min-h-10 text-sm text-ink-70">{t(`${p.id}Desc` as "freeDesc")}</p>
            <div className="mt-6 min-h-[7.25rem]"><Price plan={p} yearly={yearly} card={idx} /></div>
            <Link
              href="/signup"
              className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${p.highlight ? "bg-[#2563EB] text-white hover:bg-[#1d4ed8]" : "border border-ink text-ink hover:bg-ink hover:text-paper"} transition-colors duration-200`}
            >
              {t(p.id === "free" ? "ctaFree" : p.id === "pro" ? "ctaPro" : "ctaBusiness")}
            </Link>
            <ul className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Icon as={Check} className="mt-0.5 shrink-0 text-[#2563EB]" />
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
