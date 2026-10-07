import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "@/server/csp";
import { pgPoolConfig, redactDbUrl } from "@/server/db/pg-config";
import { resolveStorageConfig, type StorageEnv } from "@/server/storage/config";

describe("CSP", () => {
  it("uses a nonce + strict-dynamic for scripts and never 'unsafe-inline' scripts", () => {
    const csp = buildCsp({ nonce: "abc123==", isDev: false });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc123=='");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
  it("allows eval only in dev and can upgrade insecure requests", () => {
    expect(buildCsp({ nonce: "n", isDev: true })).toContain("'unsafe-eval'");
    expect(buildCsp({ nonce: "n", isDev: false, upgradeInsecureRequests: true })).toContain("upgrade-insecure-requests");
  });
  it("generates fresh, base64, 128-bit nonces", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("pgPoolConfig (Neon / managed Postgres)", () => {
  const neon =
    "postgresql://app:s3cret@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  it("verifies TLS for sslmode=require and strips libpq-only params", () => {
    const c = pgPoolConfig(neon, {});
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.enableChannelBinding).toBe(true);
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.connectionString).not.toContain("channel_binding");
    expect(c.connectionString).toContain("-pooler.eu-central-1.aws.neon.tech/neondb");
  });
  it("turns TLS on for Neon hosts even without sslmode", () => {
    const c = pgPoolConfig("postgres://u:p@ep-x.us-east-2.aws.neon.tech/db", {});
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
  });
  it("keeps plain TCP for local / docker Postgres and sslmode=disable", () => {
    expect(pgPoolConfig("postgres://u:p@db:5432/mymarket", {}).ssl).toBe(false);
    expect(pgPoolConfig("postgres://u:p@x.neon.tech/db?sslmode=disable", {}).ssl).toBe(false);
  });
  it("allows opting out of certificate verification explicitly", () => {
    const c = pgPoolConfig("postgres://u:p@h/db?sslmode=require", { DATABASE_SSL_REJECT_UNAUTHORIZED: "false" });
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
  });
  it("uses a small pool on Vercel unless DATABASE_POOL_MAX is set", () => {
    expect(pgPoolConfig(neon, { VERCEL: "1" }).max).toBe(3);
    expect(pgPoolConfig(neon, { VERCEL: "1", DATABASE_POOL_MAX: "5" }).max).toBe(5);
    expect(pgPoolConfig(neon, {}).max).toBe(10);
  });
  it("redacts passwords in logs", () => {
    expect(redactDbUrl(neon)).toContain("app:***@");
    expect(redactDbUrl(neon)).not.toContain("s3cret");
  });
});

describe("resolveStorageConfig (R2 / local)", () => {
  const base: StorageEnv = { UPLOAD_DIR: "./uploads", S3_REGION: "auto" };
  const r2: StorageEnv = {
    ...base,
    R2_ACCOUNT_ID: "acc123",
    S3_BUCKET: "mymarket",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_PUBLIC_URL: "https://img.example.com",
  };

  it("falls back to local disk in dev when no bucket is configured", () => {
    expect(resolveStorageConfig(base)).toEqual({ driver: "local", uploadDir: "./uploads" });
  });
  it("switches to R2 automatically when the bucket config is complete", () => {
    const c = resolveStorageConfig(r2);
    expect(c.driver).toBe("s3");
    if (c.driver === "s3") {
      expect(c.endpoint).toBe("https://acc123.r2.cloudflarestorage.com");
      expect(c.region).toBe("auto");
      expect(c.bucket).toBe("mymarket");
    }
  });
  it("prefers an explicit S3_ENDPOINT and respects STORAGE_DRIVER=local", () => {
    const c = resolveStorageConfig({ ...r2, S3_ENDPOINT: "https://minio.local:9000" });
    expect(c.driver === "s3" && c.endpoint).toBe("https://minio.local:9000");
    expect(resolveStorageConfig({ ...r2, STORAGE_DRIVER: "local" }).driver).toBe("local");
  });
  it("names missing values when s3 is forced", () => {
    expect(() => resolveStorageConfig({ ...base, STORAGE_DRIVER: "s3", S3_BUCKET: "b" })).toThrow(
      /S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL/,
    );
  });
  it("refuses local disk on serverless hosts", () => {
    expect(() => resolveStorageConfig(base, { serverless: true })).toThrow(/serverless/);
    expect(resolveStorageConfig(r2, { serverless: true }).driver).toBe("s3");
  });
});
