import type { PoolConfig } from "pg";

/**
 * Turn a postgres:// URL into node-postgres Pool options (pure — unit tested).
 *
 * Neon / Supabase / any managed Postgres:
 *  - `sslmode=require|verify-ca|verify-full` (or a *.neon.tech host) → TLS with certificate verification. Neon and
 *    Supabase poolers present publicly-trusted certificates, so verification works out of the box. Set
 *    DATABASE_SSL_REJECT_UNAUTHORIZED=false only for a self-signed server you control.
 *  - `sslmode=disable` → plain TCP (docker-compose network).
 *  - `channel_binding=require` (Neon's default connection string) → SCRAM-SHA-256-PLUS.
 * The libpq-only params are removed from the string so pg's own (changing) sslmode parsing doesn't override this.
 *
 * Serverless (Vercel): every function instance has its own pool, so keep it tiny and let idle clients go fast.
 * Use Neon's *pooled* host (`-pooler` in the hostname, PgBouncer transaction mode) for the app.
 */
export function pgPoolConfig(url: string, envVars: Record<string, string | undefined> = process.env): PoolConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode")?.toLowerCase();
  const channelBinding = u.searchParams.get("channel_binding")?.toLowerCase();
  for (const p of ["sslmode", "channel_binding", "uselibpqcompat", "sslrootcert", "sslcert", "sslkey"]) {
    u.searchParams.delete(p);
  }

  const managedHost = /\.(neon\.tech|supabase\.(co|com)|pooler\.supabase\.com)$/i.test(u.hostname);
  const wantsSsl = sslmode
    ? ["require", "verify-ca", "verify-full", "prefer"].includes(sslmode)
    : managedHost;
  const rejectUnauthorized = envVars.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  const serverless = !!envVars.VERCEL || !!envVars.AWS_LAMBDA_FUNCTION_NAME;
  const max = Number(envVars.DATABASE_POOL_MAX ?? (serverless ? 3 : 10));

  return {
    connectionString: u.toString(),
    ssl: wantsSsl ? { rejectUnauthorized } : false,
    enableChannelBinding: channelBinding === "require" || channelBinding === "prefer",
    max: Number.isFinite(max) && max > 0 ? max : 10,
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    // Let a short-lived process (migrate/seed scripts, a frozen serverless instance) exit when the pool is idle.
    allowExitOnIdle: true,
  };
}

/** Hide the password when logging a connection string. */
export function redactDbUrl(url: string): string {
  return url.replace(/(\/\/[^:/@]+:)[^@]+@/, "$1***@");
}
