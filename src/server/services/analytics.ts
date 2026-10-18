import { and, desc, eq, gte, inArray, lt, lte, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { orderItems, orders, productImages, products, storePageViews } from "../db/schema";
import { LOST_ORDER_STATUSES } from "@/lib/order-status";
import { pickText, type Locale } from "@/lib/i18n";
import { heatMatrix, statusGroup, type StatusGroup } from "@/lib/chart-math";
import {
  buildFunnel,
  CHECKOUT_PAGE,
  conversionRate,
  dayRange,
  fillDays,
  HOME_PAGE,
  iraqDay,
  iraqDayStart,
  PRODUCT_VISITORS_PAGE,
  VISITORS_PAGE,
  WHATSAPP_PAGE,
  type DayPoint,
  type FunnelStep,
} from "@/lib/analytics";
import { sourceFromPage, type OrderSource } from "@/lib/social";

/**
 * Seller analytics (src/lib/analytics.ts explains the counting). Every query is scoped to the caller's store id,
 * which must come from the session (requireStore).
 */

/**
 * Count one page view (and, when it is the visitor's first page of the store today, one visitor; `productVisitor`
 * adds one to the "viewed a product" funnel counter).
 */
export async function recordView(
  database: Db,
  storeId: string,
  page: string,
  opts: { newVisitor: boolean; productVisitor?: boolean; now?: Date },
): Promise<void> {
  const day = iraqDay(opts.now ?? new Date());
  const rows = [{ storeId, day, page, views: 1 }];
  if (opts.newVisitor) rows.push({ storeId, day, page: VISITORS_PAGE, views: 1 });
  if (opts.productVisitor) rows.push({ storeId, day, page: PRODUCT_VISITORS_PAGE, views: 1 });
  await database
    .insert(storePageViews)
    .values(rows)
    .onConflictDoUpdate({
      target: [storePageViews.storeId, storePageViews.day, storePageViews.page],
      set: { views: sql`${storePageViews.views} + 1` },
    });
}

export type TopViewed = { productId: string; name: string; views: number };
export type TopSold = { productId: string; name: string; units: number; revenue: number };
export type CityRow = { cityKey: string; city: string; orders: number; revenue: number };
/** One platform row of "Orders by source": live orders + revenue, social arrivals (visitors/day summed) and orders per 100 arrivals. */
export type SourceRow = { source: OrderSource | "direct"; orders: number; revenue: number; visits: number; conversion: number | null };
export type CustomerSplit = { total: number; returning: number; new: number };
export type StoreAnalytics = {
  days: DayPoint[];
  /** Visitors → saw a product → opened checkout with items → orders (each step ≥ the next). */
  funnel: FunnelStep[];
  totals: { visitors: number; storeViews: number; productViews: number; orders: number; revenue: number; conversion: number | null };
  topViewed: TopViewed[];
  topSold: TopSold[];
  /** Visitors (per day, summed over the range) who tapped a WhatsApp button. Not a funnel step: chats may finish outside the store. */
  whatsappTaps: number;
  /** Orders + revenue per delivery city in the range, best revenue first (top 8). */
  byCity: CityRow[];
  /** Distinct customers (by phone) who ordered in the range; "returning" = they have another live order at any time. */
  customers: CustomerSplit;
  /** Orders by social source (docs/SOCIAL-FIRST.md S4), most orders first, "direct" (no `?src=`) last. */
  bySource: SourceRow[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Iraqi calendar day of an order, as "YYYY-MM-DD" (independent of the session time zone). */
const iraqDaySql = sql<string>`to_char((${orders.createdAt} AT TIME ZONE 'UTC') + interval '3 hours', 'YYYY-MM-DD')`;

export async function getStoreAnalytics(
  database: Db,
  storeId: string,
  opts: { days: number; locale: Locale; now?: Date; top?: number },
): Promise<StoreAnalytics> {
  const days = dayRange(opts.days, opts.now);
  const first = days[0]!;
  const since = iraqDayStart(first);
  const top = opts.top ?? 5;
  // Orders that turned (or may still turn) into revenue: cancelled / refused / returned are left out.
  const live = and(eq(orders.storeId, storeId), gte(orders.createdAt, since), notInArray(orders.status, [...LOST_ORDER_STATUSES]));

  const [viewRows, orderRows, soldRows, cityRows, customerRows, sourceRows] = await Promise.all([
    database
      .select({ day: storePageViews.day, page: storePageViews.page, views: storePageViews.views })
      .from(storePageViews)
      .where(and(eq(storePageViews.storeId, storeId), gte(storePageViews.day, first))),
    database
      .select({ day: iraqDaySql, orders: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(live)
      .groupBy(iraqDaySql),
    database
      .select({
        productId: orderItems.productId,
        name: sql<string>`max(${orderItems.name})`,
        units: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.lineTotal})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(live, sql`${orderItems.productId} is not null`))
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`sum(${orderItems.quantity})`), desc(sql`sum(${orderItems.lineTotal})`))
      .limit(top),
    database
      .select({
        cityKey: orders.cityKey,
        city: sql<string>`max(${orders.cityName})`,
        orders: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      })
      .from(orders)
      .where(live)
      .groupBy(orders.cityKey)
      .orderBy(desc(sql`coalesce(sum(${orders.total}), 0)`), desc(sql`count(*)`))
      .limit(8),
    // One row per customer who ordered in the range, with their live-order count over all time.
    database
      .select({ phone: orders.customerPhone, allTime: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), notInArray(orders.status, [...LOST_ORDER_STATUSES])))
      .groupBy(orders.customerPhone)
      .having(sql`count(*) filter (where ${orders.createdAt} >= ${since.toISOString()}::timestamptz) > 0`),
    database
      .select({ source: orders.source, orders: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(live)
      .groupBy(orders.source),
  ]);

  const perDay: Partial<DayPoint>[] = [];
  let productVisitors = 0;
  let checkoutVisitors = 0;
  let whatsappTaps = 0;
  const productViews = new Map<string, number>();
  const sourceVisits = new Map<OrderSource, number>();
  for (const r of viewRows) {
    const src = sourceFromPage(r.page);
    if (src) sourceVisits.set(src, (sourceVisits.get(src) ?? 0) + r.views);
    else if (r.page === VISITORS_PAGE) perDay.push({ day: r.day, visitors: r.views });
    else if (r.page === PRODUCT_VISITORS_PAGE) productVisitors += r.views;
    else if (r.page === CHECKOUT_PAGE) checkoutVisitors += r.views;
    else if (r.page === WHATSAPP_PAGE) whatsappTaps += r.views;
    else if (r.page === HOME_PAGE) perDay.push({ day: r.day, storeViews: r.views });
    else if (UUID_RE.test(r.page)) {
      perDay.push({ day: r.day, productViews: r.views });
      productViews.set(r.page, (productViews.get(r.page) ?? 0) + r.views);
    }
  }
  for (const r of orderRows) perDay.push({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) });
  const series = fillDays(days, perDay);

  const sum = (k: keyof Omit<DayPoint, "day">) => series.reduce((a, d) => a + d[k], 0);
  const totals = {
    visitors: sum("visitors"),
    storeViews: sum("storeViews"),
    productViews: sum("productViews"),
    orders: sum("orders"),
    revenue: sum("revenue"),
    conversion: null as number | null,
  };
  totals.conversion = conversionRate(totals.orders, totals.visitors);

  const viewedIds = [...productViews.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  const names = viewedIds.length
    ? await database
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.id, viewedIds.map(([id]) => id))))
    : [];
  const topViewed = viewedIds
    .map(([productId, views]) => {
      const p = names.find((n) => n.id === productId);
      return p ? { productId, name: pickText(p.name, opts.locale), views } : null;
    })
    .filter((x): x is TopViewed => x !== null);

  const returning = customerRows.filter((r) => Number(r.allTime) >= 2).length;
  const customers = { total: customerRows.length, returning, new: customerRows.length - returning };

  const funnel = buildFunnel({ visitors: totals.visitors, product: productVisitors, checkout: checkoutVisitors, orders: totals.orders });

  return {
    bySource: buildSourceRows(sourceRows, sourceVisits, totals.visitors),
    days: series,
    funnel,
    whatsappTaps,
    totals,
    topViewed,
    topSold: soldRows.map((r) => ({ productId: r.productId!, name: r.name, units: Number(r.units), revenue: Number(r.revenue) })),
    byCity: cityRows.map((r) => ({ cityKey: r.cityKey, city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) })),
    customers,
  };
}

/**
 * Rows for "Orders by source". Social arrivals come from the `src:<platform>` counters; "direct" visits are the rest
 * of the store's visitors (an approximation: a visitor who came from TikTok and later returned typed-in counts once).
 * Unknown sources in old rows fold into "direct".
 */
export function buildSourceRows(
  orderRows: { source: string | null; orders: number | string; revenue: number | string }[],
  visits: Map<OrderSource, number>,
  totalVisitors: number,
): SourceRow[] {
  const acc = new Map<OrderSource | "direct", { orders: number; revenue: number; visits: number }>();
  const get = (k: OrderSource | "direct") => {
    let v = acc.get(k);
    if (!v) acc.set(k, (v = { orders: 0, revenue: 0, visits: 0 }));
    return v;
  };
  for (const r of orderRows) {
    const k = (r.source && sourceFromPage(`src:${r.source}`)) || "direct";
    const v = get(k);
    v.orders += Number(r.orders);
    v.revenue += Number(r.revenue);
  }
  let social = 0;
  for (const [k, n] of visits) {
    get(k).visits += n;
    social += n;
  }
  const directVisits = Math.max(0, totalVisitors - social);
  if (directVisits > 0 || acc.has("direct")) get("direct").visits = directVisits;
  return [...acc.entries()]
    .filter(([, v]) => v.orders > 0 || v.visits > 0)
    // More orders than counted visits (e.g. cookie-less repeat buyers) would read as >100%: show no rate instead.
    .map(([source, v]) => ({ source, ...v, conversion: v.orders > v.visits ? null : conversionRate(v.orders, v.visits) }))
    .sort((a, b) => (a.source === "direct" ? 1 : 0) - (b.source === "direct" ? 1 : 0) || b.orders - a.orders || b.visits - a.visits);
}

/**
 * Totals for the window of equal length right before the current one (for "vs previous period"), like for like:
 * the current window ends *now* (today is only partly over), so the previous window is cut at the same point.
 * Orders/revenue use exact instants (window start → now minus N days); daily view counters take the previous
 * window's last day pro rata by how much of today has passed. Without this every store read as "down" each morning.
 */
export async function getPreviousTotals(
  database: Db,
  storeId: string,
  opts: { days: number; now?: Date },
): Promise<{ visitors: number; orders: number; revenue: number; storeViews: number; productViews: number }> {
  const now = opts.now ?? new Date();
  const cur = dayRange(opts.days, now);
  const prevEnd = new Date(Date.parse(`${cur[0]}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const prev = dayRange(opts.days, new Date(Date.parse(`${prevEnd}T12:00:00Z`)));
  const first = prev[0]!;
  const last = prev[prev.length - 1]!;
  const todayFraction = elapsedDayFraction(now);
  const until = new Date(now.getTime() - opts.days * 86_400_000);
  const [views, ord] = await Promise.all([
    database
      .select({ page: storePageViews.page, day: storePageViews.day, views: sql<number>`sum(${storePageViews.views})` })
      .from(storePageViews)
      .where(and(eq(storePageViews.storeId, storeId), gte(storePageViews.day, first), lte(storePageViews.day, last)))
      .groupBy(storePageViews.page, storePageViews.day),
    database
      .select({ orders: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${orders.total}), 0)` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, iraqDayStart(first)), lt(orders.createdAt, until), notInArray(orders.status, [...LOST_ORDER_STATUSES]))),
  ]);
  let visitors = 0, storeViews = 0, productViews = 0;
  for (const r of views) {
    const n = r.day === last ? Number(r.views) * todayFraction : Number(r.views);
    if (r.page === VISITORS_PAGE) visitors += n;
    else if (r.page === HOME_PAGE) storeViews += n;
    else if (UUID_RE.test(r.page)) productViews += n;
  }
  return {
    visitors: Math.round(visitors),
    storeViews: Math.round(storeViews),
    productViews: Math.round(productViews),
    orders: Number(ord[0]?.orders ?? 0),
    revenue: Number(ord[0]?.revenue ?? 0),
  };
}

/** Share of the current Iraqi day that has passed, 0–1. */
export function elapsedDayFraction(now: Date): number {
  const start = iraqDayStart(dayRange(1, now)[0]!).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start) / 86_400_000));
}

export type AnalyticsExtras = {
  /** Live orders by weekday (Saturday first) × Iraqi hour over `heatDays` days. */
  heat: number[][];
  heatDays: number;
  /** Orders (any status) per day of the range, split into four status groups. */
  statusDays: { day: string; counts: Record<StatusGroup, number> }[];
  /** Last 90 days of visitors and live orders for the calendar strip. */
  year: { days: string[]; visitors: number[]; orders: number[] };
  /** Cover photo URL per product id. */
  thumbs: Record<string, string>;
};

/** Extra series for the analytics visuals. Every query is scoped to the caller's store. */
export async function getAnalyticsExtras(
  database: Db,
  storeId: string,
  opts: { days: number; now?: Date; productIds?: string[] },
): Promise<AnalyticsExtras> {
  const range = dayRange(opts.days, opts.now);
  const year = dayRange(90, opts.now);
  const heatDays = Math.max(opts.days, 30);
  const heatSince = iraqDayStart(dayRange(heatDays, opts.now)[0]!);
  const yearSince = iraqDayStart(year[0]!);
  const rangeSince = iraqDayStart(range[0]!);
  const local = sql`(${orders.createdAt} AT TIME ZONE 'UTC') + interval '3 hours'`;
  const notLost = notInArray(orders.status, [...LOST_ORDER_STATUSES]);
  const ids = (opts.productIds ?? []).filter((id) => UUID_RE.test(id));

  const [heatRows, statusRows, yearOrders, yearVisitors, imgRows] = await Promise.all([
    database
      .select({ dow: sql<number>`extract(dow from ${local})`, hour: sql<number>`extract(hour from ${local})`, n: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, heatSince), notLost))
      .groupBy(sql`extract(dow from ${local})`, sql`extract(hour from ${local})`),
    database
      .select({ day: iraqDaySql, status: orders.status, n: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, rangeSince)))
      .groupBy(iraqDaySql, orders.status),
    database
      .select({ day: iraqDaySql, n: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, yearSince), notLost))
      .groupBy(iraqDaySql),
    database
      .select({ day: storePageViews.day, n: storePageViews.views })
      .from(storePageViews)
      .where(and(eq(storePageViews.storeId, storeId), eq(storePageViews.page, VISITORS_PAGE), gte(storePageViews.day, year[0]!))),
    ids.length
      ? database
          .select({ productId: productImages.productId, url: productImages.url, renditions: productImages.renditions })
          .from(productImages)
          .where(and(eq(productImages.storeId, storeId), inArray(productImages.productId, ids), eq(productImages.sort, 0)))
      : Promise.resolve([] as { productId: string; url: string; renditions: { url: string; width: number }[] }[]),
  ]);

  const perDay = new Map<string, Record<StatusGroup, number>>();
  for (const d of range) perDay.set(d, { new: 0, confirmed: 0, delivered: 0, lost: 0 });
  for (const r of statusRows) {
    const row = perDay.get(r.day);
    if (row) row[statusGroup(r.status)] += Number(r.n);
  }
  const oMap = new Map(yearOrders.map((r) => [r.day, Number(r.n)]));
  const vMap = new Map(yearVisitors.map((r) => [r.day, Number(r.n)]));
  const thumbs: Record<string, string> = {};
  for (const r of imgRows) {
    const small = [...(r.renditions ?? [])].sort((a, b) => a.width - b.width).find((x) => x.width >= 96) ?? r.renditions?.[0];
    thumbs[r.productId] = small?.url ?? r.url;
  }
  return {
    heat: heatMatrix(heatRows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), n: Number(r.n) }))),
    heatDays,
    statusDays: range.map((day) => ({ day, counts: perDay.get(day)! })),
    year: { days: year, visitors: year.map((d) => vMap.get(d) ?? 0), orders: year.map((d) => oMap.get(d) ?? 0) },
    thumbs,
  };
}
