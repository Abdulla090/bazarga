/**
 * Process-wide SQL statement counter, fed by the drizzle logger (src/server/db/index.ts).
 * Used to measure "queries per storefront view" (scripts/measure.mjs, smoke test). Counting is a single integer
 * increment per statement; it is only *exposed* (GET /api/health) when DB_QUERY_STATS=1.
 */
const g = globalThis as unknown as { __mmQueryCount?: number };

export function countQuery(): void {
  g.__mmQueryCount = (g.__mmQueryCount ?? 0) + 1;
}

export function queryCount(): number {
  return g.__mmQueryCount ?? 0;
}

export function queryStatsEnabled(): boolean {
  return process.env.DB_QUERY_STATS === "1" || process.env.DB_QUERY_STATS === "true";
}
