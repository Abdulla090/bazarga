/* Apply SQL migrations in ./drizzle to DATABASE_URL (postgres:// or pglite://). */
import { createDb } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";

async function main() {
  const url = process.env.DATABASE_URL ?? "pglite://./.pglite";
  const database = createDb(url);
  console.log(`[migrate] applying migrations to ${url.replace(/:[^:@/]+@/, ":***@")}`);
  await runMigrations(database, url);
  console.log("[migrate] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
