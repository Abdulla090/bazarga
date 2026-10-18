import { createDb } from "../src/server/db";
import { cleanupTestAccounts } from "../src/server/services/test-accounts";

/**
 * Remove e2e/gate/smoke/audit test accounts (…@example.com) and everything they own from a database — run it on live
 * after any e2e/gate/smoke run that targeted the deployed site (docs/OPS.md, docs/BACKLOG.md).
 *   DATABASE_URL=postgres://… npx tsx --conditions=react-server scripts/cleanup-test-accounts.ts [--dry-run] [--min-age=30]
 * Never touches demo@mymarket.app, platform owners, or accounts younger than --min-age minutes (default 30).
 */
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error("[cleanup] set DATABASE_URL");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const minAge = Number(process.argv.find((a) => a.startsWith("--min-age="))?.split("=")[1] ?? 30);

async function main(dbUrl: string) {
  const res = await cleanupTestAccounts(createDb(dbUrl), { dryRun, minAgeMinutes: Number.isFinite(minAge) ? minAge : 30 });
  console.log(`[cleanup]${dryRun ? " (dry run)" : ""} test accounts: ${res.users.length}, demo-store test orders: ${res.demoOrders}, admin audit rows: ${res.adminAudit}`);
  for (const e of res.users) console.log(`  - ${e}`);
}

main(url).then(
  () => process.exit(0),
  (err) => {
    console.error("[cleanup] failed", err);
    process.exit(1);
  },
);
