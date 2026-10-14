import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products, stores } from "@/server/db/schema";
import { assertWithinProductLimit, getProductUsage } from "@/server/services/catalog";
import { consumeStudioEdit, getStudioUsage, refundStudioEdit, studioPeriod } from "@/server/services/studio-quota";
import { activateRequest, createUpgradeRequest } from "@/server/services/upgrades";
import { PRODUCT_CAP } from "@/lib/plans";
import { product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

const setPlan = (id: string, plan: string) => database.update(stores).set({ plan }).where(eq(stores.id, id));

/** Bulk-insert `n` bare products straight into the table (fast; the cap check is what is under test). */
async function fill(storeId: string, n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ storeId, name: { en: `P${i}` }, price: 1000 }));
  for (let i = 0; i < rows.length; i += 500) await database.insert(products).values(rows.slice(i, i + 500));
}

describe("product limits (server-side)", () => {
  it("Free: the 11th product is refused with plan_limit_products", async () => {
    const s = await seller(database, "lim-free");
    for (let i = 0; i < 10; i++) await product(database, s.store.id, 1000);
    expect(await getProductUsage(database, s.store.id)).toMatchObject({ plan: "free", used: 10, cap: 10, shown: 10 });
    await expect(product(database, s.store.id, 1000)).rejects.toThrow("plan_limit_products");
  });

  it("Pro: 100 products, then refused; upgrading lifts it", async () => {
    const s = await seller(database, "lim-pro");
    await setPlan(s.store.id, "pro");
    await fill(s.store.id, 100);
    await expect(assertWithinProductLimit(database, s.store.id)).rejects.toThrow("plan_limit_products");
    await setPlan(s.store.id, "business");
    await expect(assertWithinProductLimit(database, s.store.id)).resolves.toBeUndefined();
    expect((await getProductUsage(database, s.store.id)).shown).toBeNull();
  });

  it("Business: hidden cap 1000, shown as unlimited", async () => {
    const s = await seller(database, "lim-biz");
    await setPlan(s.store.id, "business");
    await fill(s.store.id, PRODUCT_CAP.business);
    const u = await getProductUsage(database, s.store.id);
    expect(u).toMatchObject({ plan: "business", used: 1000, cap: 1000, shown: null });
    await expect(assertWithinProductLimit(database, s.store.id)).rejects.toThrow("plan_limit_products");
    await setPlan(s.store.id, "max");
    await expect(assertWithinProductLimit(database, s.store.id)).resolves.toBeUndefined();
    expect((await getProductUsage(database, s.store.id)).cap).toBe(10000);
  });

  it("new stores default to free", async () => {
    const { store } = await seller(database, "plan-def");
    const row = await database.query.stores.findFirst({ where: eq(stores.id, store.id) });
    expect(row!.plan).toBe("free");
  });

  it("unknown plan strings fall back to Free limits", async () => {
    const s = await seller(database, "lim-unknown");
    await setPlan(s.store.id, "enterprise");
    expect((await getProductUsage(database, s.store.id)).cap).toBe(10);
  });
});

describe("Product Studio monthly quota", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("period is the Baghdad calendar month (UTC+3)", () => {
    expect(studioPeriod(now)).toBe("2026-10");
    expect(studioPeriod(new Date("2026-10-31T20:59:00Z"))).toBe("2026-10");
    expect(studioPeriod(new Date("2026-10-31T21:00:00Z"))).toBe("2026-11");
    expect(studioPeriod(new Date("2026-12-31T21:30:00Z"))).toBe("2027-01");
  });

  it("Free has no edits", async () => {
    const s = await seller(database, "q-free");
    expect(await getStudioUsage(database, s.store.id, now)).toMatchObject({ used: 0, limit: 0, remaining: 0 });
    await expect(consumeStudioEdit(database, s.store.id, now)).rejects.toThrow("plan_limit_studio");
  });

  it("Pro: 10 edits a month, the 11th is refused, a refund gives one back, next month resets", async () => {
    const s = await seller(database, "q-pro");
    await setPlan(s.store.id, "pro");
    for (let i = 1; i <= 10; i++) expect((await consumeStudioEdit(database, s.store.id, now)).used).toBe(i);
    await expect(consumeStudioEdit(database, s.store.id, now)).rejects.toThrow("plan_limit_studio");
    expect(await getStudioUsage(database, s.store.id, now)).toMatchObject({ used: 10, limit: 10, remaining: 0 });
    await refundStudioEdit(database, s.store.id, now);
    expect((await getStudioUsage(database, s.store.id, now)).remaining).toBe(1);
    await consumeStudioEdit(database, s.store.id, now);
    const next = new Date("2026-11-02T09:00:00Z");
    expect(await getStudioUsage(database, s.store.id, next)).toMatchObject({ period: "2026-11", used: 0, remaining: 10 });
  });

  it("concurrent edits never overshoot the quota", async () => {
    const s = await seller(database, "q-race");
    await setPlan(s.store.id, "pro");
    const results = await Promise.allSettled(Array.from({ length: 15 }, () => consumeStudioEdit(database, s.store.id, now)));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(10);
    expect((await getStudioUsage(database, s.store.id, now)).used).toBe(10);
  });

  it("Business and Max get 100; refunds never go below zero", async () => {
    for (const plan of ["business", "max"]) {
      const s = await seller(database, `q-${plan}`);
      await setPlan(s.store.id, plan);
      expect((await getStudioUsage(database, s.store.id, now)).limit).toBe(100);
      await refundStudioEdit(database, s.store.id, now);
      expect((await consumeStudioEdit(database, s.store.id, now)).used).toBe(1);
      await refundStudioEdit(database, s.store.id, now);
      await refundStudioEdit(database, s.store.id, now);
      expect((await getStudioUsage(database, s.store.id, now)).used).toBe(0);
    }
  });
});

describe("upgrade requests accept Max", () => {
  it("a Max request activates the store on max", async () => {
    const s = await seller(database, "up-max");
    const r = await createUpgradeRequest(database, s.store.id, { plan: "max", months: 12, method: "cash" });
    await activateRequest(database, r.id, new Date("2026-10-14T00:00:00Z"));
    const st = await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) });
    expect(st!.plan).toBe("max");
    expect(st!.planPeriodEnd!.toISOString().slice(0, 10)).toBe("2027-10-14");
    await expect(createUpgradeRequest(database, s.store.id, { plan: "enterprise", months: 1, method: "cash" })).rejects.toThrow();
  });
});

describe("migration 0016 (product studio usage)", () => {
  it("is additive only and the last journal entry", async () => {
    const { readFileSync } = await import("node:fs");
    const sqlText = readFileSync("drizzle/0016_product_studio_usage.sql", "utf8");
    expect(sqlText).not.toMatch(/\bDROP\b|\bRENAME\b|ALTER COLUMN|\bTRUNCATE\b|\bDELETE FROM\b|^UPDATE\b/im);
    const j = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(j.entries.at(-1)).toMatchObject({ idx: 16, tag: "0016_product_studio_usage" });
  });
});
