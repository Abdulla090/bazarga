import type { CSSProperties } from "react";
import { PRO_FIRST_MONTH, getPlan, usd } from "@/lib/plans";

/** Characters as staggered blur-swap pieces (see `.swap` in globals.css). Hook-free so the server hero can use it. */
function chars(text: string, from: number) {
  return Array.from(text).map((ch, k) => (
    <span key={k} className="sw sw-ch motion-reduce:transition-none" style={{ "--i": from + k } as CSSProperties}>{ch}</span>
  ));
}

/**
 * "$10 struck through, big glowing blue $1". Hook-free, so both server (hero) and client (pricing cards) use it.
 * Each amount is its own LTR island, so "$" stays in front of the digits in RTL; the row itself follows the page
 * direction (RTL readers meet the old price first, then the new one).
 * `roll`: split both amounts per character so they take part in the pricing toggle's blur swap.
 */
export function PromoPrice({ size = "lg", srLabel, roll = false }: { size?: "md" | "lg" | "xl"; srLabel: string; roll?: boolean }) {
  const pro = getPlan("pro");
  const big = size === "xl" ? "text-7xl sm:text-8xl" : size === "lg" ? "text-7xl" : "text-6xl";
  const small = size === "md" ? "text-xl" : "text-2xl";
  const was = usd(pro.monthly);
  const now = usd(pro.firstMonth ?? PRO_FIRST_MONTH);
  return (
    <span className="inline-flex items-end gap-3" data-promo-price>
      <span className="sr-only">{srLabel}</span>
      <s aria-hidden="true" dir="ltr" data-was className={`was-price mb-1.5 ${small} font-normal`}>{roll ? chars(was, 0) : was}</s>
      <span aria-hidden="true" dir="ltr" data-now className={`glow-price ${big} font-semibold`}>{roll ? chars(now, was.length) : now}</span>
    </span>
  );
}
