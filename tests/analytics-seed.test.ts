import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import type { Db } from "@/server/db";
import { orders, storePageViews } from "@/server/db/schema";
import { VISITORS_PAGE } from "@/lib/analytics";
import { elapsedDayFraction, getAnalyticsExtras, getPreviousTotals, getStoreAnalytics } from "@/server/services/analytics";
import { DEMO_PHONE_PREFIX, seedAnalytics } from "../scripts/seed-analytics";
import { product, seller, testDb } from "./support/db";

const NOW = new Date("2026-10-12T12:00:00Z");

describe("demo analytics seed + chart extras", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("fills 90 days, is idempotent and feeds every chart series", async () => {
    const { store } = await seller(database, "seedan");
    const p1 = await product(database, store.id, 25_000);
    await product(database, store.id, 40_000);
    const first = await seedAnalytics(database, store.id, NOW);
    expect(first.orders).toBeGreaterThan(150);
    expect(first.viewRows).toBeGreaterThan(90 * 5);
    const again = await seedAnalytics(database, store.id, NOW);
    expect(again).toEqual({ viewRows: 0, orders: 0 });

    const demo = await database.select().from(orders).where(and(eq(orders.storeId, store.id), like(orders.customerPhone, `${DEMO_PHONE_PREFIX}%`)));
    expect(demo.length).toBe(first.orders);
    expect(new Set(demo.map((o) => o.status)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(demo.map((o) => o.cityKey)).size).toBeGreaterThanOrEqual(5);

    const x = await getAnalyticsExtras(database, store.id, { days: 30, now: NOW, productIds: [p1.id] });
    expect(x.heat).toHaveLength(7);
    expect(x.heat.every((r) => r.length === 24)).toBe(true);
    expect(x.heat.flat().reduce((a, b) => a + b, 0)).toBeGreaterThan(30);
    expect(x.statusDays).toHaveLength(30);
    expect(x.year.days).toHaveLength(90);
    expect(x.year.visitors.filter((v) => v > 0).length).toBe(90);
    const total = x.statusDays.reduce((a, d) => a + d.counts.new + d.counts.confirmed + d.counts.delivered + d.counts.lost, 0);
    expect(total).toBeGreaterThan(30);

    const a = await getStoreAnalytics(database, store.id, { days: 90, locale: "en", now: NOW });
    expect(a.totals.visitors).toBeGreaterThan(5000);
    expect(a.totals.conversion).toBeGreaterThan(2);
    expect(a.topSold.length).toBeGreaterThan(0);
    expect(a.byCity.length).toBeGreaterThan(3);
  });

  it("tops up relative to now: a partly seeded day is completed and real visits never block the seed", async () => {
    const { store } = await seller(database, "seedan3");
    await product(database, store.id, 25_000);
    const morning = new Date("Mon 2026-10-12 8:00 AM (UTC+03:00)");
    const evening = new Date("Mon 2026-10-12 9:00 PM (UTC+03:00)");
    // A real visit on a past day before the first seed (used to make ON CONFLICT DO NOTHING skip the whole day).
    await database.insert(storePageViews).values({ storeId: store.id, day: "2026-10-10", page: VISITORS_PAGE, views: 3 });
    await seedAnalytics(database, store.id, morning);
    const visitorsOn = async (day: string) =>
      (await database.select().from(storePageViews).where(and(eq(storePageViews.storeId, store.id), eq(storePageViews.day, day), eq(storePageViews.page, VISITORS_PAGE))))[0]!.views;
    expect(await visitorsOn("2026-10-10")).toBeGreaterThan(40);
    const todayMorning = await visitorsOn("2026-10-12");
    const later = await seedAnalytics(database, store.id, evening);
    expect(later.orders).toBeGreaterThan(0);
    expect(await visitorsOn("2026-10-12")).toBeGreaterThan(todayMorning);
    // Fully seeded days are not touched again.
    expect(await seedAnalytics(database, store.id, evening)).toEqual({ viewRows: 0, orders: 0 });
  });

  it("vs previous period is like for like (cut at the same point of the day), so steady growth reads as growth", async () => {
    const { store } = await seller(database, "seedan4");
    await product(database, store.id, 25_000);
    await product(database, store.id, 40_000);
    await seedAnalytics(database, store.id, NOW);
    expect(elapsedDayFraction(NOW)).toBeCloseTo(15 / 24, 5);
    for (const days of [7, 30] as const) {
      const cur = await getStoreAnalytics(database, store.id, { days, locale: "en", now: NOW });
      const prev = await getPreviousTotals(database, store.id, { days, now: NOW });
      expect(cur.totals.visitors).toBeGreaterThan(prev.visitors * 1.03);
      expect(cur.totals.storeViews).toBeGreaterThan(prev.storeViews);
      expect(cur.totals.orders).toBeGreaterThan(prev.orders);
      expect(prev.orders).toBeGreaterThan(0);
    }
  });

  it("extras are tenant-scoped", async () => {
    const { store } = await seller(database, "seedan2");
    const x = await getAnalyticsExtras(database, store.id, { days: 7, now: NOW });
    expect(x.heat.flat().reduce((a, b) => a + b, 0)).toBe(0);
    expect(x.year.visitors.every((v) => v === 0)).toBe(true);
    const rows = await database.select().from(storePageViews).where(eq(storePageViews.storeId, store.id));
    expect(rows).toHaveLength(0);
  });
});
