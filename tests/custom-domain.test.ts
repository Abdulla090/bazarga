import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import {
  DEFAULT_A_TARGET, DEFAULT_CNAME_TARGET, HostSlugCache, checkDns, dnsInstructions, domainTargets, isReservedDomain,
  maybeCustomHost, normalizeDomain, platformHostsFromEnv,
} from "@/lib/custom-domain";
import { FEATURE_MIN_PLAN, COMPARE, hasFeature } from "@/lib/plans";
import { addDomainToVercel, setCustomDomain, storeSlugForDomain, verifyCustomDomain, vercelApiOn } from "@/server/services/custom-domain";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });
const T = domainTargets({});
const dns = (cname: string[], a: string[]) => ({ cname: async () => cname, a: async () => a });

describe("custom domain helpers (SF7)", () => {
  it("normalizes and rejects bad hosts", () => {
    expect(normalizeDomain(" https://Shop.Brand.com/path?x ")).toBe("shop.brand.com");
    expect(normalizeDomain("brand.iq.")).toBe("brand.iq");
    expect(normalizeDomain("1.2.3.4")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });
  it("reserves platform and shared hosts", () => {
    expect(isReservedDomain("bazarga.vercel.app", [])).toBe(true);
    expect(isReservedDomain("x.reelcart.app", ["reelcart.app"])).toBe(true);
    expect(isReservedDomain("shop.brand.com", ["reelcart.app"])).toBe(false);
    expect(maybeCustomHost("bazarga.vercel.app", [])).toBe(false);
    expect(maybeCustomHost("127.0.0.1", [])).toBe(false);
    expect(maybeCustomHost("shop.brand.com", platformHostsFromEnv({ APP_URL: "https://reelcart.app" }))).toBe(true);
    expect(platformHostsFromEnv({ APP_URL: "https://a.com/x", VERCEL_URL: "b-123.vercel.app" })).toEqual(["a.com", "b-123.vercel.app"]);
  });
  it("gives CNAME for subdomains and A for apex", () => {
    expect(T).toEqual({ cname: DEFAULT_CNAME_TARGET, a: DEFAULT_A_TARGET });
    expect(dnsInstructions("shop.brand.com", T)).toEqual({ type: "CNAME", name: "shop", value: DEFAULT_CNAME_TARGET });
    expect(dnsInstructions("brand.com", T)).toEqual({ type: "A", name: "@", value: DEFAULT_A_TARGET });
    expect(domainTargets({ CUSTOM_DOMAIN_CNAME: "Edge.Host.Com.", CUSTOM_DOMAIN_A: "1.1.1.1" })).toEqual({ cname: "edge.host.com", a: "1.1.1.1" });
  });
  it("checks DNS by CNAME or A", async () => {
    expect((await checkDns("shop.brand.com", T, dns(["CNAME.vercel-dns.com."], []))).ok).toBe(true);
    expect((await checkDns("brand.com", T, dns([], [DEFAULT_A_TARGET]))).ok).toBe(true);
    const miss = await checkDns("brand.com", T, dns(["parked.example.net"], ["9.9.9.9"]));
    expect(miss).toEqual({ ok: false, found: ["CNAME parked.example.net", "A 9.9.9.9"] });
    const err = { cname: async () => { throw new Error("ENODATA"); }, a: async () => { throw new Error("ENOTFOUND"); } };
    expect(await checkDns("none.brand.com", T, err)).toEqual({ ok: false, found: [] });
  });
  it("caches hits and misses with TTLs", () => {
    const c = new HostSlugCache(1000, 100);
    c.set("a.com", "store-a", 0); c.set("b.com", null, 0);
    expect(c.get("a.com", 500)).toBe("store-a");
    expect(c.get("b.com", 50)).toBeNull();
    expect(c.get("b.com", 200)).toBeUndefined();
    expect(c.get("a.com", 2000)).toBeUndefined();
  });
  it("is a Business+ feature with no Soon tag", () => {
    expect(FEATURE_MIN_PLAN.domain).toBe("business");
    expect(hasFeature("pro", "domain")).toBe(false);
    expect(hasFeature("business", "domain")).toBe(true);
    expect(COMPARE.find((r) => r.key === "domain")).toMatchObject({ business: true, max: true });
  });
});

describe("custom domain service", () => {
  it("saves, rejects reserved/taken, verifies and resolves only when verified", async () => {
    const { store: a } = await seller(database, "doma");
    const { store: b } = await seller(database, "domb");
    await expect(setCustomDomain(database, a.id, "x.vercel.app", [])).rejects.toMatchObject({ message: "invalid_domain" });
    expect(await setCustomDomain(database, a.id, "Shop.Brand-A.com", [])).toBe("shop.brand-a.com");
    await expect(setCustomDomain(database, b.id, "shop.brand-a.com", [])).rejects.toMatchObject({ message: "domain_taken" });
    expect(await storeSlugForDomain(database, "shop.brand-a.com")).toBeNull();
    const bad = await verifyCustomDomain(database, a.id, T, dns([], ["9.9.9.9"]));
    expect(bad.ok).toBe(false);
    const good = await verifyCustomDomain(database, a.id, T, dns([DEFAULT_CNAME_TARGET], []));
    expect(good.ok).toBe(true);
    expect(await storeSlugForDomain(database, "SHOP.brand-a.com")).toBe(a.slug);
    // changing the domain resets verification; clearing removes it
    await setCustomDomain(database, a.id, "shop2.brand-a.com", []);
    expect(await storeSlugForDomain(database, "shop2.brand-a.com")).toBeNull();
    expect(await setCustomDomain(database, a.id, "", [])).toBeNull();
    const [row] = await database.select({ d: stores.customDomain, v: stores.customDomainVerifiedAt }).from(stores).where(eq(stores.id, a.id));
    expect(row).toEqual({ d: null, v: null });
  });
  it("calls the Vercel API only when token + project are set", async () => {
    let calls = 0;
    const f = (async () => { calls++; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    expect(vercelApiOn({})).toBe(false);
    expect(await addDomainToVercel("shop.brand.com", {}, f)).toBe("manual");
    expect(await addDomainToVercel("shop.brand.com", { token: "t" }, f)).toBe("manual");
    expect(calls).toBe(0);
    expect(await addDomainToVercel("shop.brand.com", { token: "t", projectId: "p" }, f)).toBe("added");
    expect(calls).toBe(1);
    const conflict = (async () => new Response(JSON.stringify({ error: { code: "domain_already_in_use" } }), { status: 409 })) as unknown as typeof fetch;
    expect(await addDomainToVercel("shop.brand.com", { token: "t", projectId: "p" }, conflict)).toBe("error");
  });
});
