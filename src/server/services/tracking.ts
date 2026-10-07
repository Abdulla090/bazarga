import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { orderEvents, orderItems, orders } from "../db/schema";
import { hitRateLimit } from "../auth/rate-limit";
import { normalizeIraqiMobile } from "@/lib/phone";
import { parseOrderNumber } from "@/lib/order-tracking";
import type { OrderStatus, PaymentMethod } from "@/lib/order-status";

/**
 * Shopper order tracking. A lookup is always scoped to one store and needs BOTH the order number and the phone
 * the order was placed with; every miss (unknown number, wrong phone, another store's order, junk input) is the
 * same "not_found", so the endpoint can't be used to probe which numbers exist.
 */

/** Per client IP, per store: lookups per window. */
export const TRACK_IP_LIMIT = 10;
/** Per store + order number, across IPs: stops guessing one order's phone from many addresses. */
export const TRACK_ORDER_LIMIT = 6;
export const TRACK_WINDOW_SECONDS = 600;

/** What the shopper sees — no customer address, notes, ids of other rows, or seller-side history notes. */
export type TrackedOrder = {
  publicId: string;
  number: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: (typeof orders.$inferSelect)["paymentStatus"];
  customerName: string;
  cityName: string;
  areaName: string | null;
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  courierName: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  items: { id: string; name: string; variantTitle: string | null; quantity: number; lineTotal: number }[];
  events: { toStatus: OrderStatus; createdAt: Date }[];
};

export type TrackResult = { ok: true; order: TrackedOrder } | { ok: false; reason: "not_found" | "rate_limited" };

async function loadTracked(database: Db, where: ReturnType<typeof and>): Promise<TrackedOrder | null> {
  const order = await database.query.orders.findFirst({ where });
  if (!order) return null;
  const [items, events] = await Promise.all([
    database.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id), orderBy: asc(orderItems.name) }),
    database
      .select({ toStatus: orderEvents.toStatus, createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt)),
  ]);
  return {
    publicId: order.publicId,
    number: order.number,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName,
    cityName: order.cityName,
    areaName: order.areaName,
    subtotal: order.subtotal,
    discountCode: order.discountCode,
    discountAmount: order.discountAmount,
    deliveryFee: order.deliveryFee,
    total: order.total,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt,
    items: items.map((i) => ({ id: i.id, name: i.name, variantTitle: i.variantTitle, quantity: i.quantity, lineTotal: i.lineTotal })),
    events,
  };
}

/**
 * Find an order by store + number + phone (no rate limiting — use `trackOrder` from request handlers).
 * The phone is normalised exactly like checkout (`normalizeIraqiMobile` → "+9647XXXXXXXXX"); the legacy
 * "9647…" form is matched too in case a row predates migration 0003's backfill.
 */
export async function findOrderForTracking(
  database: Db,
  storeId: string,
  numberRaw: unknown,
  phoneRaw: unknown,
): Promise<TrackedOrder | null> {
  const number = parseOrderNumber(numberRaw);
  const phone = typeof phoneRaw === "string" && phoneRaw.length <= 40 ? normalizeIraqiMobile(phoneRaw) : null;
  if (!number || !phone?.ok) return null;
  return loadTracked(
    database,
    and(eq(orders.storeId, storeId), eq(orders.number, number), inArray(orders.customerPhone, [phone.e164, phone.e164.slice(1)])),
  );
}

/** Re-open an order the shopper already looked up (the tracking cookie holds its unguessable public id). */
export async function getTrackedOrder(database: Db, storeId: string, publicId: string): Promise<TrackedOrder | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(publicId)) return null;
  return loadTracked(database, and(eq(orders.storeId, storeId), eq(orders.publicId, publicId)));
}

/** Rate-limited lookup for the tracking form: per IP (per store) and per order number. */
export async function trackOrder(
  database: Db,
  input: { storeId: string; ip: string; number: unknown; phone: unknown },
): Promise<TrackResult> {
  const ipHit = await hitRateLimit(database, `track:ip:${input.storeId}:${input.ip}`, TRACK_IP_LIMIT, TRACK_WINDOW_SECONDS);
  if (!ipHit.allowed) return { ok: false, reason: "rate_limited" };
  const number = parseOrderNumber(input.number);
  if (number) {
    const orderHit = await hitRateLimit(database, `track:order:${input.storeId}:${number}`, TRACK_ORDER_LIMIT, TRACK_WINDOW_SECONDS);
    if (!orderHit.allowed) return { ok: false, reason: "rate_limited" };
  }
  const order = await findOrderForTracking(database, input.storeId, input.number, input.phone);
  return order ? { ok: true, order } : { ok: false, reason: "not_found" };
}
