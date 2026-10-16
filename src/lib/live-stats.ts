/**
 * Landing "live numbers" (docs/DEMAND.md D2). Every figure is a real DB count; a counter only appears once it clears a
 * small floor, so an empty database never shows "0" and nothing is ever padded. The section itself needs two counters.
 */
export type LiveStats = { sellers: number; stores: number; orders: number; waitlist: number };
export type StatKey = keyof LiveStats;

export const STAT_ORDER: readonly StatKey[] = ["sellers", "stores", "orders", "waitlist"];
export const STAT_FLOORS: Readonly<Record<StatKey, number>> = { sellers: 3, stores: 3, orders: 5, waitlist: 5 };
/** The band is hidden unless at least this many counters pass their floor. */
export const MIN_VISIBLE_STATS = 2;

/** Accounts created by our own tests/smoke runs against the live DB are not "real sellers". */
export const TEST_EMAIL_DOMAIN = "@example.com";

export function visibleStats(raw: LiveStats | null): { key: StatKey; value: number }[] {
  if (!raw) return [];
  const out = STAT_ORDER.flatMap((key) => {
    const value = raw[key];
    return Number.isFinite(value) && value >= STAT_FLOORS[key] ? [{ key, value: Math.floor(value) }] : [];
  });
  return out.length >= MIN_VISIBLE_STATS ? out : [];
}
