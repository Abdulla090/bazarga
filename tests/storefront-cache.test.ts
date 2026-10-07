import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// next/cache only works inside a Next request; record what the data layer asks it to do instead.
const calls = vi.hoisted(() => ({ tags: [] as string[][], revalidated: [] as [string, unknown][], lives: [] as unknown[] }));
vi.mock("next/cache", () => ({
  cacheTag: (...t: string[]) => calls.tags.push(t),
  cacheLife: (l: unknown) => calls.lives.push(l),
  revalidateTag: (t: string, p: unknown) => calls.revalidated.push([t, p]),
  revalidatePath: () => {},
}));

import type { Db } from "@/server/db";
import { productOptionValues, productOptions, productVariants, stores } from "@/server/db/schema";
import { queryCount } from "@/server/db/query-stats";
import { cacheTags, invalidateCatalog, invalidateStock, invalidateStore } from "@/server/cache/tags";
import { getCatalog, getProductDetail, getStorefrontSettings, getStorefrontStore } from "@/server/cache/storefront";
import { loadCatalog, loadProductDetail, loadStorefrontSettings } from "@/server/services/storefront";
import { product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});
beforeEach(() => {
  calls.tags.length = 0;
  calls.revalidated.length = 0;
  calls.lives.length = 0;
});

async function withVariants(storeId: string, base: number, stocks: (number | null)[], prices: (number | null)[] = []) {
  const p = await product(database, storeId, base, null);
  const [opt] = await database.insert(productOptions).values({ productId: p.id, storeId, name: { en: "Size" } }).returning();
  const vals = await database
    .insert(productOptionValues)
    .values(stocks.map((_, i) => ({ optionId: opt!.id, productId: p.id, storeId, label: { en: `S${i}` }, sort: i })))
    .returning();
  const vars = await database
    .insert(productVariants)
    .values(vals.map((v, i) => ({ productId: p.id, storeId, optionValueIds: [v.id], stock: stocks[i]!, price: prices[i] ?? null, sort: i })))
    .returning();
  return { p, vars, vals };
}

describe("storefront cache: tags", () => {
  it("tags each cached read per store / product", async () => {
    const { store } = await seller(database, "tag");
    const p = await product(database, store.id, 5_000);

    const s = await getStorefrontStore(store.slug);
    expect(s?.id).toBe(store.id);
    expect(calls.tags.flat()).toEqual([cacheTags.storeSlug(store.slug), cacheTags.store(store.id)]);

    calls.tags.length = 0;
    expect(await getStorefrontStore("no-such-store-xyz")).toBeNull();
    // A miss is cached by slug only, so creating that store later can clear it.
    expect(calls.tags.flat()).toEqual([cacheTags.storeSlug("no-such-store-xyz")]);

    calls.tags.length = 0;
    await getStorefrontSettings(store.id);
    await getCatalog(store.id);
    await getProductDetail(store.id, p.id);
    expect(calls.tags).toEqual([
      [cacheTags.store(store.id)],
      [cacheTags.catalog(store.id)],
      [cacheTags.catalog(store.id), cacheTags.product(p.id)],
    ]);
    expect(new Set(calls.lives)).toEqual(new Set(["storefront"]));
  });

  it("invalidates with immediate expiry (no stale read after a seller save or a sale)", () => {
    invalidateStore("s1", ["old-slug", "new-slug", null]);
    invalidateCatalog("s1", ["p1", undefined]);
    invalidateStock("s1", ["p2", "p2"]);
    expect(calls.revalidated).toEqual([
      ["store:s1", { expire: 0 }],
      ["store-slug:old-slug", { expire: 0 }],
      ["store-slug:new-slug", { expire: 0 }],
      ["catalog:s1", { expire: 0 }],
      ["product:p1", { expire: 0 }],
      ["catalog:s1", { expire: 0 }],
      ["product:p2", { expire: 0 }],
    ]);
  });

  it("every seller write that changes what shoppers see invalidates the storefront cache", () => {
    const src = readFileSync("src/server/actions/dashboard.ts", "utf8");
    const bodies = src.split(/\nexport async function /).slice(1);
    const storefrontWrites =
      /\b(createStore|updateStore|updateStoreTheme|updateStoreCover|setFreeDeliveryThreshold|createProduct|updateProduct|setProductActive|deleteProduct|createCategory|updateCategory|deleteCategory|updateZoneFee|upsertZone|deleteZone|setPaymentMethod|updateZoneEta)\(/;
    const offenders = bodies
      .filter((b) => storefrontWrites.test(b) && !/invalidate(Store|Catalog|Stock)\(/.test(b))
      .map((b) => b.slice(0, b.indexOf("(")));
    expect(offenders).toEqual([]);
    // Restocking status changes and checkout both touch stock.
    expect(src).toMatch(/RESTOCK_ON\.includes\(input\.status\)\) invalidateCatalog/);
    expect(readFileSync("src/server/actions/storefront.ts", "utf8")).toMatch(/invalidateStock\(store\.id, order\.items/);
  });
});

describe("storefront read models", () => {
  it("catalog: one row per active product with cover, used categories and variant price/stock rollups", async () => {
    const { store } = await seller(database, "cat");
    const simple = await product(database, store.id, 10_000, 3);
    const { p: dress } = await withVariants(store.id, 80_000, [0, 4, null], [null, 75_000, 95_000]);
    const { p: gone } = await withVariants(store.id, 20_000, [0, 0]);
    const before = queryCount();
    const cat = await loadCatalog(database, store.id);
    expect(queryCount() - before).toBeLessThanOrEqual(4);
    const by = (id: string) => cat.products.find((x) => x.id === id)!;
    expect(by(simple.id)).toMatchObject({ price: 10_000, lowStock: 3, soldOut: false, hasVariants: false });
    // Out-of-stock variants don't set the "from" price; an untracked variant means no low-stock badge.
    expect(by(dress.id)).toMatchObject({ price: 75_000, priceMax: 95_000, soldOut: false, hasVariants: true, lowStock: null });
    expect(by(gone.id)).toMatchObject({ soldOut: true });
  });

  it("product detail: options, values and effective variant prices", async () => {
    const { store } = await seller(database, "det");
    const { p, vars } = await withVariants(store.id, 50_000, [2, 0], [null, 55_000]);
    const before = queryCount();
    const d = (await loadProductDetail(database, store.id, p.id))!;
    expect(queryCount() - before).toBeLessThanOrEqual(5);
    expect(d.options).toHaveLength(1);
    expect(d.options[0]!.values.map((v) => v.label.en)).toEqual(["S0", "S1"]);
    expect(d.variants.map((v) => [v.id, v.price, v.stock])).toEqual([
      [vars[0]!.id, 50_000, 2],
      [vars[1]!.id, 55_000, 0],
    ]);
    // Another store's id never resolves.
    const other = await seller(database, "det2");
    expect(await loadProductDetail(database, other.store.id, p.id)).toBeNull();
  });

  it("settings: active zones with areas and enabled payment methods only", async () => {
    const { store } = await seller(database, "set");
    const s = await loadStorefrontSettings(database, store.id);
    expect(s.payments).toEqual(["cod"]);
    expect(s.zones.length).toBeGreaterThan(5);
    await database.update(stores).set({ isActive: false }).where(eq(stores.id, store.id));
    expect(await getStorefrontStore(store.slug)).toBeNull();
  });
});
