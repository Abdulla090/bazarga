import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness. 200 when the database answers, 503 otherwise. */
export async function GET() {
  const started = Date.now();
  try {
    await db().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "ok", latencyMs: Date.now() - started, version: process.env.APP_VERSION ?? "dev" });
  } catch (err) {
    logger.error("health.db_failed", { err });
    return NextResponse.json({ status: "degraded", db: "error" }, { status: 503 });
  }
}
