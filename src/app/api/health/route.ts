import { NextResponse, connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { queryCount, queryStatsEnabled } from "@/server/db/query-stats";

/** Liveness + DB readiness. 200 when the database answers, 503 otherwise. */
export async function GET() {
  // Always per request (a liveness probe must never be served from a prerender).
  await connection();
  const started = Date.now();
  // DB_QUERY_STATS=1 (measurement only): report the statement count *before* our own probe query.
  const queries = queryStatsEnabled() ? queryCount() : undefined;
  try {
    await db().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "ok", latencyMs: Date.now() - started, version: process.env.APP_VERSION ?? "dev", ...(queries !== undefined ? { dbQueries: queries } : {}) });
  } catch (err) {
    logger.error("health.db_failed", { err });
    return NextResponse.json({ status: "degraded", db: "error" }, { status: 503 });
  }
}
