import { getPlan, type PlanId } from "@/lib/plans";

/** IQD prices are rounded to the nearest 250 IQD (the smallest note in everyday use). */
export const IQD_ROUNDING = 250;

export function usdToIqd(usd: number, rate: number): number {
  return Math.max(IQD_ROUNDING, Math.round((usd * rate) / IQD_ROUNDING) * IQD_ROUNDING);
}

/**
 * Subscription price for a plan/period. Pro monthly costs the first-month promo ($1) when the store has never had a
 * paid plan; yearly is the plan's yearly price.
 */
export function subscriptionPrice(plan: Exclude<PlanId, "free">, months: 1 | 12, rate: number, firstMonthEligible: boolean) {
  const p = getPlan(plan);
  const promo = months === 1 && firstMonthEligible && p.firstMonth !== undefined;
  const usd = months === 12 ? p.yearly : promo ? p.firstMonth! : p.monthly;
  return { usd, iqd: usdToIqd(usd, rate), promo };
}

/** Platform commission on an order, in IQD (floor, so the seller is never short-changed by rounding). */
export function commissionIqd(amountIqd: number, bps: number): number {
  return Math.floor((amountIqd * bps) / 10_000);
}
