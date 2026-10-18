import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// .env.example is the buyer's map of every setting (docs/SETUP.md). Keep it complete.
const example = readFileSync(".env.example", "utf8");
const listed = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));

describe(".env.example", () => {
  it("lists every variable in the env.ts schema", () => {
    const schema = readFileSync("src/server/env.ts", "utf8");
    const keys = [...schema.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]).filter((k) => k !== "NODE_ENV");
    expect(keys.length).toBeGreaterThan(50);
    expect(keys.filter((k) => !listed.has(k))).toEqual([]);
  });
  it("lists the variables read outside the schema (payments, db, seed, integrations)", () => {
    const extra = ["PAYMENTS_PROVIDER", "RASEDI_KEY_ID", "RASEDI_PRIVATE_KEY", "RASEDI_WEBHOOK_SECRET", "RASEDI_MODE", "USD_IQD_RATE",
      "PLATFORM_COMMISSION_BPS", "DATABASE_POOL_MAX", "DATABASE_SSL_REJECT_UNAUTHORIZED", "DATABASE_URL_UNPOOLED", "POSTGRES_URL",
      "POSTGRES_URL_NON_POOLING", "SEED_DEMO", "SEED_DEMO_EMAIL", "SEED_DEMO_PASSWORD", "DB_QUERY_STATS", "CRON_SECRET", "ADMIN_EMAILS"];
    expect(extra.filter((k) => !listed.has(k))).toEqual([]);
  });
  it("vercel.json builds with migrations + seed so a fresh Deploy-button project works", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8")) as { buildCommand?: string };
    expect(v.buildCommand).toBe("npm run db:migrate:deploy && npm run db:seed && npm run build");
  });
});
