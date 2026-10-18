import { NextResponse, connection } from "next/server";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { expireLapsedPlans } from "@/server/services/plan-expiry";
import { runPaymentJobs } from "@/server/payments/reconcile";
import { pruneRateLimits } from "@/server/auth/rate-limit";
import { recordCronRun } from "@/server/services/platform-settings";

/** Daily housekeeping (Vercel Hobby cron): plan expiry + payment reconcile/abandoned-order expiry + stale rate-limit counters. Bearer CRON_SECRET; unset → 404. */
export async function GET(req: Request) {
  await connection();
  const e = env();
  if (!e.CRON_SECRET) return new NextResponse(null, { status: 404 });
  if (!isCronAuthorized(req.headers.get("authorization"), e.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const plans = await expireLapsedPlans(db());
    const payments = await runPaymentJobs(db(), { ttlMinutes: e.PAYMENT_ORDER_TTL_MINUTES });
    // Counters older than a day can't affect any window (longest is 1 h); keeps rate_limits small.
    await pruneRateLimits(db());
    await recordCronRun(db(), "daily", true, { plansExpired: plans.expired });
    return NextResponse.json({ ok: true, plans, payments }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("cron.daily_failed", { err });
    await recordCronRun(db(), "daily", false);
    return NextResponse.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
