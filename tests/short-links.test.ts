import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products } from "@/server/db/schema";
import { resolveShortCode } from "@/server/services/short-links";
import { shortCodeSchema, shortLinkTarget, shortLinkUrl } from "@/lib/short-link";
import { product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });

describe("short product links", () => {
  it("every product gets a unique 8-char code from the database", async () => {
    const s = await seller(database, "short-a");
    const a = await product(database, s.store.id, 1000);
    const b = await product(database, s.store.id, 2000);
    const rows = await database.select({ code: products.shortCode }).from(products).where(eq(products.storeId, s.store.id));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(shortCodeSchema.safeParse(r.code).success).toBe(true);
    expect(new Set(rows.map((r) => r.code)).size).toBe(2);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
  });

  it("resolves a code to the store slug and product id, case-insensitively", async () => {
    const s = await seller(database, "short-b");
    const p = await product(database, s.store.id, 1500);
    const [row] = await database.select({ code: products.shortCode, id: products.id }).from(products).where(eq(products.storeId, s.store.id));
    expect(p).toBeTruthy();
    expect(await resolveShortCode(database, row!.code)).toEqual({ slug: s.store.slug, productId: row!.id });
    expect(await resolveShortCode(database, row!.code.toUpperCase())).toEqual({ slug: s.store.slug, productId: row!.id });
  });

  it("hides inactive products and refuses junk codes", async () => {
    const s = await seller(database, "short-c");
    await product(database, s.store.id, 900);
    const [row] = await database.select({ code: products.shortCode }).from(products).where(eq(products.storeId, s.store.id));
    await database.update(products).set({ isActive: false }).where(eq(products.storeId, s.store.id));
    expect(await resolveShortCode(database, row!.code)).toBeNull();
    expect(await resolveShortCode(database, "../etc/passwd")).toBeNull();
    expect(await resolveShortCode(database, "x")).toBeNull();
    expect(await resolveShortCode(database, "nope1234")).toBeNull();
  });

  it("builds short URLs and keeps the query (?src) on redirect", () => {
    expect(shortLinkUrl("https://bazarga.vercel.app/", "ab12cd34")).toBe("https://bazarga.vercel.app/p/ab12cd34");
    expect(shortLinkUrl("https://bazarga.vercel.app", "ab12cd34", "tiktok")).toBe("https://bazarga.vercel.app/p/ab12cd34?src=tiktok");
    expect(shortLinkTarget("shop", "id1", "?src=tiktok&x=1")).toBe("/s/shop/p/id1?src=tiktok&x=1");
    expect(shortLinkTarget("shop", "id1", "")).toBe("/s/shop/p/id1");
  });
});
