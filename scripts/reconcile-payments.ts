// Payment reconciliation + abandoned-order expiry, for a system cron (same work as POST /api/cron/payments):
//
//   every 5 minutes:  cd /app && npm run payments:reconcile
//
// Asks FIB / ZainCash (only the providers configured in env) for the status of pending attempts, then cancels
// online orders left unpaid for PAYMENT_ORDER_TTL_MINUTES (default 60) and releases their stock. Idempotent.
import { createDb } from "../src/server/db";
import { env } from "../src/server/env";
import { runPaymentJobs } from "../src/server/payments/reconcile";

async function main() {
  const e = env();
  const database = createDb(e.DATABASE_URL);
  const result = await runPaymentJobs(database, { ttlMinutes: e.PAYMENT_ORDER_TTL_MINUTES });
  console.log(JSON.stringify(result));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
