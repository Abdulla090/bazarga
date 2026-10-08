/**
 * Seller analytics — privacy-friendly, server-side counting (no cookies, no third-party trackers, no client JS).
 *
 * How a view is counted: store home and product pages render a 1×1 same-origin pixel (`/api/v/<slug>[?p=<id>]`).
 * The route drops bots / link-preview crawlers and prefetches, de-duplicates a visitor per page per day **in memory**
 * with a salted hash that rotates daily (IP and user agent are never stored), and increments a per-store, per-day,
 * per-page counter (`store_page_views`, migration 0007). Only aggregate numbers ever reach the database.
 * Orders and revenue come from the orders table. Days are Iraqi days (Asia/Baghdad, UTC+3, no DST).
 */

export const HOME_PAGE = "home";
/** The row that counts unique visitors of the store that day (any page). */
export const VISITORS_PAGE = "*";
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const IRAQ_OFFSET_MS = 3 * 3_600_000;

/** "YYYY-MM-DD" of the Iraqi calendar day `d` falls in. */
export function iraqDay(d: Date): string {
  return new Date(d.getTime() + IRAQ_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `days` Iraqi days, oldest first, ending today. */
export function dayRange(days: number, now = new Date()): string[] {
  const today = iraqDay(now);
  const base = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(base - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** UTC instant where Iraqi day `day` starts. */
export function iraqDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - IRAQ_OFFSET_MS);
}

export function parseRange(v: string | string[] | undefined): AnalyticsRange {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : 7;
}

/**
 * Crawlers, uptime monitors and chat-app link previews (WhatsApp, Telegram, Facebook, Instagram, Viber…).
 * They fetch pages but are not shoppers.
 */
const BOT_RE =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebookcatalog|whatsapp|telegram|viber|skype|discord|slack|embedly|headless|lighthouse|pagespeed|curl|wget|python-requests|httpclient|okhttp|go-http|node-fetch|axios|monitor|pingdom|uptime/i;

export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_RE.test(ua);
}

/** Prefetches and speculative loads are not views. */
export function isPrefetch(h: { get(name: string): string | null }): boolean {
  const p = `${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""} ${h.get("x-moz") ?? ""}`.toLowerCase();
  return p.includes("prefetch") || p.includes("prerender");
}

/** Orders per 100 visitors, one decimal; null when there were no visitors. */
export function conversionRate(orders: number, visitors: number): number | null {
  if (visitors <= 0) return null;
  return Math.round((orders / visitors) * 1000) / 10;
}

export type DayPoint = { day: string; visitors: number; storeViews: number; productViews: number; orders: number; revenue: number };

/** Spread sparse rows over every day of the range (missing days are zero). */
export function fillDays(days: string[], rows: Partial<DayPoint>[]): DayPoint[] {
  const by = new Map<string, DayPoint>();
  for (const d of days) by.set(d, { day: d, visitors: 0, storeViews: 0, productViews: 0, orders: 0, revenue: 0 });
  for (const r of rows) {
    if (!r.day) continue;
    const cur = by.get(r.day);
    if (!cur) continue;
    for (const k of ["visitors", "storeViews", "productViews", "orders", "revenue"] as const) cur[k] += Number(r[k] ?? 0);
  }
  return days.map((d) => by.get(d)!);
}

/** Bar heights as % of the largest value (0 when everything is 0). */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((v / max) * 100) : 0));
}
