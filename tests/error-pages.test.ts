import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ExistenceCache, decideNotFound, paymentsGatewayOn, slugExistsSchema } from "@/lib/not-found";
import { ERROR_TEXT, errorText } from "@/components/error-text";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const msgs = (l: string) => JSON.parse(read(`messages/${l}.json`)) as Record<string, Record<string, string>>;
const q = (s = "") => new URLSearchParams(s);

describe("proxy 404 decisions", () => {
  it("payments return is a 404 while payments are off, and for a malformed id when on", () => {
    expect(decideNotFound({ pathname: "/payments/return", search: q("p=00000000-0000-4000-8000-000000000000"), storeSlug: null, gatewayOn: false })).toEqual({ kind: "page" });
    expect(decideNotFound({ pathname: "/payments/return", search: q("p=nope"), storeSlug: null, gatewayOn: true })).toEqual({ kind: "page" });
    expect(decideNotFound({ pathname: "/payments/return", search: q("p=00000000-0000-4000-8000-000000000000"), storeSlug: null, gatewayOn: true })).toBeNull();
  });
  it("store slugs: invalid → store 404 immediately; valid → existence check", () => {
    expect(decideNotFound({ pathname: "/s/BAD!", search: q(), storeSlug: "BAD!", gatewayOn: false })).toEqual({ kind: "store" });
    expect(decideNotFound({ pathname: "/s/hawler-bazaar/p/x", search: q(), storeSlug: "hawler-bazaar", gatewayOn: false })).toEqual({ checkStore: "hawler-bazaar" });
  });
  it("/e404 itself is a 404; everything else passes", () => {
    expect(decideNotFound({ pathname: "/e404", search: q("k=store"), storeSlug: null, gatewayOn: false })).toEqual({ kind: "store" });
    expect(decideNotFound({ pathname: "/e404", search: q(), storeSlug: null, gatewayOn: false })).toEqual({ kind: "page" });
    for (const p of ["/", "/pricing", "/dashboard", "/login"]) expect(decideNotFound({ pathname: p, search: q(), storeSlug: null, gatewayOn: false })).toBeNull();
  });
  it("PAYMENTS_PROVIDER blank/none means off", () => {
    expect(paymentsGatewayOn(undefined)).toBe(false);
    expect(paymentsGatewayOn("")).toBe(false);
    expect(paymentsGatewayOn("none")).toBe(false);
    expect(paymentsGatewayOn("rasedi")).toBe(true);
  });
  it("slug rule matches the storefront loader", () => {
    expect(slugExistsSchema.safeParse("hawler-bazaar").success).toBe(true);
    expect(slugExistsSchema.safeParse("a").success).toBe(false);
    expect(slugExistsSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(read("src/app/s/[slug]/data.ts")).toContain("/^[a-z0-9-]{2,40}$/");
  });
});

describe("existence cache", () => {
  it("expires misses sooner than hits and stays bounded", () => {
    const c = new ExistenceCache(1000, 100, 3);
    c.set("a", true, 0);
    c.set("b", false, 0);
    expect(c.get("a", 500)).toBe(true);
    expect(c.get("b", 50)).toBe(false);
    expect(c.get("b", 200)).toBeUndefined();
    expect(c.get("a", 1500)).toBeUndefined();
    for (const s of ["x", "y", "z", "w"]) c.set(s, true, 0);
    expect(c.size).toBeLessThanOrEqual(3);
  });
});

describe("proxy wiring", () => {
  const proxy = read("src/proxy.ts");
  it("only answers browser document requests, never RSC/actions/api, and never loops", () => {
    expect(proxy).toContain("isDocumentRequest(req)");
    expect(proxy).toContain('req.headers.get("next-action")');
    expect(proxy).toContain("!req.headers.get(INTERNAL_404_HEADER)");
    expect(proxy).toContain("status: 404");
    expect(proxy).toContain('url.pathname !== "/e404"');
  });
  it("fails open (a lookup error never hides a real store)", () => {
    expect(proxy).toMatch(/catch \{\s*return true;/);
  });
});

describe("error page copy (4 locales)", () => {
  const keys = Object.keys(msgs("en").notFound!);
  it("notFound namespace exists with the same keys in ku/ar/en/kmr", () => {
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const l of ["ku", "ar", "kmr"]) expect(Object.keys(msgs(l).notFound ?? {}).sort()).toEqual([...keys].sort());
  });
  it("kmr is Latin script, ku/ar are Arabic script", () => {
    for (const v of Object.values(msgs("kmr").notFound!)) expect(v).not.toMatch(/[\u0600-\u06FF]/);
    for (const l of ["ku", "ar"]) expect(msgs(l).notFound!.title).toMatch(/[\u0600-\u06FF]/);
  });
  it("client error strings are in sync for ckb/ar/en/kmr and fall back to Sorani", () => {
    const k = Object.keys(ERROR_TEXT.en).sort();
    for (const l of ["ckb", "ar", "kmr"] as const) expect(Object.keys(ERROR_TEXT[l]).sort()).toEqual(k);
    expect(errorText("xx")).toBe(ERROR_TEXT.ckb);
    expect(errorText("en").retry).toBe("Try again");
  });
});

describe("brand + boundaries", () => {
  const files = [
    "src/app/global-error.tsx",
    "src/app/(marketing)/error.tsx",
    "src/app/(auth)/error.tsx",
    "src/app/not-found.tsx",
    "src/app/dashboard/error.tsx",
    "src/app/dashboard/not-found.tsx",
    "src/components/ErrorState.tsx",
    "src/components/ClientErrorState.tsx",
    "src/components/PlatformNotFound.tsx",
  ];
  it("every surface has an error boundary and a not-found", () => {
    for (const f of [...files, "src/app/s/[slug]/error.tsx", "src/app/s/[slug]/not-found.tsx", "src/instrumentation.ts"]) expect(read(f).length, f).toBeGreaterThan(50);
  });
  it("no orange/yellow anywhere in the error pages", () => {
    for (const f of files) expect(read(f), f).not.toMatch(/#F5B700|#F59E0B|#FBBF24|#EAB308|#F97316|orange|yellow|amber/i);
  });
  it("global-error renders its own html with the blue/ink palette and stays tiny (it ships on every route)", () => {
    const g = read("src/app/global-error.tsx");
    expect(g).toContain("<html");
    expect(g).toContain("#2563EB");
    expect(g).toContain("#0A0A0B");
    expect(g).not.toMatch(/^import /m);
  });
  it("no root error.tsx (it would ship in every storefront bundle); each area has its own boundary", () => {
    expect(() => read("src/app/error.tsx")).toThrow();
    for (const d of ["(marketing)", "(auth)", "onboarding", "admin", "payments", "dashboard", "s/[slug]"]) expect(read(`src/app/${d}/error.tsx`)).toContain("export default function");
  });
  it("server errors are logged as structured lines with their digest, without query strings", () => {
    const i = read("src/instrumentation.ts");
    expect(i).toContain("onRequestError");
    expect(i).toContain('logger.error("request.error"');
    expect(i).toContain('split("?")[0]');
  });
});
