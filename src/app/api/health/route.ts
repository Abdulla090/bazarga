import { NextResponse, connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { buildInfo } from "@/server/build-info";
import { queryCount, queryStatsEnabled } from "@/server/db/query-stats";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const DB_TIMEOUT_MS = 3000;

/**
 * Liveness + DB readiness for uptime monitors and the deploy runbook (docs/OPS.md).
 * 200 `{status:"ok"}` when the database answers `select 1` within 3 s, 503 `{status:"degraded"}` otherwise.
 * Always carries the build sha so a probe can tell which deploy answered. No secrets, no tenant data.
 */
export async function GET() {
  // Always per request (a liveness probe must never be served from a prerender).
  await connection();
  const build = buildInfo();
  const base = { sha: build.sha, env: build.env, version: build.version, time: new Date().toISOString() };
  const started = Date.now();
  // DB_QUERY_STATS=1 (measurement only): report the statement count *before* our own probe query.
  const queries = queryStatsEnabled() ? queryCount() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db().execute(sql`select 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("db ping timed out")), DB_TIMEOUT_MS);
      }),
    ]);
    return NextResponse.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - started, ...base, ...(queries !== undefined ? { dbQueries: queries } : {}) },
      { headers: NO_STORE },
    );
  } catch (err) {
    logger.error("health.db_failed", { err, sha: build.shortSha });
    return NextResponse.json({ status: "degraded", db: "error", latencyMs: Date.now() - started, ...base }, { status: 503, headers: NO_STORE });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
