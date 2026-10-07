/*
 * Apply SQL migrations in ./drizzle.
 *
 *   npm run db:migrate          → DATABASE_URL (postgres:// or pglite://; defaults to ./.pglite)
 *   npm run db:migrate:deploy   → production deploy step: prefers DATABASE_URL_UNPOOLED (Neon's direct,
 *                                 non-PgBouncer host — migrations take advisory locks / run DDL in a transaction,
 *                                 which belongs on a direct connection), falls back to DATABASE_URL, and refuses
 *                                 to run against an embedded PGlite database or with no URL at all.
 */
import { createDb } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { redactDbUrl } from "../src/server/db/pg-config";

async function main() {
  const deploy = process.argv.includes("--deploy");
  const url = deploy
    ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    : process.env.DATABASE_URL || "pglite://./.pglite";
  if (!url) throw new Error("db:migrate:deploy needs DATABASE_URL (or DATABASE_URL_UNPOOLED)");
  if (deploy && !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("db:migrate:deploy only runs against a real Postgres (postgres:// URL), not PGlite");
  }
  const database = createDb(url);
  console.log(`[migrate] applying migrations to ${redactDbUrl(url)}`);
  await runMigrations(database, url);
  console.log("[migrate] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
