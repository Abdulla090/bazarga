import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "../env";

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * One handle per process, shared through globalThis: Next bundles route handlers and pages separately, and dev
 * HMR re-evaluates modules — without this each bundle would open its own pool (or, worse, its own PGlite
 * instance on the same data directory, which is not coherent across instances).
 */
const g = globalThis as unknown as { __mmDb?: Db };

/**
 * Create a database handle from a URL.
 * - `postgres://` / `postgresql://` → node-postgres pool (production: VPS Postgres, Neon, Supabase…)
 * - `pglite://memory` → in-memory PGlite (tests)
 * - `pglite://./path` → file-backed PGlite (zero-setup local dev; single process only)
 */
export function createDb(url: string): Db {
  if (url.startsWith("pglite://")) {
    const target = url.slice("pglite://".length);
    const client = target === "memory" || target === "" ? new PGlite() : new PGlite(target);
    return drizzlePglite(client, { schema }) as unknown as Db;
  }
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
  return drizzlePg(pool, { schema }) as unknown as Db;
}

/** Process-wide database handle (lazy — never connects at import/build time). */
export function db(): Db {
  if (!g.__mmDb) g.__mmDb = createDb(env().DATABASE_URL);
  return g.__mmDb;
}

/** Tests inject an isolated PGlite database. */
export function setDb(next: Db | undefined) {
  g.__mmDb = next;
}
