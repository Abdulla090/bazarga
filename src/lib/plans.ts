/** Single source of truth for pricing. USD, round numbers. No real billing yet (see docs/ROADMAP.md). */
export type PlanId = "free" | "pro" | "business";

export interface Plan {
  id: PlanId;
  /** Monthly price in USD. */
  monthly: number;
  /** Yearly price in USD (0 for free). */
  yearly: number;
  /** First-month promo price in USD, if any. */
  firstMonth?: number;
  highlight?: boolean;
  /** Feature keys under messages `pricing.features.*`. */
  features: string[];
}

export const PLANS: Plan[] = [
  { id: "free", monthly: 0, yearly: 0, features: ["products15", "themesBasic", "cod", "badge"] },
  { id: "pro", monthly: 10, yearly: 100, firstMonth: 1, highlight: true, features: ["productsUnlimited", "themesAll", "analytics", "fibZain", "noBadge"] },
  { id: "business", monthly: 20, yearly: 200, features: ["everythingPro", "domain", "staff", "priority"] },
];

export const PRO_FIRST_MONTH = 1;
export const YEARLY_FREE_MONTHS = 2;

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id)!;
}

/** "$10" — always Latin digits, ASCII "$". */
export function usd(n: number): string {
  return `$${n}`;
}

export function yearlyMonthsFree(p: Plan): number {
  return p.monthly ? Math.round((p.monthly * 12 - p.yearly) / p.monthly) : 0;
}

export type FeatureRow = { key: string; free: boolean | string; pro: boolean | string; business: boolean | string };
/** Comparison table rows: true/false or a messages key under pricing.cells.* */
export const COMPARE: FeatureRow[] = [
  { key: "products", free: "c15", pro: "unlimited", business: "unlimited" },
  { key: "themes", free: "basic", pro: "all", business: "all" },
  { key: "analytics", free: false, pro: true, business: true },
  { key: "payments", free: "codOnly", pro: "codFibZain", business: "codFibZain" },
  { key: "badge", free: "shown", pro: "removed", business: "removed" },
  { key: "domain", free: false, pro: false, business: true },
  { key: "staff", free: false, pro: false, business: true },
  { key: "support", free: "community", pro: "email", business: "priority" },
];

/** Server-side limits per plan. */
export const FREE_PRODUCT_LIMIT = 15;
export function productLimit(plan: PlanId): number {
  return plan === "free" ? FREE_PRODUCT_LIMIT : Infinity;
}
export function normalizePlan(v: string | null | undefined): PlanId {
  return v === "pro" || v === "business" ? v : "free";
}
