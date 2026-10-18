import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveStorageConfig, type StorageEnv } from "@/server/storage/config";
import { BrevoEmailProvider, ConsoleEmailProvider, ResendEmailProvider, resolveEmailConfig, selectEmailProvider } from "@/server/email";
import { publicStoreUrl, resolveDomainConfig, storeSlugFromHost } from "@/lib/domains";
import { CRON_ROUTES, cronPingerUrls } from "@/lib/cron-routes";
import { integrationStatus } from "@/server/integrations";

const launch = readFileSync("docs/LAUNCH.md", "utf8");
const base: StorageEnv = { UPLOAD_DIR: "./uploads", S3_REGION: "auto" };
const r2Alias: StorageEnv = { ...base, R2_ACCOUNT_ID: "acc1", R2_BUCKET: "imgs", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_PUBLIC_URL: "https://img.example.app" };
const sb = { SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "srk" };

describe("storage: R2 env aliases + fallback", () => {
  it("R2_* alone selects the S3 driver with the derived R2 endpoint", () => {
    const c = resolveStorageConfig(r2Alias, { serverless: true });
    expect(c).toMatchObject({ driver: "s3", endpoint: "https://acc1.r2.cloudflarestorage.com", bucket: "imgs", publicUrl: "https://img.example.app" });
  });
  it("S3_* wins over R2_* when both are set", () => {
    const c = resolveStorageConfig({ ...r2Alias, S3_BUCKET: "other" });
    expect(c.driver === "s3" && c.bucket).toBe("other");
  });
  it("STORAGE_DRIVER=r2 is an alias of s3", () => {
    expect(resolveStorageConfig({ ...r2Alias, STORAGE_DRIVER: "r2" }).driver).toBe("s3");
  });
  it("forced r2 with incomplete keys falls back to Supabase when it is configured", () => {
    const c = resolveStorageConfig({ ...base, ...sb, STORAGE_DRIVER: "r2", R2_BUCKET: "imgs" }, { serverless: true });
    expect(c).toMatchObject({ driver: "supabase", fallbackFrom: "s3", url: "https://x.supabase.co", bucket: "uploads" });
  });
  it("forced r2 with incomplete keys and no Supabase still names what is missing", () => {
    expect(() => resolveStorageConfig({ ...base, STORAGE_DRIVER: "r2", R2_BUCKET: "imgs" })).toThrow(/S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL/);
  });
});

describe("email: EMAIL_PROVIDER / EMAIL_API_KEY", () => {
  const from = "Bazarga <hello@bazarga.app>";
  it("selects Resend or Brevo from the generic pair", () => {
    expect(selectEmailProvider({ EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_x", EMAIL_FROM: from })).toBeInstanceOf(ResendEmailProvider);
    expect(selectEmailProvider({ EMAIL_PROVIDER: "brevo", EMAIL_API_KEY: "xkeysib", EMAIL_FROM: from })).toBeInstanceOf(BrevoEmailProvider);
  });
  it("falls back to console without a key, and EMAIL_PROVIDER beats EMAIL_DRIVER", () => {
    expect(selectEmailProvider({ EMAIL_PROVIDER: "brevo", EMAIL_FROM: from })).toBeInstanceOf(ConsoleEmailProvider);
    expect(resolveEmailConfig({ EMAIL_PROVIDER: "brevo", EMAIL_DRIVER: "resend", EMAIL_API_KEY: "k", EMAIL_FROM: from }).driver).toBe("brevo");
    expect(resolveEmailConfig({ EMAIL_FROM: from }).driver).toBe("console");
  });
  it("posts to Resend over plain fetch (no SDK)", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await selectEmailProvider({ EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_x", EMAIL_FROM: from }).send({ to: "a@b.co", subject: "Hi", text: "Body" });
    } finally {
      globalThis.fetch = orig;
    }
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
  });
});

describe("custom domain gate", () => {
  it("is off with no ROOT_DOMAIN (no more mymarket.app default)", () => {
    const c = resolveDomainConfig({});
    expect(c).toEqual({ rootDomain: null, subdomains: false });
    expect(storeSlugFromHost("shop.mymarket.app", c)).toBeNull();
    expect(publicStoreUrl("shop", "https://bazarga.vercel.app/", c)).toBe("https://bazarga.vercel.app/s/shop");
  });
  it("routes one-label subdomains when ROOT_DOMAIN is set, never reserved or nested ones", () => {
    const c = resolveDomainConfig({ ROOT_DOMAIN: "https://Bazarga.app/" });
    expect(c).toEqual({ rootDomain: "bazarga.app", subdomains: true });
    expect(storeSlugFromHost("hawler-bazaar.bazarga.app:443", c)).toBe("hawler-bazaar");
    expect(storeSlugFromHost("www.bazarga.app", c)).toBeNull();
    expect(storeSlugFromHost("a.b.bazarga.app", c)).toBeNull();
    expect(storeSlugFromHost("bazarga.app", c)).toBeNull();
    expect(publicStoreUrl("hawler-bazaar", "https://x", c)).toBe("https://hawler-bazaar.bazarga.app");
  });
  it("STORE_SUBDOMAINS=false is a kill switch; junk ROOT_DOMAIN stays off", () => {
    expect(resolveDomainConfig({ ROOT_DOMAIN: "bazarga.app", STORE_SUBDOMAINS: "false" }).subdomains).toBe(false);
    expect(resolveDomainConfig({ ROOT_DOMAIN: "not a domain" }).rootDomain).toBeNull();
  });
});

describe("cron routes", () => {
  it("every route in the list exists, checks CRON_SECRET, and is documented with its pinger URL", () => {
    for (const r of CRON_ROUTES) {
      const src = readFileSync(`src/app${r.path}/route.ts`, "utf8");
      expect(src).toContain("CRON_SECRET");
      expect(src).toContain("isCronAuthorized");
      expect(launch).toContain(`https://bazarga.vercel.app${r.path}`);
    }
    expect(cronPingerUrls("https://bazarga.vercel.app/")).toEqual(CRON_ROUTES.map((r) => `https://bazarga.vercel.app${r.path}`));
  });
  it("vercel.json schedules the daily route", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string }[] };
    expect(v.crons.map((c) => c.path)).toContain("/api/cron/daily");
  });
});

describe("integration status (/api/health)", () => {
  it("reports drivers and booleans only, never values", () => {
    const s = integrationStatus({ ...r2Alias, EMAIL_FROM: "x <a@b.co>", EMAIL_PROVIDER: "resend", CRON_SECRET: "c".repeat(20), ROOT_DOMAIN: "bazarga.app" }, { serverless: true });
    expect(s).toEqual({ storage: { driver: "s3" }, email: { driver: "console", keyMissing: true }, cron: true, subdomains: true, push: false, ai: false });
    expect(JSON.stringify(s)).not.toMatch(/imgs|acc1|bazarga\.app|ccccc/);
  });
  it("flags misconfigured storage instead of throwing", () => {
    expect(integrationStatus({ ...base, EMAIL_FROM: "a@b.co" }, { serverless: true }).storage).toEqual({ driver: "misconfigured" });
  });
  it("documents every env name in docs/LAUNCH.md", () => {
    for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_URL", "EMAIL_PROVIDER", "EMAIL_API_KEY", "EMAIL_FROM", "CRON_SECRET", "ROOT_DOMAIN", "STORE_SUBDOMAINS"]) {
      expect(launch).toContain(k);
    }
  });
});
