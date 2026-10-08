import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { discountCodes, orders, products } from "@/server/db/schema";
import {
  bestSellerStrip,
  isAdvertisable,
  isOnSale,
  isProductBadge,
  pickBannerOffer,
  rankBestSellers,
  saleProducts,
  savedAmount,
  type BannerCode,
} from "@/lib/merch";
import { filterCatalog } from "@/lib/catalog-filter";
import { discountCodeSchema, productSchema } from "@/lib/validation";
import { placeOrder, updateOrderStatus } from "@/server/services/orders";
import { loadCatalog, loadSales, loadStoreOffers } from "@/server/services/storefront";
import { createDiscountCode } from "@/server/services/discounts";
import { createProduct, updateProduct } from "@/server/services/catalog";
import { checkout, product, seller, testDb } from "./support/db";

describe("sale pricing", () => {
  it("on sale only with a compare-at price above the price (≥ 1% off)", () => {
    expect(isOnSale({ price: 25_000, compareAtPrice: 30_000 })).toBe(true);
    expect(isOnSale({ price: 30_000, compareAtPrice: 30_000 })).toBe(false);
    expect(isOnSale({ price: 30_000, compareAtPrice: null })).toBe(false);
    expect(isOnSale({ price: 29_900, compareAtPrice: 30_000 })).toBe(false);
    expect(savedAmount({ price: 25_000, compareAtPrice: 30_000 })).toBe(5_000);
    expect(savedAmount({ price: 25_000, compareAtPrice: null })).toBe(0);
  });

  it("saleProducts: biggest % off first, sold-out and full-price ones left out", () => {
    const list = [
      { id: "a", price: 90, compareAtPrice: 100, soldOut: false }, // 10%
      { id: "b", price: 50, compareAtPrice: 100, soldOut: false }, // 50%
      { id: "c", price: 50, compareAtPrice: 100, soldOut: true },
      { id: "d", price: 100, compareAtPrice: null, soldOut: false },
      { id: "e", price: 80, compareAtPrice: 100, soldOut: false }, // 20%
    ];
    expect(saleProducts(list).map((p) => p.id)).toEqual(["b", "e", "a"]);
  });

  it("offers filter keeps only discounted products", () => {
    const list = [
      { name: { en: "Honey" }, categoryId: null, price: 25_000, compareAtPrice: 30_000 },
      { name: { en: "Dress" }, categoryId: null, price: 85_000, compareAtPrice: null },
    ];
    const r = filterCatalog(list, { offers: true, locale: "en" });
    expect(r.items.map((p) => p.name.en)).toEqual(["Honey"]);
    expect(filterCatalog(list, { locale: "en" }).total).toBe(2);
  });

  it("badges: only new / featured; validation maps an empty select to none", () => {
    expect(isProductBadge("new")).toBe(true);
    expect(isProductBadge("hot")).toBe(false);
    const base = { name: { en: "x" }, price: 1000, imageUrls: [] };
    expect(productSchema.parse({ ...base, badge: "" }).badge).toBeNull();
    expect(productSchema.parse({ ...base, badge: "featured" }).badge).toBe("featured");
    expect(productSchema.safeParse({ ...base, badge: "hot" }).success).toBe(false);
  });
});

describe("best sellers ranking", () => {
  it("ranks by separate orders, then units, then id; badge only for top 3 with ≥ 2 orders", () => {
    const r = rankBestSellers([
      { productId: "p1", orders: 1, units: 9 },
      { productId: "p2", orders: 3, units: 3 },
      { productId: "p3", orders: 2, units: 5 },
      { productId: "p4", orders: 2, units: 2 },
      { productId: "p5", orders: 0, units: 0 },
    ]);
    expect(r.ranked).toEqual(["p2", "p3", "p4", "p1"]);
    expect(r.badged).toEqual(["p2", "p3", "p4"]);
    const single = rankBestSellers([{ productId: "p1", orders: 1, units: 3 }]);
    expect(single).toEqual({ ranked: ["p1"], badged: [] });
  });

  it("ignores products outside the active catalog and caps the list", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ productId: `p${String(i).padStart(2, "0")}`, orders: 12 - i, units: 1 }));
    const r = rankBestSellers(rows, new Set(rows.map((x) => x.productId).filter((id) => id !== "p00")));
    expect(r.ranked).toHaveLength(8);
    expect(r.ranked[0]).toBe("p01");
    expect(rankBestSellers([], null)).toEqual({ ranked: [], badged: [] });
  });

  it("strip hides below 2 products and skips sold-out ones", () => {
    const cat = [
      { id: "a", soldOut: false },
      { id: "b", soldOut: true },
      { id: "c", soldOut: false },
    ];
    expect(bestSellerStrip(cat, ["b", "a", "c"]).map((p) => p.id)).toEqual(["a", "c"]);
    expect(bestSellerStrip(cat, ["b", "a"])).toEqual([]);
    expect(bestSellerStrip(cat, [])).toEqual([]);
  });
});

describe("offer banner", () => {
  const code = (o: Partial<BannerCode>): BannerCode => ({
    code: "EID20",
    type: "percentage",
    value: 20,
    minSubtotal: 0,
    maxUses: null,
    usedCount: 0,
    isActive: true,
    showOnStorefront: true,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...o,
  });
  const now = new Date("2026-10-08T12:00:00Z");

  it("advertises only active, started, unexpired, not-used-up codes marked for the storefront", () => {
    expect(isAdvertisable(code({}), now)).toBe(true);
    expect(isAdvertisable(code({ showOnStorefront: false }), now)).toBe(false);
    expect(isAdvertisable(code({ isActive: false }), now)).toBe(false);
    expect(isAdvertisable(code({ startsAt: "2026-10-09T00:00:00Z" }), now)).toBe(false);
    expect(isAdvertisable(code({ endsAt: "2026-10-08T12:00:00Z" }), now)).toBe(false);
    expect(isAdvertisable(code({ maxUses: 5, usedCount: 5 }), now)).toBe(false);
    expect(isAdvertisable(code({ type: "fixed", value: 0 }), now)).toBe(false);
  });

  it("picks the newest advertisable code, or none", () => {
    const old = code({ code: "OLD", createdAt: "2026-09-01T00:00:00Z" });
    const fresh = code({ code: "NEW", type: "fixed", value: 5_000, minSubtotal: 30_000, createdAt: "2026-10-05T00:00:00Z" });
    const expired = code({ code: "GONE", createdAt: "2026-10-07T00:00:00Z", endsAt: "2026-10-07T12:00:00Z" });
    expect(pickBannerOffer([old, fresh, expired], now)).toEqual({ code: "NEW", type: "fixed", value: 5_000, minSubtotal: 30_000, endsAt: null });
    expect(pickBannerOffer([expired], now)).toBeNull();
    expect(pickBannerOffer([], now)).toBeNull();
  });

  it("dashboard form: 'show on my store' checkbox parses, defaults off", () => {
    const base = { code: "eid20", type: "percentage", value: "20", minSubtotal: "", maxUses: "", startsOn: "", endsOn: "", isActive: true };
    expect(discountCodeSchema.parse(base).showOnStorefront).toBe(false);
    expect(discountCodeSchema.parse({ ...base, showOnStorefront: true }).showOnStorefront).toBe(true);
  });
});

describe("storefront merchandising (DB)", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("best sellers come from real orders in the last 30 days; cancelled / old / other stores don't count", async () => {
    const { store, user } = await seller(database, "bs");
    const a = await product(database, store.id, 10_000, null);
    const b = await product(database, store.id, 12_000, null);
    const c = await product(database, store.id, 14_000, null);
    const other = await seller(database, "bsx");
    const ox = await product(database, other.store.id, 5_000, null);

    // Nothing sold yet: no ranking, no badges.
    expect((await loadCatalog(database, store.id)).bestSellers).toEqual([]);

    let n = 0;
    const order = (productId: string, quantity = 1) =>
      placeOrder(database, store, checkout([{ productId, quantity }], { phone: `+96477011120${String(++n).padStart(2, "0")}` }));
    await order(a.id);
    await order(a.id, 3);
    await order(b.id);
    await order(b.id);
    const cancelled1 = await order(c.id, 5);
    const cancelled2 = await order(c.id, 5);
    const cancelled3 = await order(c.id, 5);
    for (const o of [cancelled1, cancelled2, cancelled3]) await updateOrderStatus(database, store.id, o.id, "cancelled", user.id);
    const stale = await order(c.id);
    await database.update(orders).set({ createdAt: new Date(Date.now() - 45 * 86_400_000) }).where(eq(orders.id, stale.id));
    for (let i = 0; i < 4; i++) await placeOrder(database, other.store, checkout([{ productId: ox.id, quantity: 1 }], { phone: `+96477011130${i}` }));

    const sales = await loadSales(database, store.id);
    expect(sales.sort((x, y) => y.orders - x.orders)).toEqual(
      expect.arrayContaining([
        { productId: a.id, orders: 2, units: 4 },
        { productId: b.id, orders: 2, units: 2 },
      ]),
    );
    expect(sales.find((s) => s.productId === c.id)).toBeUndefined();

    const cat = await loadCatalog(database, store.id);
    expect(cat.bestSellers).toEqual([a.id, b.id]); // same orders → more units first
    expect(cat.products.filter((p) => p.bestSeller).map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    expect(cat.products.find((p) => p.id === c.id)!.bestSeller).toBe(false);
    expect((await loadCatalog(database, other.store.id)).bestSellers).toEqual([ox.id]);
  });

  it("seller badge and compare-at price round-trip to the catalog", async () => {
    const { store } = await seller(database, "bd");
    const p = await createProduct(database, store.id, {
      name: { en: "Scarf" },
      description: {},
      price: 35_000,
      compareAtPrice: 42_000,
      stock: null,
      categoryId: null,
      isActive: true,
      imageUrls: [],
      badge: "new",
    });
    let item = (await loadCatalog(database, store.id)).products.find((x) => x.id === p.id)!;
    expect(item).toMatchObject({ badge: "new", compareAtPrice: 42_000, price: 35_000 });
    await updateProduct(database, store.id, p.id, { name: { en: "Scarf" }, description: {}, price: 35_000, compareAtPrice: null, stock: null, categoryId: null, isActive: true, imageUrls: [], badge: null });
    item = (await loadCatalog(database, store.id)).products.find((x) => x.id === p.id)!;
    expect(item).toMatchObject({ badge: null, compareAtPrice: null });
    await expect(database.update(products).set({ badge: "hot" as never }).where(eq(products.id, p.id))).rejects.toThrow();
  });

  it("only codes marked 'show on my store' (and active) reach the storefront, per store", async () => {
    const { store } = await seller(database, "of");
    const x = await seller(database, "ofx");
    const input = (code: string, show: boolean) => discountCodeSchema.parse({ code, type: "percentage", value: "10", isActive: true, showOnStorefront: show });
    await createDiscountCode(database, store.id, input("PUBLIC10", true));
    await createDiscountCode(database, store.id, input("SECRET10", false));
    const off = await createDiscountCode(database, store.id, input("OFF10", true));
    await database.update(discountCodes).set({ isActive: false }).where(eq(discountCodes.id, off.id));
    await createDiscountCode(database, x.store.id, input("OTHER10", true));
    const offers = await loadStoreOffers(database, store.id);
    expect(offers.map((o) => o.code)).toEqual(["PUBLIC10"]);
    expect(typeof offers[0]!.createdAt).toBe("string");
    expect(pickBannerOffer(offers)?.code).toBe("PUBLIC10");
  });
});

describe("i18n + layout guards", () => {
  const keys = ["bestSeller", "bestSellers", "badgeNew", "badgeFeatured", "offers", "offersTitle", "seeAll", "allProducts", "noOffers", "offerPercent", "offerFixed", "offerFreeDelivery", "offerMin", "offerHowTo", "offerLabel", "youSave", "readMore", "readLess"];
  it.each(["ku", "ar", "en", "kmr"])("storefront merch strings exist in %s", (l) => {
    const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { store: Record<string, string> };
    for (const k of keys) expect(m.store[k], `${l}.store.${k}`).toBeTruthy();
    expect(m.store.offerPercent).toContain("{code}");
    expect(m.store.offerPercent).toContain("{pct}");
  });
  it.each(["ku", "ar", "en"])("dashboard strings exist in %s", (l) => {
    const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Record<string, Record<string, string>>;
    for (const k of ["badge", "badgeNone", "badgeNew", "badgeFeatured", "badgeHint"]) expect(m.products![k]).toBeTruthy();
    for (const k of ["showOnStorefront", "showOnStorefrontHint", "onStorefront"]) expect(m.discounts![k]).toBeTruthy();
  });
  it("product page puts the description before the option pickers", () => {
    const buy = readFileSync("src/components/store/ProductBuy.tsx", "utf8");
    expect(buy.indexOf("{info}")).toBeGreaterThan(buy.indexOf('data-testid="price"'));
    expect(buy.indexOf("{info}")).toBeLessThan(buy.indexOf("options.length > 0 &&"));
  });
});
