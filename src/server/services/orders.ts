import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  customers,
  deliveryZones,
  orderEvents,
  orderItems,
  orders,
  products,
  productImages,
  storePaymentMethods,
  stores,
} from "../db/schema";
import { AppError } from "../errors";
import { computeTotals } from "@/lib/totals";
import { pickText, type Locale } from "@/lib/i18n";
import {
  LOST_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  RESTOCK_ON,
  canTransition,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/order-status";
import { governorateForCityKey } from "@/lib/governorates";
import type { CheckoutInput } from "@/lib/validation";
import type { Store } from "./stores";

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

type CartLine = { productId: string; quantity: number };

/** Merge duplicate lines so the same product can't bypass stock checks by appearing twice. */
export function mergeCart(items: CartLine[]): CartLine[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
  return [...m.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

// ---------------------------------------------------------------- quote (cart page)
/** Cart thumbnails are ~64 px: use the smallest stored rendition when the image went through the pipeline. */
function thumbUrl(img: { url: string; renditions: { width: number; url: string }[] } | undefined): string | null {
  if (!img) return null;
  const smallest = [...img.renditions].sort((a, b) => a.width - b.width)[0];
  return smallest?.url ?? img.url;
}

export type QuoteLine = {
  productId: string;
  name: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** false when the product was removed, deactivated, or doesn't have enough stock. */
  available: boolean;
  stock: number | null;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  cityKey: string | null;
};

/**
 * Price a cart from the database (never from client-sent prices). Unavailable lines are returned
 * flagged and excluded from totals so the cart UI can explain them.
 */
export async function quoteCart(
  database: Db,
  storeId: string,
  items: CartLine[],
  cityKey: string | null,
  locale: Locale,
): Promise<Quote> {
  const merged = mergeCart(items);
  const ids = merged.map((i) => i.productId);
  const found = ids.length
    ? await database.query.products.findMany({ where: and(eq(products.storeId, storeId), inArray(products.id, ids)) })
    : [];
  const imgs = ids.length
    ? await database
        .select({ productId: productImages.productId, url: productImages.url, renditions: productImages.renditions })
        .from(productImages)
        .where(and(eq(productImages.storeId, storeId), inArray(productImages.productId, ids), eq(productImages.sort, 0)))
    : [];
  const lines: QuoteLine[] = merged.map((i) => {
    const p = found.find((f) => f.id === i.productId);
    const available = !!p && p.isActive && (p.stock === null || p.stock >= i.quantity);
    const unitPrice = p?.price ?? 0;
    return {
      productId: i.productId,
      name: p ? pickText(p.name, locale) : "—",
      image: thumbUrl(imgs.find((x) => x.productId === i.productId)),
      unitPrice,
      quantity: i.quantity,
      lineTotal: available ? unitPrice * i.quantity : 0,
      available,
      stock: p?.stock ?? null,
    };
  });
  const okLines = lines.filter((l) => l.available);
  let deliveryFee = 0;
  if (cityKey && okLines.length) {
    const zone = await database.query.deliveryZones.findFirst({
      where: and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.cityKey, cityKey), eq(deliveryZones.isActive, true)),
    });
    deliveryFee = zone?.fee ?? 0;
  }
  const t = computeTotals(okLines, deliveryFee);
  return { lines, subtotal: t.subtotal, deliveryFee: t.deliveryFee, total: t.total, cityKey };
}

// ---------------------------------------------------------------- checkout
export type PlacedOrder = Order & { items: OrderItem[] };

export type PlaceOrderOptions = {
  /** Which non-COD providers are configured on this deployment (env credentials present). */
  isProviderAvailable?: (m: PaymentMethod) => boolean;
};

/**
 * Create an order atomically:
 *  - re-prices every line from the DB (client prices are ignored),
 *  - takes the delivery fee from the store's zone for the chosen city,
 *  - decrements tracked stock with a conditional UPDATE (fails → whole transaction rolls back),
 *  - allocates a per-store sequential order number,
 *  - upserts the customer record.
 */
export async function placeOrder(
  database: Db,
  store: Pick<Store, "id">,
  input: CheckoutInput,
  opts: PlaceOrderOptions = {},
): Promise<PlacedOrder> {
  const storeId = store.id;
  const items = mergeCart(input.items);

  return database.transaction(async (tx) => {
    // Payment method must be enabled by the seller (and configured, for online providers).
    const pm = await tx.query.storePaymentMethods.findFirst({
      where: and(eq(storePaymentMethods.storeId, storeId), eq(storePaymentMethods.method, input.paymentMethod)),
    });
    if (!pm?.enabled) throw new AppError("VALIDATION", "payment_method_unavailable");
    if (input.paymentMethod !== "cod" && !(opts.isProviderAvailable?.(input.paymentMethod) ?? false)) {
      throw new AppError("VALIDATION", "payment_method_unavailable");
    }

    const zone = await tx.query.deliveryZones.findFirst({
      where: and(
        eq(deliveryZones.storeId, storeId),
        eq(deliveryZones.cityKey, input.cityKey),
        eq(deliveryZones.isActive, true),
      ),
    });
    if (!zone) throw new AppError("VALIDATION", "invalid_city");

    const ids = items.map((i) => i.productId);
    const found = await tx.query.products.findMany({
      where: and(eq(products.storeId, storeId), inArray(products.id, ids), eq(products.isActive, true)),
    });
    const priced = items.map((i) => {
      const p = found.find((f) => f.id === i.productId);
      if (!p) throw new AppError("NOT_FOUND", "product_unavailable", { productId: i.productId });
      return { product: p, quantity: i.quantity, unitPrice: p.price };
    });

    const totals = computeTotals(priced, zone.fee);

    // Atomic, race-safe stock decrement.
    for (const line of priced) {
      if (line.product.stock === null) continue;
      const updated = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${line.quantity}`, updatedAt: new Date() })
        .where(
          and(
            eq(products.id, line.product.id),
            eq(products.storeId, storeId),
            isNotNull(products.stock),
            gte(products.stock, line.quantity),
          ),
        )
        .returning({ id: products.id });
      if (!updated.length) throw new AppError("OUT_OF_STOCK", "out_of_stock", { productId: line.product.id });
    }

    const [seq] = await tx
      .update(stores)
      .set({ orderSeq: sql`${stores.orderSeq} + 1` })
      .where(eq(stores.id, storeId))
      .returning({ n: stores.orderSeq });
    if (!seq) throw new AppError("NOT_FOUND", "store_not_found");

    const [customer] = await tx
      .insert(customers)
      .values({
        storeId,
        name: input.customerName,
        phone: input.phone,
        cityKey: input.cityKey,
        address: input.address,
        ordersCount: 1,
        totalSpent: totals.total,
        lastOrderAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [customers.storeId, customers.phone],
        set: {
          name: input.customerName,
          cityKey: input.cityKey,
          address: input.address,
          ordersCount: sql`${customers.ordersCount} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${totals.total}`,
          lastOrderAt: new Date(),
        },
      })
      .returning({ id: customers.id });

    const [order] = await tx
      .insert(orders)
      .values({
        storeId,
        number: seq.n,
        publicId: randomBytes(12).toString("base64url"),
        customerId: customer?.id ?? null,
        customerName: input.customerName,
        customerPhone: input.phone,
        cityKey: zone.cityKey,
        cityName: pickText(zone.name, input.locale),
        governorateKey: zone.governorateKey ?? governorateForCityKey(zone.cityKey),
        address: input.address,
        notes: input.notes,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "unpaid" : "pending",
        locale: input.locale,
      })
      .returning();
    if (!order) throw new Error("order insert failed");

    const insertedItems = await tx
      .insert(orderItems)
      .values(
        priced.map((l, i) => ({
          orderId: order.id,
          productId: l.product.id,
          name: pickText(l.product.name, input.locale),
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineTotal: totals.lines[i]!,
        })),
      )
      .returning();

    await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: null, toStatus: "pending" });
    return { ...order, items: insertedItems };
  });
}

// ---------------------------------------------------------------- seller side
export async function listOrders(
  database: Db,
  storeId: string,
  opts: { status?: OrderStatus; limit?: number } = {},
): Promise<Order[]> {
  return database.query.orders.findMany({
    where: opts.status ? and(eq(orders.storeId, storeId), eq(orders.status, opts.status)) : eq(orders.storeId, storeId),
    orderBy: desc(orders.createdAt),
    limit: Math.min(opts.limit ?? 100, 500),
  });
}

export async function getOrder(database: Db, storeId: string, orderId: string) {
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)) });
  if (!order) return null;
  const [items, events] = await Promise.all([
    database.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) }),
    database.query.orderEvents.findMany({ where: eq(orderEvents.orderId, order.id), orderBy: asc(orderEvents.createdAt) }),
  ]);
  return { ...order, items, events };
}

/** Public lookup for the confirmation page: requires both the store and the unguessable public id. */
export async function getOrderByPublicId(database: Db, storeId: string, publicId: string) {
  const order = await database.query.orders.findFirst({
    where: and(eq(orders.publicId, publicId), eq(orders.storeId, storeId)),
  });
  if (!order) return null;
  const items = await database.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) });
  return { ...order, items };
}

/**
 * Move an order along its COD lifecycle (src/lib/order-status.ts).
 * - cancelled / returned restock tracked items (refused doesn't: the parcel is still with the courier);
 * - delivering a COD order marks it paid; returning a paid COD order marks it refunded;
 * - courier name / tracking number, when given, are saved on the order and snapshotted in the history row.
 */
export async function updateOrderStatus(
  database: Db,
  storeId: string,
  orderId: string,
  to: OrderStatus,
  actorUserId: string | null,
  note?: string,
  shipping?: { courierName?: string | null; trackingNumber?: string | null },
): Promise<Order> {
  return database.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)) });
    if (!order) throw new AppError("NOT_FOUND");
    if (!canTransition(order.status, to)) throw new AppError("VALIDATION", "invalid_transition");

    const patch: Partial<typeof orders.$inferInsert> = { status: to, updatedAt: new Date() };
    if (to === "delivered" && order.paymentMethod === "cod") patch.paymentStatus = "paid";
    if (to === "returned" && order.paymentMethod === "cod" && order.paymentStatus === "paid") patch.paymentStatus = "refunded";
    if (shipping?.courierName !== undefined) patch.courierName = shipping.courierName?.trim() || null;
    if (shipping?.trackingNumber !== undefined) patch.trackingNumber = shipping.trackingNumber?.trim() || null;

    // Optimistic concurrency: only update if status is still what we read.
    const [updated] = await tx
      .update(orders)
      .set(patch)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId), eq(orders.status, order.status)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "order_changed");

    if (RESTOCK_ON.includes(to)) {
      const items = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
      for (const it of items) {
        if (!it.productId) continue;
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${it.quantity}` })
          .where(and(eq(products.id, it.productId), eq(products.storeId, storeId), isNotNull(products.stock)));
      }
    }
    await tx.insert(orderEvents).values({
      orderId,
      fromStatus: order.status,
      toStatus: to,
      actorUserId,
      note: note ?? null,
      courierName: updated.courierName,
      trackingNumber: updated.trackingNumber,
    });
    return updated;
  });
}

export async function listCustomers(database: Db, storeId: string) {
  return database.query.customers.findMany({
    where: eq(customers.storeId, storeId),
    orderBy: desc(customers.lastOrderAt),
    limit: 500,
  });
}

// ---------------------------------------------------------------- stats
/** Iraq (Asia/Baghdad) is UTC+3 all year — no DST since 2008. */
const IRAQ_OFFSET_MS = 3 * 3_600_000;

export function startOfIraqDay(now = new Date()): Date {
  const local = new Date(now.getTime() + IRAQ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - IRAQ_OFFSET_MS);
}

export async function storeStats(database: Db, storeId: string, now = new Date()) {
  const today = startOfIraqDay(now);
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000); // today + previous 6 days
  const [row] = await database
    .select({
      ordersToday: sql<number>`count(*) filter (where ${orders.createdAt} >= ${today.toISOString()}::timestamptz)`,
      revenueWeek: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.createdAt} >= ${weekAgo.toISOString()}::timestamptz), 0)`,
      openOrders: sql<number>`count(*) filter (where ${inArray(orders.status, [...OPEN_ORDER_STATUSES])})`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), notInArray(orders.status, [...LOST_ORDER_STATUSES])));
  return {
    ordersToday: Number(row?.ordersToday ?? 0),
    revenueWeek: Number(row?.revenueWeek ?? 0),
    openOrders: Number(row?.openOrders ?? 0),
  };
}
