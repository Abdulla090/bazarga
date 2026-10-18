/*
 * Demo analytics: ~90 days of believable store traffic and orders for the demo store, so every chart on
 * /dashboard/analytics looks alive on the test deploy. Runs only when SEED_DEMO=true (or on a Vercel build) and is
 * idempotent, relative to "now": page-view rows are upserted to GREATEST(existing, seeded), so real visits (audits,
 * smoke tests) never block a top-up and a day seeded while it was "today" is raised to its full value later; demo
 * orders (customers with +96477099xxxx numbers) are topped up per day up to the current hour, so a day that was
 * only partly seeded at the last deploy is completed. Every deploy therefore leaves the last 7/30 days whole and
 * the KPIs show the store's steady growth instead of a false drop. Pure function of the date and hour.
 */
import { randomBytes } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import type { Db } from "../src/server/db";
import { orderEvents, orderItems, orders, products, storePageViews, stores } from "../src/server/db/schema";
import { CHECKOUT_PAGE, dayRange, HOME_PAGE, iraqDayStart, PRODUCT_VISITORS_PAGE, VISITORS_PAGE, WHATSAPP_PAGE } from "../src/lib/analytics";
import type { OrderStatus } from "../src/lib/order-status";
import { sourcePage, type OrderSource } from "../src/lib/social";

export const DEMO_PHONE_PREFIX = "+96477099";


export function seedAnalyticsEnabled(): boolean {
  return process.env.SEED_DEMO === "true" || process.env.VERCEL === "1";
}

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(r: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1]![0];
}

const CITIES = [
  ["erbil", "هەولێر", 34],
  ["sulaymaniyah", "سلێمانی", 20],
  ["duhok", "دهۆک", 12],
  ["kirkuk", "کەرکووک", 8],
  ["baghdad", "بەغدا", 13],
  ["mosul", "موسڵ", 6],
  ["basra", "بەسرە", 4],
  ["halabja", "هەڵەبجە", 3],
] as const;
/**
 * Where demo shoppers arrive from (share of daily visitors) — TikTok first, like real Iraqi social sellers — and how
 * likely each arrival is to order relative to the store average (WhatsApp shares convert best: a friend sent it).
 * Visitors not covered here are "direct". Kept on its own random stream so the older demo numbers never change.
 */
export const DEMO_SOURCES: readonly (readonly [OrderSource, number, number])[] = [
  ["tiktok", 0.44, 0.92],
  ["instagram", 0.24, 1.0],
  ["whatsapp", 0.09, 1.55],
  ["facebook", 0.07, 0.85],
  ["telegram", 0.03, 1.1],
  ["qr", 0.02, 1.3],
];
const HOUR_W = [1, 0.5, 0.3, 0.2, 0.2, 0.3, 0.6, 1.2, 2, 3, 3.5, 4, 5, 5, 4, 3.5, 3.5, 4, 5, 6.5, 7.5, 8, 6, 3];
const NAMES = ["ئاڤان", "شیلان", "ڕێباز", "هێمن", "دلنیا", "بەرزان", "ژیان", "کاروان", "نیان", "سەربەست", "ڤیان", "هاوڕێ", "ڕێزان", "زانا", "دیلان", "ئارام", "ڕۆژین", "بیلال", "ساکار", "لانە"];
const FAMILY = ["عومەر", "کەریم", "ئەحمەد", "عەلی", "حەسەن", "محەمەد", "ڕەسوڵ", "سلێمان", "ئیبراهیم", "قادر"];

function statusFor(r: () => number, ageDays: number): OrderStatus {
  if (ageDays > 10) return pick<OrderStatus>(r, [["delivered", 76], ["cancelled", 9], ["refused", 5], ["returned", 4], ["postponed", 1], ["shipped", 1]]);
  if (ageDays > 3) return pick<OrderStatus>(r, [["delivered", 46], ["shipped", 20], ["confirmed", 12], ["cancelled", 8], ["postponed", 5], ["refused", 4], ["pending", 5]]);
  return pick<OrderStatus>(r, [["pending", 38], ["confirmed", 28], ["shipped", 19], ["cancelled", 6], ["postponed", 5], ["delivered", 4]]);
}
const PATH: Record<OrderStatus, OrderStatus[]> = {
  pending: ["pending"],
  confirmed: ["pending", "confirmed"],
  shipped: ["pending", "confirmed", "shipped"],
  delivered: ["pending", "confirmed", "shipped", "delivered"],
  postponed: ["pending", "postponed"],
  cancelled: ["pending", "cancelled"],
  refused: ["pending", "confirmed", "shipped", "refused"],
  returned: ["pending", "confirmed", "shipped", "refused", "returned"],
};

export async function seedAnalytics(db: Db, storeId: string, now = new Date()): Promise<{ viewRows: number; orders: number }> {
  const prods = await db.select({ id: products.id, name: products.name, price: products.price }).from(products).where(eq(products.storeId, storeId));
  if (!prods.length) return { viewRows: 0, orders: 0 };
  // Popularity: first products sell and get viewed the most.
  const weights = prods.map((p, i) => [p, [30, 22, 18, 14, 9, 6, 4, 3][i] ?? 2] as const);
  const days = dayRange(90, now);
  const today = days[days.length - 1]!;
  const nowHour = new Date(now.getTime() + 3 * 3_600_000).getUTCHours();

  const viewValues: { storeId: string; day: string; page: string; views: number }[] = [];
  type Draft = { day: string; at: Date; status: OrderStatus; phone: string; name: string; city: (typeof CITIES)[number]; lines: { id: string; name: string; price: number; qty: number }[]; fee: number };
  const drafts: Draft[] = [];

  const haveDays = new Map(
    (
      await db
        .select({ d: sql<string>`to_char((${orders.createdAt} AT TIME ZONE 'UTC') + interval '3 hours', 'YYYY-MM-DD')`, n: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), like(orders.customerPhone, `${DEMO_PHONE_PREFIX}%`)))
        .groupBy(sql`1`)
    ).map((r) => [r.d, Number(r.n)] as const),
  );

  days.forEach((day, i) => {
    const r = rng(`bazarga-demo-${day}`);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const growth = 0.72 + 0.55 * (i / (days.length - 1));
    const weekday = [0.92, 0.95, 0.93, 0.98, 1.12, 1.28, 1.22][dow]!;
    const partial = day === today ? Math.max(0.2, (nowHour + 1) / 24) : 1;
    const visitors = Math.max(6, Math.round(78 * growth * weekday * (0.84 + 0.32 * r()) * partial));
    viewValues.push({ storeId, day, page: VISITORS_PAGE, views: visitors });
    viewValues.push({ storeId, day, page: HOME_PAGE, views: Math.round(visitors * (0.88 + 0.08 * r())) });
    viewValues.push({ storeId, day, page: PRODUCT_VISITORS_PAGE, views: Math.round(visitors * (0.52 + 0.1 * r())) });
    viewValues.push({ storeId, day, page: CHECKOUT_PAGE, views: Math.round(visitors * (0.17 + 0.05 * r())) });
    viewValues.push({ storeId, day, page: WHATSAPP_PAGE, views: Math.round(visitors * (0.09 + 0.05 * r())) });
    const rs = rng(`bazarga-demo-src-${day}`);
    for (const [src, share] of DEMO_SOURCES) viewValues.push({ storeId, day, page: sourcePage(src), views: Math.max(0, Math.round(visitors * share * (0.85 + 0.3 * rs()))) });
    const totalPv = visitors * 1.8;
    const wsum = weights.reduce((a, [, w]) => a + w, 0);
    for (const [p, w] of weights) viewValues.push({ storeId, day, page: p.id, views: Math.max(1, Math.round((totalPv * w) / wsum * (0.8 + 0.4 * r()))) });

    const have = haveDays.get(day) ?? 0;
    const n = Math.round(visitors * 0.044 * (0.75 + 0.5 * r()));
    const dayDrafts: Draft[] = [];
    for (let k = 0; k < n; k++) {
      const hour = pick(r, HOUR_W.map((w, h) => [h, w] as const));
      // Today's later hours are still drawn (so a day's random stream never depends on the hour) but not kept.
      const future = day === today && hour > nowHour;
      const at = new Date(iraqDayStart(day).getTime() + (hour * 60 + Math.floor(r() * 60)) * 60_000);
      const age = days.length - 1 - i;
      const lineCount = pick(r, [[1, 62], [2, 30], [3, 8]] as const);
      const lines: Draft["lines"] = [];
      for (let l = 0; l < lineCount; l++) {
        const p = pick(r, weights);
        if (lines.some((x) => x.id === p.id)) continue;
        lines.push({ id: p.id, name: p.name.ku ?? p.name.en ?? Object.values(p.name)[0] ?? "—", price: p.price, qty: r() < 0.82 ? 1 : 2 });
      }
      const cust = Math.floor(Math.pow(r(), 1.7) * 70);
      if (future) continue;
      dayDrafts.push({
        day,
        at,
        status: statusFor(r, age),
        phone: `${DEMO_PHONE_PREFIX}${String(1000 + cust).padStart(4, "0")}`,
        name: `${NAMES[cust % NAMES.length]} ${FAMILY[(cust * 7) % FAMILY.length]}`,
        city: pick(r, CITIES.map((c) => [c, c[2]] as const)),
        lines,
        fee: pick(r, [[3000, 60], [5000, 25], [6000, 15]] as const),
      });
    }
    // Earliest first; the first `have` were inserted by an earlier run, the rest are this day's top-up.
    dayDrafts.sort((a, b) => a.at.getTime() - b.at.getTime());
    drafts.push(...dayDrafts.slice(have));
  });

  let viewRows = 0;
  for (let i = 0; i < viewValues.length; i += 200) {
    const res = await db
      .insert(storePageViews)
      .values(viewValues.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [storePageViews.storeId, storePageViews.day, storePageViews.page],
        set: { views: sql`greatest(${storePageViews.views}, excluded.views)` },
        setWhere: sql`${storePageViews.views} < excluded.views`,
      })
      .returning({ d: storePageViews.day });
    viewRows += res.length;
  }

  if (drafts.length) {
    drafts.sort((a, b) => a.at.getTime() - b.at.getTime());
    const seq = (await db.select({ seq: stores.orderSeq }).from(stores).where(eq(stores.id, storeId)))[0]?.seq ?? 0;
    const rows = drafts.map((d, i) => {
      const subtotal = d.lines.reduce((a, l) => a + l.price * l.qty, 0);
      const fee = subtotal >= 75_000 ? 0 : d.fee;
      return {
        storeId,
        number: seq + 1 + i,
        publicId: randomBytes(12).toString("base64url"),
        customerName: d.name,
        customerPhone: d.phone,
        cityKey: d.city[0],
        cityName: d.city[1],
        address: d.city[1],
        subtotal,
        deliveryFee: fee,
        total: subtotal + fee,
        status: d.status,
        paymentMethod: "cod" as const,
        paymentStatus: d.status === "delivered" ? ("paid" as const) : ("unpaid" as const),
        locale: "ku" as const,
        restockedAt: d.status === "cancelled" || d.status === "returned" ? d.at : null,
        createdAt: d.at,
        updatedAt: d.at,
      };
    });
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const ins = await db.insert(orders).values(chunk).returning({ id: orders.id, number: orders.number });
      const idByNumber = new Map(ins.map((o) => [o.number, o.id]));
      const items = chunk.flatMap((row, j) => {
        const d = drafts[i + j]!;
        return d.lines.map((l) => ({ orderId: idByNumber.get(row.number)!, productId: l.id, name: l.name, unitPrice: l.price, quantity: l.qty, lineTotal: l.price * l.qty }));
      });
      const events = chunk.flatMap((row, j) => {
        const d = drafts[i + j]!;
        const steps = PATH[d.status];
        return steps.map((to, s) => ({
          orderId: idByNumber.get(row.number)!,
          fromStatus: s === 0 ? null : steps[s - 1]!,
          toStatus: to,
          createdAt: new Date(d.at.getTime() + s * 5 * 3_600_000),
        }));
      });
      await db.insert(orderItems).values(items);
      await db.insert(orderEvents).values(events);
    }
    await db.update(stores).set({ orderSeq: seq + drafts.length }).where(eq(stores.id, storeId));
  }
  await backfillDemoSources(db, storeId);
  return { viewRows, orders: drafts.length };
}

/**
 * Gives demo orders (and only demo orders: +96477099… phones) a deterministic source, weighted by visitor share ×
 * relative conversion, so "Orders by source" shows TikTok largest. Idempotent: only rows still NULL are touched, and the
 * bucket comes from a hash of the order's public id, so a re-run never reshuffles. ~6% stay NULL ("direct").
 */
export async function backfillDemoSources(db: Db, storeId: string): Promise<void> {
  const weights = DEMO_SOURCES.map(([s, share, conv]) => [s, share * conv] as const);
  const total = weights.reduce((a, [, w]) => a + w, 0) / 0.94;
  let edge = 0;
  const cases = weights.map(([s, w]) => {
    edge += Math.round((w / total) * 1000);
    return sql`when (abs(hashtext(${orders.publicId})) % 1000) < ${edge} then ${s}`;
  });
  await db
    .update(orders)
    .set({ source: sql`case ${sql.join(cases, sql` `)} else null end` })
    .where(and(eq(orders.storeId, storeId), like(orders.customerPhone, `${DEMO_PHONE_PREFIX}%`), sql`${orders.source} is null`));
}
