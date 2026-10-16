import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FOUNDING_PERKS, FOUNDING_SPOTS } from "@/lib/founding";
import { Check, Icon } from "@/components/ui/icons";

/** Pricing-page block: perks of the first 100 stores plus the real spots-left counter (hidden when the count is unknown). */
export async function FoundingSpots({ spotsLeft }: { spotsLeft: number | null }) {
  const t = await getTranslations("founding");
  const taken = spotsLeft === null ? null : FOUNDING_SPOTS - spotsLeft;
  return (
    <section className="container-page max-w-5xl pb-16" aria-labelledby="founding-title" data-testid="founding-block">
      <div className="rounded-3xl border border-line bg-white p-6 sm:p-10">
        <p className="mk-eyebrow">{t("eyebrow")}</p>
        <h2 id="founding-title" className="mt-3 text-[1.75rem] font-light leading-[1.15] tracking-tight text-balance sm:text-[2.25rem]">{t("title")}</h2>
        <p className="mt-3 max-w-xl text-ink-70">{t("lead")}</p>
        {spotsLeft !== null && (
          <div className="mt-6" data-testid="founding-spots">
            <p className="num text-sm font-semibold text-[#2563EB]">{spotsLeft > 0 ? t("spotsLeft", { n: spotsLeft }) : t("spotsGone")}</p>
            <div className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-ink-10" role="img" aria-label={t("spotsLeft", { n: spotsLeft })}>
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${((taken ?? 0) / FOUNDING_SPOTS) * 100}%` }} />
            </div>
          </div>
        )}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FOUNDING_PERKS.map((k) => (
            <li key={k} className="flex items-start gap-3 text-[15px]">
              <Icon as={Check} className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
              <span>{t(`perk.${k}`)}</span>
            </li>
          ))}
        </ul>
        {(spotsLeft === null || spotsLeft > 0) && (
          <Link href="/signup" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-7 font-semibold text-paper">{t("cta")}</Link>
        )}
      </div>
    </section>
  );
}
