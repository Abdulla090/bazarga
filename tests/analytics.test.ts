import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { orders, storePageViews } from "@/server/db/schema";
import {
  barHeights,
  buildFunnel,
  CHECKOUT_PAGE,
  conversionRate,
  dayRange,
  fillDays,
  HOME_PAGE,
  iraqDay,
  iraqDayStart,
  isBot,
  isPrefetch,
  parseRange,
  PRODUCT_VISITORS_PAGE,
  VISITORS_PAGE,
} from "@/lib/analytics";
import { firstSeen, _resetDedupe } from "@/server/analytics/dedupe";
import { getStoreAnalytics, recordView } from "@/server/services/analytics";
import { placeOrder, updateOrderStatus } from "@/server/services/orders";
import { checkout, product, seller, testDb } from "./support/db";

const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const hdrs = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("analytics helpers (pure)", () => {
  it("Iraqi days: UTC+3 boundaries", () => {
    expect(iraqDay(new Date("2026-10-07T20:59:59Z"))).toBe("2026-10-07");
    expect(iraqDay(new Date("2026-10-07T21:00:00Z"))).toBe("2026-10-08");
    expect(iraqDayStart("2026-10-08").toISOString()).toBe("2026-10-07T21:00:00.000Z");
    expect(dayRange(3, new Date("2026-10-08T12:00:00Z"))).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
    expect(dayRange(2, new Date("2026-03-01T00:30:00Z"))).toEqual(["2026-02-28", "2026-03-01"]);
  });
  it("range is 7, 30 or 90 (anything else → 7)", () => {
    expect(parseRange("30")).toBe(30);
    expect(parseRange(["90"])).toBe(90);
    expect(parseRange("365")).toBe(7);
    expect(parseRange(undefined)).toBe(7);
  });
  it("bots, link previews, scripts and prefetches are not views", () => {
    expect(isBot(CHROME)).toBe(false);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe(false);
    for (const ua of ["WhatsApp/2.23.20.0", "facebookexternalhit/1.1", "TelegramBot (like TwitterBot)", "Googlebot/2.1", "curl/8.5.0", "Mozilla/5.0 HeadlessChrome/120", "Chrome-Lighthouse", "", null])
      expect(isBot(ua), String(ua)).toBe(true);
    expect(isPrefetch(hdrs({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetch(hdrs({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetch(hdrs({}))).toBe(false);
  });
  it("conversion, day filling and bar heights", () => {
    expect(conversionRate(3, 0)).toBeNull();
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(2, 200)).toBe(1);
    const filled = fillDays(["2026-10-07", "2026-10-08"], [{ day: "2026-10-08", visitors: 2 }, { day: "2026-10-08", orders: 1, revenue: 5000 }, { day: "1999-01-01", visitors: 9 }]);
    expect(filled).toEqual([
      { day: "2026-10-07", visitors: 0, storeViews: 0, productViews: 0, orders: 0, revenue: 0 },
      { day: "2026-10-08", visitors: 2, storeViews: 0, productViews: 0, orders: 1, revenue: 5000 },
    ]);
    expect(barHeights([0, 5, 10])).toEqual([0, 50, 100]);
    expect(barHeights([0, 0])).toEqual([0, 0]);
  });
  it("de-duplication: once per key per day, resets on a new day, keeps no raw identifiers", () => {
    _resetDedupe();
    expect(firstSeen("2026-10-08", ["1.2.3.4", CHROME, "store", "home"])).toBe(true);
    expect(firstSeen("2026-10-08", ["1.2.3.4", CHROME, "store", "home"])).toBe(false);
    expect(firstSeen("2026-10-08", ["1.2.3.4", CHROME, "store", "p1"])).toBe(true);
    expect(firstSeen("2026-10-08", ["5.6.7.8", CHROME, "store", "home"])).toBe(true);
    expect(firstSeen("2026-10-09", ["1.2.3.4", CHROME, "store", "home"])).toBe(true);
    const src = readFileSync("src/server/analytics/dedupe.ts", "utf8");
    expect(src).toContain("createHash(\"sha256\")");
    expect(src).toMatch(/salt = randomBytes/);
  });
});

describe("funnel (pure)", () => {
  it("steps are unique visitors then orders, each as % of visitors", () => {
    expect(buildFunnel({ visitors: 200, product: 100, checkout: 40, orders: 10 })).toEqual([
      { key: "visitors", count: 200, pct: 100 },
      { key: "product", count: 100, pct: 50 },
      { key: "checkout", count: 40, pct: 20 },
      { key: "orders", count: 10, pct: 5 },
    ]);
  });
  it("never narrows the wrong way (blocked pixel, dedupe reset) and handles no traffic", () => {
    const f = buildFunnel({ visitors: 3, product: 1, checkout: 0, orders: 4 });
    expect(f.map((s) => s.count)).toEqual([4, 4, 4, 4]);
    expect(buildFunnel({ visitors: 0, product: 0, checkout: 0, orders: 0 }).every((s) => s.count === 0 && s.pct === null)).toBe(true);
  });
});

describe("store analytics (DB)", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("counts views per day/page, joins orders + revenue, top products and conversion", async () => {
    const { store, user } = await seller(database, "an1");
    const a = await product(database, store.id, 10_000, null);
    const b = await product(database, store.id, 4_000, null);
    const now = new Date();
    for (let i = 0; i < 4; i++) await recordView(database, store.id, HOME_PAGE, { newVisitor: true, now });
    await recordView(database, store.id, a.id, { newVisitor: false, now });
    await recordView(database, store.id, a.id, { newVisitor: false, now });
    await recordView(database, store.id, b.id, { newVisitor: false, now });
    const o1 = await placeOrder(database, store, checkout([{ productId: a.id, quantity: 2 }], { phone: "+9647701110001" }));
    await placeOrder(database, store, checkout([{ productId: b.id, quantity: 1 }], { phone: "+9647701110002" }));
    const lost = await placeOrder(database, store, checkout([{ productId: b.id, quantity: 5 }], { phone: "+9647701110003" }));
    await updateOrderStatus(database, store.id, lost.id, "cancelled", user.id);

    const r = await getStoreAnalytics(database, store.id, { days: 7, locale: "en", now });
    expect(r.days).toHaveLength(7);
    expect(r.totals).toMatchObject({ visitors: 4, storeViews: 4, productViews: 3, orders: 2, revenue: o1.total + (o1.total - 20_000 + 4_000) });
    expect(r.totals.conversion).toBe(50);
    const today = r.days[r.days.length - 1]!;
    expect(today).toMatchObject({ day: iraqDay(now), visitors: 4, orders: 2 });
    expect(r.topViewed.map((x) => [x.productId, x.views])).toEqual([[a.id, 2], [b.id, 1]]);
    expect(r.topSold[0]).toMatchObject({ productId: a.id, units: 2, revenue: 20_000 });
    expect(r.topSold.find((x) => x.productId === b.id)).toMatchObject({ units: 1 }); // the cancelled 5 are left out
    const rows = await database.select().from(storePageViews).where(eq(storePageViews.storeId, store.id));
    expect(rows.find((x) => x.page === VISITORS_PAGE)!.views).toBe(4);
  });

  it("orders are bucketed by Iraqi day and old ones fall outside the range", async () => {
    const { store } = await seller(database, "an2");
    const p = await product(database, store.id, 1_000, null);
    const now = new Date("2026-10-08T12:00:00Z");
    const late = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647701110011" }));
    const old = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }], { phone: "+9647701110012" }));
    // 22:30 UTC on Oct 6 is 01:30 on Oct 7 in Erbil.
    await database.update(orders).set({ createdAt: new Date("2026-10-06T22:30:00Z") }).where(eq(orders.id, late.id));
    await database.update(orders).set({ createdAt: new Date("2026-09-01T10:00:00Z") }).where(eq(orders.id, old.id));
    const r = await getStoreAnalytics(database, store.id, { days: 7, locale: "en", now });
    expect(r.days.find((d) => d.day === "2026-10-07")!.orders).toBe(1);
    expect(r.days.find((d) => d.day === "2026-10-06")!.orders).toBe(0);
    expect(r.totals.orders).toBe(1);
    expect(r.totals.conversion).toBeNull(); // no visitors recorded
  });

  it("sales by city and new vs returning customers", async () => {
    const { store, user } = await seller(database, "an4");
    const p = await product(database, store.id, 5_000, null);
    const now = new Date();
    const a1 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647702220001", cityKey: "erbil" }));
    const a2 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }], { phone: "+9647702220001", cityKey: "erbil", address: "Other street 5" }));
    const b = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647702220002", cityKey: "sulaymaniyah" }));
    // Customer 3 ordered 20 days ago (outside 7 days) and again today → returning; the old order is not in the range.
    const old = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647702220003", cityKey: "erbil", address: "Old street 1" }));
    await database.update(orders).set({ createdAt: new Date(now.getTime() - 20 * 86_400_000) }).where(eq(orders.id, old.id));
    const c = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647702220003", cityKey: "erbil", address: "New street 2" }));
    // Customer 4's only other order was cancelled → still a new customer. A cancelled order never counts in a city.
    const lost = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647702220004", cityKey: "duhok", address: "Gone street 3" }));
    await updateOrderStatus(database, store.id, lost.id, "cancelled", user.id);
    const d = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647702220004", cityKey: "erbil", address: "Last street 4" }));

    const r = await getStoreAnalytics(database, store.id, { days: 7, locale: "en", now });
    expect(r.customers).toEqual({ total: 4, returning: 2, new: 2 });
    expect(r.byCity.map((x) => x.cityKey)).toEqual(["erbil", "sulaymaniyah"]); // revenue order, no duhok, no old order
    expect(r.byCity[0]).toMatchObject({ orders: 4, revenue: a1.total + a2.total + c.total + d.total });
    expect(r.byCity[0]!.city).toBeTruthy();
    expect(r.byCity[1]).toMatchObject({ orders: 1, revenue: b.total });
    const month = await getStoreAnalytics(database, store.id, { days: 30, locale: "en", now });
    expect(month.byCity[0]!.orders).toBe(5);
  });

  it("funnel: product visitors + checkout visitors + orders over the range, per store", async () => {
    const { store } = await seller(database, "an4");
    const other = await seller(database, "an4o");
    const p = await product(database, store.id, 3_000, null);
    const now = new Date();
    for (let i = 0; i < 10; i++) await recordView(database, store.id, HOME_PAGE, { newVisitor: true, now });
    for (let i = 0; i < 6; i++) await recordView(database, store.id, p.id, { newVisitor: false, productVisitor: true, now });
    for (let i = 0; i < 3; i++) await recordView(database, store.id, CHECKOUT_PAGE, { newVisitor: false, now });
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647701110031" }));
    await recordView(database, other.store.id, CHECKOUT_PAGE, { newVisitor: true, productVisitor: true, now });
    const r = await getStoreAnalytics(database, store.id, { days: 7, locale: "en", now });
    expect(r.funnel.map((s) => [s.key, s.count])).toEqual([["visitors", 10], ["product", 6], ["checkout", 3], ["orders", 1]]);
    expect(r.funnel[1]!.pct).toBe(60);
    // The funnel counters are not product ids or visitor rows: they never leak into the other totals.
    expect(r.totals).toMatchObject({ visitors: 10, storeViews: 10, productViews: 6 });
    expect(r.topViewed.map((x) => x.productId)).toEqual([p.id]);
    const rows = await database.select().from(storePageViews).where(eq(storePageViews.storeId, store.id));
    expect(rows.find((x) => x.page === PRODUCT_VISITORS_PAGE)!.views).toBe(6);
    const o = await getStoreAnalytics(database, other.store.id, { days: 7, locale: "en", now });
    expect(o.funnel.map((s) => s.count)).toEqual([1, 1, 1, 0]);
  });

  it("tenant isolation: one store's views and orders never show in another's analytics", async () => {
    const x = await seller(database, "an3x");
    const y = await seller(database, "an3y");
    const px = await product(database, x.store.id, 2_000, null);
    await recordView(database, x.store.id, HOME_PAGE, { newVisitor: true });
    await recordView(database, x.store.id, px.id, { newVisitor: false });
    await placeOrder(database, x.store, checkout([{ productId: px.id, quantity: 1 }], { phone: "+9647701110021" }));
    const ry = await getStoreAnalytics(database, y.store.id, { days: 30, locale: "en" });
    expect(ry.totals).toEqual({ visitors: 0, storeViews: 0, productViews: 0, orders: 0, revenue: 0, conversion: null });
    expect(ry.topViewed).toEqual([]);
    expect(ry.topSold).toEqual([]);
    expect(ry.byCity).toEqual([]);
    expect(ry.customers).toEqual({ total: 0, returning: 0, new: 0 });
    // A product id of store X recorded under store Y (forged pixel) gets no name and is dropped from "most viewed".
    await recordView(database, y.store.id, px.id, { newVisitor: false });
    expect((await getStoreAnalytics(database, y.store.id, { days: 7, locale: "en" })).topViewed).toEqual([]);
  });
});

describe("analytics wiring", () => {
  it("migration 0007 only creates the aggregate table (no IP / user agent columns)", () => {
    const sql = readFileSync("drizzle/0007_store_analytics.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "store_page_views"');
    expect(sql).toMatch(/PRIMARY KEY\("store_id","day","page"\)/);
    expect(sql).not.toMatch(/ip|user_agent|DROP/i);
  });
  it("storefront pages render the same-origin pixel; no third-party tracker or client script", () => {
    const pixel = readFileSync("src/components/store/ViewPixel.tsx", "utf8");
    expect(pixel).not.toMatch(/"use client"|https?:\/\//);
    expect(pixel).toContain("/api/v/${slug}");
    expect(readFileSync("src/app/s/[slug]/page.tsx", "utf8")).toContain("<ViewPixel slug={store.slug} />");
    expect(readFileSync("src/app/s/[slug]/p/[productId]/page.tsx", "utf8")).toContain("<ViewPixel slug={store.slug} productId={p.id} />");
    const route = readFileSync("src/app/api/v/[slug]/route.ts", "utf8");
    expect(route).toContain("isBot(");
    expect(route).toContain("isPrefetch(");
    expect(route).toContain('"no-store, max-age=0"');
    expect(route).toMatch(/after\(/);
    expect(route).toContain('"c") === "1"');
    expect(readFileSync("src/components/store/CartCheckout.tsx", "utf8")).toContain("<ViewPixel slug={slug} checkout />");
  });
  it("the analytics page is session-scoped and in the dashboard nav", () => {
    const page = readFileSync("src/app/dashboard/analytics/page.tsx", "utf8");
    expect(page).toContain("requireStore()");
    expect(page).toContain("getStoreAnalytics(db(), store.id");
    expect(page).not.toContain('"use client"');
    expect(readFileSync("src/components/dashboard/DashNav.tsx", "utf8")).toContain('"/dashboard/analytics"');
  });
  it("ku, ar, en and kmr have every analytics string", () => {
    const keys = ["title", "subtitle", "range", "visitors", "storeViews", "productViews", "orders", "conversion", "conversionHint", "revenue", "byDay", "visitorsPerDay", "ordersPerDay", "table", "day", "topViewed", "topSold", "views", "units", "empty", "privacy", "ordersNote", "byCity", "orderCount", "customersTitle", "customersTotal", "customersNew", "customersReturning", "customersHint", "funnelTitle", "funnel_visitors", "funnel_product", "funnel_checkout", "funnel_orders", "funnelHint"];
    for (const l of ["ku", "ar", "en", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { analytics: Record<string, string>; dash: Record<string, string> };
      for (const k of keys) expect(m.analytics[k], `${l}.analytics.${k}`).toBeTruthy();
      expect(m.analytics.range).toContain("{days}");
      expect(m.analytics.views).toContain("{count}");
      expect(m.analytics.orderCount).toContain("{count}");
      expect(m.dash.analytics).toBeTruthy();
    }
  });
});
