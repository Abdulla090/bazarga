import { PRO_FIRST_MONTH, getPlan, usd } from "@/lib/plans";

/**
 * "$10 struck through, big glowing blue $1". Hook-free, so both server (hero) and client (pricing cards) use it.
 * Each amount is its own LTR island, so "$" stays in front of the digits in RTL; the row itself follows the page
 * direction (RTL readers meet the old price first, then the new one).
 */
export function PromoPrice({ size = "lg", srLabel }: { size?: "md" | "lg" | "xl"; srLabel: string }) {
  const pro = getPlan("pro");
  const big = size === "xl" ? "text-7xl sm:text-8xl" : size === "lg" ? "text-7xl" : "text-6xl";
  const small = size === "md" ? "text-xl" : "text-2xl";
  return (
    <span className="inline-flex items-end gap-3" data-promo-price>
      <span className="sr-only">{srLabel}</span>
      <s aria-hidden="true" dir="ltr" data-was className={`was-price mb-1.5 ${small} font-normal`}>{usd(pro.monthly)}</s>
      <span aria-hidden="true" dir="ltr" data-now className={`glow-price ${big} font-semibold`}>{usd(pro.firstMonth ?? PRO_FIRST_MONTH)}</span>
    </span>
  );
}
