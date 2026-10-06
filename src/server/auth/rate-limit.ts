import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { AppError } from "../errors";

/**
 * Fixed-window rate limiter backed by Postgres (works across instances, no Redis needed for v1).
 * Atomically upserts the counter and resets it when the window has elapsed.
 */
export async function hitRateLimit(
  database: Db,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const res = await database.execute(sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `);
  const rows = (res as unknown as { rows: { count: number | string }[] }).rows;
  const count = Number(rows[0]?.count ?? 0);
  return { allowed: count <= limit, count };
}

export async function enforceRateLimit(database: Db, key: string, limit: number, windowSeconds: number) {
  const { allowed } = await hitRateLimit(database, key, limit, windowSeconds);
  if (!allowed) throw new AppError("RATE_LIMITED");
}

/** Housekeeping: delete stale counters (call from a cron / on startup). */
export async function pruneRateLimits(database: Db, olderThanSeconds = 86_400) {
  await database.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - make_interval(secs => ${olderThanSeconds})`);
}
