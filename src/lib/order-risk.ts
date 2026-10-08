/**
 * Fake-order protection for cash-on-delivery stores. Pure rules; the facts come from
 * src/server/services/orders.ts (placeOrder) and the checkout action.
 *
 * Policy (decided 2026-10-08):
 *  - Hard stops, with one generic message that never says why: the honeypot field is filled, the phone is on
 *    the store's blocklist, or the phone already placed MAX_ORDERS_PER_PHONE_PER_DAY orders at this store today.
 *  - The same phone sending the same cart again within REPLAY_WINDOW_MS while the first order is still pending is a
 *    double tap: checkout returns the first order instead of creating a second one.
 *  - Everything else only raises a flag the seller sees ("check before shipping"); a real shopper is never refused
 *    because of a heuristic.
 */

export const RISK_FLAGS = ["fast_submit", "duplicate", "many_open", "refused_before"] as const;
export type RiskFlag = (typeof RISK_FLAGS)[number];

/** A human fills name + phone + city + landmark in more than this; bots post instantly. */
export const MIN_FILL_MS = 3_000;
/** Same phone + same cart inside this window, first order still pending → return the first order. */
export const REPLAY_WINDOW_MS = 10 * 60_000;
/** Same phone + same cart inside this window → "duplicate" flag. */
export const DUPLICATE_WINDOW_MS = 24 * 3_600_000;
/** Hard cap of orders per phone per store in DUPLICATE_WINDOW_MS. */
export const MAX_ORDERS_PER_PHONE_PER_DAY = 5;
/** Open orders from the same phone (before this one) that raise "many_open". */
export const MANY_OPEN_THRESHOLD = 2;
/** Checkout attempts per IP per store per hour (on top of the global 20 / 10 min per IP). */
export const CHECKOUT_PER_IP_PER_STORE = { limit: 10, windowSeconds: 3_600 } as const;

/** Stable fingerprint of a merged cart: order of lines doesn't matter. */
export function cartFingerprint(lines: { productId: string; variantId?: string | null; quantity: number }[]): string {
  return lines
    .map((l) => `${l.productId}:${l.variantId ?? ""}x${l.quantity}`)
    .sort()
    .join("|");
}

/** The honeypot is a visually hidden "website" input: people never see it, form-filling bots do. */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export type RiskFacts = {
  /** ms between the checkout form appearing and submit; undefined when the client didn't send it. */
  elapsedMs?: number | null;
  /** Same phone, same cart fingerprint, within DUPLICATE_WINDOW_MS (orders not cancelled by the seller). */
  sameCartRecent: number;
  /** Other open orders (pending / confirmed / shipped / postponed) from this phone at this store. */
  openFromPhone: number;
  /** Earlier refused / returned orders from this phone at this store. */
  refusedFromPhone: number;
};

export function assessRisk(f: RiskFacts): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (typeof f.elapsedMs === "number" && f.elapsedMs >= 0 && f.elapsedMs < MIN_FILL_MS) flags.push("fast_submit");
  if (f.sameCartRecent > 0) flags.push("duplicate");
  if (f.openFromPhone >= MANY_OPEN_THRESHOLD) flags.push("many_open");
  if (f.refusedFromPhone > 0) flags.push("refused_before");
  return flags;
}

/** Keep only known flags (the column is jsonb; never trust it blindly when rendering). */
export function knownRiskFlags(v: unknown): RiskFlag[] {
  return Array.isArray(v) ? (v.filter((x) => (RISK_FLAGS as readonly string[]).includes(x as string)) as RiskFlag[]) : [];
}
