/**
 * Single source of truth for pricing and plan limits (pricing v2, Abdulla 2026-10-14). USD, round numbers, never .99.
 * Online billing goes through docs/PAYMENTS.md; manual upgrades through /dashboard/upgrade + /admin.
 */
export type PlanId = "free" | "pro" | "business" | "max";
export const PLAN_IDS = ["free", "pro", "business", "max"] as const satisfies readonly PlanId[];
export const PAID_PLAN_IDS = ["pro", "business", "max"] as const satisfies readonly PlanId[];
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

/** Yearly = 10 × monthly ("2 months free"). */
export const YEARLY_FREE_MONTHS = 2;
const yearlyOf = (monthly: number) => monthly * (12 - YEARLY_FREE_MONTHS);

export const PRO_MONTHLY_USD = 15;
export const PRO_FIRST_MONTH = 1;
export const BUSINESS_MONTHLY_USD = 50;
/** Max price: Hark's pick, Abdulla did not set one (2026-10-14). Change it here; yearly, cards and copy follow. */
export const MAX_MONTHLY_USD = 100;

/** A feature line on a plan card. `soon`: not built yet, shown with a small "Soon" tag (honest for launch). */
export interface PlanFeature {
  /** Message key under `pricing.features.*` */
  key: string;
  soon?: boolean;
}

export interface Plan {
  id: PlanId;
  /** Monthly price in USD. */
  monthly: number;
  /** Yearly price in USD (0 for free). */
  yearly: number;
  /** First-month promo price in USD, if any. */
  firstMonth?: number;
  /** "Most popular" treatment. */
  highlight?: boolean;
  /** Ink, super-premium card. */
  premium?: boolean;
  /** Products shown in UI; null = "Unlimited" (a hidden safety cap still applies, see PRODUCT_CAP). */
  productsShown: number | null;
  /** Product Studio (AI photo/product edits) per calendar month. */
  studioEdits: number;
  /** "Everything in X, plus" */
  includes?: PlanId;
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    monthly: 0,
    yearly: 0,
    productsShown: 10,
    studioEdits: 0,
    features: [
      { key: "store1" },
      { key: "subdomain" },
      { key: "products" },
      { key: "codWhatsapp" },
      { key: "themesStarter" },
      { key: "analytics7" },
      { key: "badge" },
    ],
  },
  {
    id: "pro",
    monthly: PRO_MONTHLY_USD,
    yearly: yearlyOf(PRO_MONTHLY_USD),
    firstMonth: PRO_FIRST_MONTH,
    productsShown: 100,
    studioEdits: 10,
    includes: "free",
    features: [
      { key: "products" },
      { key: "studio", soon: true },
      { key: "themesAll" },
      { key: "noBadge" },
      { key: "analytics90" },
      { key: "discounts" },
      { key: "onlinePay", soon: true },
      { key: "orderNotify" },
      { key: "team2", soon: true },
    ],
  },
  {
    id: "business",
    monthly: BUSINESS_MONTHLY_USD,
    yearly: yearlyOf(BUSINESS_MONTHLY_USD),
    highlight: true,
    productsShown: null,
    studioEdits: 100,
    includes: "pro",
    features: [
      { key: "productsUnlimited" },
      { key: "studio", soon: true },
      { key: "domain", soon: true },
      { key: "stores3", soon: true },
      { key: "team5", soon: true },
      { key: "analyticsAdvanced" },
      { key: "bulkCsv" },
      { key: "aiDescriptions", soon: true },
      { key: "lowStock" },
      { key: "priority" },
    ],
  },
  {
    id: "max",
    monthly: MAX_MONTHLY_USD,
    yearly: yearlyOf(MAX_MONTHLY_USD),
    premium: true,
    productsShown: null,
    studioEdits: 100,
    includes: "business",
    features: [
      { key: "productsUnlimited" },
      { key: "studio", soon: true },
      { key: "priorityStudio", soon: true },
      { key: "aiDesigner", soon: true },
      { key: "exclusiveDesigns", soon: true },
      { key: "templatesPremium", soon: true },
      { key: "designRefresh", soon: true },
      { key: "seoAdvanced", soon: true },
      { key: "whiteLabel", soon: true },
      { key: "stores5", soon: true },
      { key: "team10", soon: true },
      { key: "earlyAccess" },
    ],
  },
];

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

/**
 * Comparison table cell: true/false, a number (rendered as Latin digits), a message key under `pricing.cells.*`,
 * or any of those marked `soon`.
 */
export type CellValue = boolean | number | string;
export type Cell = CellValue | { v: CellValue; soon: true };
export type FeatureRow = { key: string } & Record<PlanId, Cell>;
const soon = (v: CellValue) => ({ v, soon: true }) as const;

/**
 * Store and team-seat limits per plan (margin pass, Abdulla 2026-10-14: no "unlimited" team, Max 5 stores / 10 seats).
 * Team counts are extra members besides the owner; 0 = owner only. Not enforced yet (multi-store and team are "Soon");
 * the feature keys `stores{n}` / `team{n}` must match these numbers (tests/plans.test.ts).
 */
export const STORE_LIMIT: Record<PlanId, number> = { free: 1, pro: 1, business: 3, max: 5 };
export const TEAM_LIMIT: Record<PlanId, number> = { free: 0, pro: 2, business: 5, max: 10 };

/** Comparison table rows (keys under `pricing.rows.*`). */
export const COMPARE: FeatureRow[] = [
  { key: "products", free: 10, pro: 100, business: "unlimited", max: "unlimited" },
  { key: "studio", free: false, pro: soon(10), business: soon(100), max: soon(100) },
  { key: "stores", free: STORE_LIMIT.free, pro: STORE_LIMIT.pro, business: soon(STORE_LIMIT.business), max: soon(STORE_LIMIT.max) },
  { key: "team", free: false, pro: soon(TEAM_LIMIT.pro), business: soon(TEAM_LIMIT.business), max: soon(TEAM_LIMIT.max) },
  { key: "themes", free: "starter", pro: "all", business: "all", max: soon("exclusive") },
  { key: "analytics", free: "d7", pro: "d90", business: "advanced", max: "advanced" },
  { key: "payments", free: "codWa", pro: soon("codOnline"), business: soon("codOnline"), max: soon("codOnline") },
  { key: "discounts", free: false, pro: true, business: true, max: true },
  { key: "badge", free: "shown", pro: "removed", business: "removed", max: soon("whiteLabel") },
  { key: "domain", free: false, pro: false, business: soon(true), max: soon(true) },
  { key: "bulkCsv", free: false, pro: false, business: true, max: true },
  { key: "aiDescriptions", free: false, pro: false, business: soon(true), max: soon(true) },
  { key: "lowStock", free: true, pro: true, business: true, max: true },
  { key: "aiDesigner", free: false, pro: false, business: false, max: soon(true) },
  { key: "priorityStudio", free: false, pro: false, business: false, max: soon(true) },
  { key: "seoAdvanced", free: false, pro: false, business: false, max: soon(true) },
  { key: "designRefresh", free: false, pro: false, business: false, max: soon(true) },
  { key: "support", free: "community", pro: "email", business: "priority", max: "priority" },
];

/**
 * Server-side product caps. "Unlimited" plans still have a hidden safety cap; never show these numbers in UI or copy.
 */
export const PRODUCT_CAP: Record<PlanId, number> = { free: 10, pro: 100, business: 1000, max: 10000 };
export const FREE_PRODUCT_LIMIT = PRODUCT_CAP.free;

export function productLimit(plan: PlanId): number {
  return PRODUCT_CAP[plan];
}

/** Product Studio AI edits per month. */
export function studioEditsLimit(plan: PlanId): number {
  return getPlan(plan).studioEdits;
}

/** Shown limit: a number, or null for "Unlimited". */
export function productsShown(plan: PlanId): number | null {
  return getPlan(plan).productsShown;
}

export function normalizePlan(v: string | null | undefined): PlanId {
  return v === "pro" || v === "business" || v === "max" ? v : "free";
}

export function isPaidPlan(v: string): v is PaidPlanId {
  return (PAID_PLAN_IDS as readonly string[]).includes(v);
}

/** Pro and up remove the "Made with Bazarga" store footer badge. */
export function showsBazargaBadge(plan: PlanId): boolean {
  return plan === "free";
}

// ---------------------------------------------------------------- feature gates (enforced server-side)
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2, max: 3 };

/** True when `plan` is `min` or a higher tier. */
export function planAtLeast(plan: PlanId, min: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/**
 * Lowest plan that unlocks each gated feature (matches the pricing cards). Server actions call
 * `assertFeature` (src/server/plan-gate.ts); pages use `hasFeature` only to choose between the tool and an upgrade card.
 */
export const FEATURE_MIN_PLAN = {
  bulkCsv: "business",
  seoAdvanced: "max",
  whiteLabel: "max",
  multiStore: "business",
  team: "pro",
  aiDescriptions: "business",
  templatesPremium: "max",
  domain: "business",
  studio: "pro",
  aiDesigner: "max",
} as const satisfies Record<string, PlanId>;
export type GatedFeature = keyof typeof FEATURE_MIN_PLAN;

export function hasFeature(plan: PlanId, f: GatedFeature): boolean {
  return planAtLeast(plan, FEATURE_MIN_PLAN[f]);
}
