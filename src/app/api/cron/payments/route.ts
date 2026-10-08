import { NextResponse, connection } from "next/server";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { runPaymentJobs } from "@/server/payments/reconcile";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * Payment reconciliation + abandoned-order expiry (src/server/payments/reconcile.ts).
 * Call every 5 minutes with `Authorization: Bearer $CRON_SECRET` (GET for Vercel-style crons, or POST):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/payments
 * Without CRON_SECRET configured the route doesn't exist (404). Safe to run concurrently / repeatedly.
 */
async function handle(req: Request) {
  await connection();
  const e = env();
  if (!e.CRON_SECRET) return new NextResponse(null, { status: 404 });
  if (!isCronAuthorized(req.headers.get("authorization"), e.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await runPaymentJobs(db(), { ttlMinutes: e.PAYMENT_ORDER_TTL_MINUTES });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("cron.payments_failed", { err });
    return NextResponse.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
