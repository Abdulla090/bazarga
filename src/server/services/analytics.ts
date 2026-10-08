import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { orderItems, orders, products, storePageViews } from "../db/schema";
import { LOST_ORDER_STATUSES } from "@/lib/order-status";
import { pickText, type Locale } from "@/lib/i18n";
import { conversionRate, dayRange, fillDays, HOME_PAGE, iraqDay, iraqDayStart, VISITORS_PAGE, type DayPoint } from "@/lib/analytics";

/**
 * Seller analytics (src/lib/analytics.ts explains the counting). Every query is scoped to the caller's store id,
 * which must come from the session (requireStore).
 */

/** Count one page view (and, when it is the visitor's first page of the store today, one visitor). */
export async function recordView(
  database: Db,
  storeId: string,
  page: string,
  opts: { newVisitor: boolean; now?: Date },
): Promise<void> {
  const day = iraqDay(opts.now ?? new Date());
  const rows = [{ storeId, day, page, views: 1 }];
  if (opts.newVisitor) rows.push({ storeId, day, page: VISITORS_PAGE, views: 1 });
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
export type StoreAnalytics = {
  days: DayPoint[];
  totals: { visitors: number; storeViews: number; productViews: number; orders: number; revenue: number; conversion: number | null };
  topViewed: TopViewed[];
  topSold: TopSold[];
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

  const [viewRows, orderRows, soldRows] = await Promise.all([
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
  ]);

  const perDay: Partial<DayPoint>[] = [];
  const productViews = new Map<string, number>();
  for (const r of viewRows) {
    if (r.page === VISITORS_PAGE) perDay.push({ day: r.day, visitors: r.views });
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

  return {
    days: series,
    totals,
    topViewed,
    topSold: soldRows.map((r) => ({ productId: r.productId!, name: r.name, units: Number(r.units), revenue: Number(r.revenue) })),
  };
}
