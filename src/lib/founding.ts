/**
 * Founding sellers (docs/DEMAND.md D3): the first 100 real stores get a permanent number, a badge in the dashboard and
 * on their public store, and the perks below. Numbers come from the DB; our own demo store and @example.com test
 * accounts never take a spot.
 */
import { TEST_EMAIL_DOMAIN } from "./live-stats";

export const FOUNDING_SPOTS = 100;
/** Perk keys, in display order; copy lives in messages `founding.perk.<key>`. Nothing here may cost per use. */
export const FOUNDING_PERKS = ["badge", "early", "support", "voice"] as const;
export type FoundingPerk = (typeof FOUNDING_PERKS)[number];

const DEMO_EMAIL = (process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app").toLowerCase();

/** Only real sellers can be founding sellers. */
export function isFoundingEligibleEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e !== DEMO_EMAIL && !e.endsWith(TEST_EMAIL_DOMAIN);
}

/** Spots still open, never negative, never above the total; null when the count is unknown. */
export function foundingSpotsLeft(taken: number | null | undefined): number | null {
  if (typeof taken !== "number" || !Number.isFinite(taken)) return null;
  return Math.max(0, Math.min(FOUNDING_SPOTS, FOUNDING_SPOTS - Math.floor(taken)));
}

/** A valid founding number is an integer 1..FOUNDING_SPOTS. */
export function isFoundingNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= FOUNDING_SPOTS;
}
