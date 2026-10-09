import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, gt, notInArray, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  customers,
  deliveryAreas,
  deliveryZones,
  discountCodes,
  orderEvents,
  orderItems,
  orders,
  products,
  productImages,
  productOptionValues,
  productVariants,
  storeBlockedPhones,
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
import { applyDiscount, DISCOUNT_CODE_RE, normalizeDiscountCode, type DiscountRejection, type DiscountRule } from "@/lib/discounts";
import type { Store } from "./stores";
import {
  assessRisk,
  cartFingerprint,
  DUPLICATE_WINDOW_MS,
  isHoneypotTripped,
  MAX_ORDERS_PER_PHONE_PER_DAY,
  REPLAY_WINDOW_MS,
} from "@/lib/order-risk";

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

type CartLine = { productId: string; variantId?: string | null; quantity: number };
type MergedLine = { productId: string; variantId: string | null; quantity: number };

const lineKey = (l: { productId: string; variantId?: string | null }) => `${l.productId}:${l.variantId ?? ""}`;

/** Merge duplicate lines (same product + variant) so a line can't bypass stock checks by appearing twice. */
export function mergeCart(items: CartLine[]): MergedLine[] {
  const m = new Map<string, MergedLine>();
  for (const i of items) {
    const k = lineKey(i);
    const cur = m.get(k);
    if (cur) cur.quantity += i.quantity;
    else m.set(k, { productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity });
  }
  return [...m.values()];
}

// ---------------------------------------------------------------- line resolution (shared by quote + checkout)
type ProductRow = typeof products.$inferSelect;
type VariantRow = typeof productVariants.$inferSelect;

/** Why a line can't be bought as is. `variant_required`: the product has variants and none (or a stale one) was picked. */
export type LineProblem = "product_unavailable" | "variant_required" | "out_of_stock";

type ResolvedLine = MergedLine & {
  product: ProductRow | null;
  variant: VariantRow | null;
  unitPrice: number;
  /** Units on hand for what is being bought (variant stock for variant products); null = not tracked. */
  stock: number | null;
  variantTitle: string | null;
  sku: string | null;
  problem: LineProblem | null;
};

/**
 * Price and validate cart lines against the DB. A product with active variants can only be bought through one
 * of them (its own price/stock are then ignored); a product without variants can't carry a variant id.
 */
async function resolveLines(database: Db, storeId: string, items: MergedLine[], locale: Locale): Promise<ResolvedLine[]> {
  const ids = [...new Set(items.map((i) => i.productId))];
  if (!ids.length) return [];
  const [found, variants, values] = await Promise.all([
    database.query.products.findMany({ where: and(eq(products.storeId, storeId), inArray(products.id, ids)) }),
    database.query.productVariants.findMany({
      where: and(eq(productVariants.storeId, storeId), inArray(productVariants.productId, ids), eq(productVariants.isActive, true)),
    }),
    database
      .select({ id: productOptionValues.id, label: productOptionValues.label })
      .from(productOptionValues)
      .where(and(eq(productOptionValues.storeId, storeId), inArray(productOptionValues.productId, ids))),
  ]);
  return items.map((i) => {
    const product = found.find((f) => f.id === i.productId) ?? null;
    const own = variants.filter((v) => v.productId === i.productId);
    let variant: VariantRow | null = null;
    let problem: LineProblem | null = null;
    if (!product || !product.isActive) problem = "product_unavailable";
    else if (own.length) {
      variant = own.find((v) => v.id === i.variantId) ?? null;
      if (!variant) problem = "variant_required";
    } else if (i.variantId) problem = "product_unavailable"; // the variant was removed since it was added to the cart
    const stock = variant ? variant.stock : (product?.stock ?? null);
    if (!problem && stock !== null && stock < i.quantity) problem = "out_of_stock";
    const variantTitle = variant
      ? variant.optionValueIds
          .map((id) => pickText(values.find((v) => v.id === id)?.label, locale))
          .filter(Boolean)
          .join(" / ") || null
      : null;
    return {
      ...i,
      product,
      variant,
      unitPrice: variant?.price ?? product?.price ?? 0,
      stock,
      variantTitle,
      sku: variant?.sku ?? null,
      problem,
    };
  });
}

// ---------------------------------------------------------------- delivery area + discount (shared by quote + checkout)
type ZoneRow = typeof deliveryZones.$inferSelect;
type DiscountRow = typeof discountCodes.$inferSelect;

export type ResolvedDelivery = { fee: number; areaId: string | null; areaName: string | null };

/**
 * Fee for a zone + optional area. An area id must belong to that zone of this store and be active
 * (else `invalid_area`); "other area" free text keeps the zone fee.
 */
async function resolveDelivery(
  database: Db,
  storeId: string,
  zone: ZoneRow,
  areaId: string | null | undefined,
  areaOther: string | null | undefined,
  locale: Locale,
): Promise<ResolvedDelivery> {
  if (areaId) {
    const area = await database.query.deliveryAreas.findFirst({
      where: and(eq(deliveryAreas.id, areaId), eq(deliveryAreas.storeId, storeId), eq(deliveryAreas.zoneId, zone.id), eq(deliveryAreas.isActive, true)),
    });
    if (!area) throw new AppError("VALIDATION", "invalid_area");
    return { fee: area.fee ?? zone.fee, areaId: area.id, areaName: pickText(area.name, locale) || null };
  }
  return { fee: zone.fee, areaId: null, areaName: areaOther?.trim() || null };
}

const toRule = (d: DiscountRow): DiscountRule => ({
  type: d.type,
  value: d.value,
  minSubtotal: d.minSubtotal,
  maxUses: d.maxUses,
  usedCount: d.usedCount,
  startsAt: d.startsAt,
  endsAt: d.endsAt,
  isActive: d.isActive,
});

/** Look up a shopper-typed code for this store. null = no such code. */
export async function findDiscountCode(database: Db, storeId: string, raw: string): Promise<DiscountRow | null> {
  const code = normalizeDiscountCode(raw);
  if (!DISCOUNT_CODE_RE.test(code)) return null;
  const row = await database.query.discountCodes.findFirst({ where: and(eq(discountCodes.storeId, storeId), eq(discountCodes.code, code)) });
  return row ?? null;
}

export type DiscountError = "discount_invalid" | `discount_${DiscountRejection}`;

/**
 * Count one use of a code — race-safe: the conditional UPDATE re-checks active / window / limit under the row lock,
 * so two shoppers racing for the last use can't both get it (the loser's whole order transaction rolls back).
 */
export async function claimDiscountUse(database: Db, codeId: string, now = new Date()): Promise<boolean> {
  const rows = await database
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1`, updatedAt: now })
    .where(
      and(
        eq(discountCodes.id, codeId),
        eq(discountCodes.isActive, true),
        or(isNull(discountCodes.maxUses), lt(discountCodes.usedCount, discountCodes.maxUses)),
        or(isNull(discountCodes.startsAt), lte(discountCodes.startsAt, now)),
        or(isNull(discountCodes.endsAt), gt(discountCodes.endsAt, now)),
      ),
    )
    .returning({ id: discountCodes.id });
  return rows.length > 0;
}

/** "Add X IQD more for free delivery": null when there is no threshold or the cart is empty/already over it. */
export function freeDeliveryRemaining(subtotal: number, threshold: number | null | undefined): number | null {
  if (!threshold || threshold <= 0 || subtotal <= 0 || subtotal >= threshold) return null;
  return threshold - subtotal;
}

// ---------------------------------------------------------------- quote (cart page)
/** Cart thumbnails are ~64 px: use the smallest stored rendition when the image went through the pipeline. */
function thumbUrl(img: { url: string; renditions: { width: number; url: string }[] } | undefined): string | null {
  if (!img) return null;
  const smallest = [...img.renditions].sort((a, b) => a.width - b.width)[0];
  return smallest?.url ?? img.url;
}

export type QuoteLine = {
  /** productId:variantId — stable key for the cart UI. */
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantTitle: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** false when the product was removed, deactivated, needs a variant, or doesn't have enough stock. */
  available: boolean;
  problem: LineProblem | null;
  stock: number | null;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  /** After free delivery (threshold or code). */
  deliveryFee: number;
  total: number;
  cityKey: string | null;
  discountAmount: number;
  /** The normalised code when it applies to this cart. */
  discountCode: string | null;
  /** Why the typed code doesn't apply (shown under the field). */
  discountError: DiscountError | null;
  freeDelivery: boolean;
  freeDeliveryThreshold: number | null;
  /** IQD still to add for free delivery; null when n/a. */
  freeDeliveryRemaining: number | null;
};

export type QuoteOptions = { areaId?: string | null; discountCode?: string | null; now?: Date };

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
  opts: QuoteOptions = {},
): Promise<Quote> {
  const resolved = await resolveLines(database, storeId, mergeCart(items), locale);
  const ids = [...new Set(resolved.map((l) => l.productId))];
  const imgs = ids.length
    ? await database
        .select({ id: productImages.id, productId: productImages.productId, url: productImages.url, renditions: productImages.renditions, sort: productImages.sort })
        .from(productImages)
        .where(and(eq(productImages.storeId, storeId), inArray(productImages.productId, ids)))
    : [];
  const lines: QuoteLine[] = resolved.map((l) => {
    const available = !l.problem;
    // The picked variant's photo when it has one, else the product cover.
    const img = (l.variant?.imageId && imgs.find((x) => x.id === l.variant!.imageId)) || imgs.find((x) => x.productId === l.productId && x.sort === 0);
    return {
      key: lineKey(l),
      productId: l.productId,
      variantId: l.variantId,
      name: l.product ? pickText(l.product.name, locale) : "—",
      variantTitle: l.variantTitle,
      image: thumbUrl(img || undefined),
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      lineTotal: available ? l.unitPrice * l.quantity : 0,
      available,
      problem: l.problem,
      stock: l.stock,
    };
  });
  const okLines = lines.filter((l) => l.available);
  let deliveryFee = 0;
  if (cityKey && okLines.length) {
    const zone = await database.query.deliveryZones.findFirst({
      where: and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.cityKey, cityKey), eq(deliveryZones.isActive, true)),
    });
    if (zone) {
      // A stale/foreign area id just falls back to the zone fee in the quote; checkout rejects it.
      deliveryFee = await resolveDelivery(database, storeId, zone, opts.areaId, null, locale).then(
        (d) => d.fee,
        () => zone.fee,
      );
    }
  }
  const t = computeTotals(okLines, deliveryFee);
  const [storeRow, code] = await Promise.all([
    database.query.stores.findFirst({ where: eq(stores.id, storeId), columns: { freeDeliveryThreshold: true } }),
    opts.discountCode ? findDiscountCode(database, storeId, opts.discountCode) : Promise.resolve(null),
  ]);
  const threshold = storeRow?.freeDeliveryThreshold ?? null;
  let discountError: DiscountError | null = opts.discountCode && !code ? "discount_invalid" : null;
  const applied = applyDiscount(
    { subtotal: t.subtotal, deliveryFee: t.deliveryFee, freeDeliveryThreshold: threshold, discount: code ? toRule(code) : null },
    opts.now,
  );
  if (applied.rejection) discountError = `discount_${applied.rejection}`;
  return {
    lines,
    subtotal: t.subtotal,
    deliveryFee: applied.deliveryFee,
    total: applied.total,
    cityKey,
    discountAmount: applied.discountAmount,
    discountCode: code && !applied.rejection ? code.code : null,
    discountError,
    freeDelivery: applied.freeDelivery,
    freeDeliveryThreshold: threshold,
    freeDeliveryRemaining: applied.freeDelivery ? null : freeDeliveryRemaining(t.subtotal, threshold),
  };
}

// ---------------------------------------------------------------- checkout
/** `replayed`: the same phone sent the same cart again within minutes (a double tap) and got the first order back. */
export type PlacedOrder = Order & { items: OrderItem[]; replayed?: boolean };

export type PlaceOrderOptions = {
  /** Which non-COD providers are configured on this deployment (env credentials present). */
  isProviderAvailable?: (m: PaymentMethod) => boolean;
  now?: Date;
};

type OptionalCheckoutFields = "areaId" | "areaOther" | "landmark" | "discountCode" | "hp" | "elapsedMs";
/** Parsed checkout input; area, landmark and discount code are optional for callers that don't collect them. */
export type PlaceOrderInput = Omit<CheckoutInput, OptionalCheckoutFields> & Partial<Pick<CheckoutInput, OptionalCheckoutFields>>;

/**
 * Create an order atomically:
 *  - re-prices every line from the DB (client prices are ignored), per variant when the product has variants,
 *  - takes the delivery fee from the store's zone (or the chosen area of it) for the chosen city,
 *  - applies a discount code (validated, then its use claimed with a conditional UPDATE) and the store's
 *    free-delivery threshold,
 *  - decrements tracked stock (variant stock for variant lines) with a conditional UPDATE
 *    (fails → whole transaction rolls back),
 *  - allocates a per-store sequential order number,
 *  - upserts the customer record,
 *  - fake-order protection (src/lib/order-risk.ts): honeypot / blocklisted phone / daily cap per phone are refused
 *    with one generic error; a double tap (same phone + cart, first order still pending) returns the first order;
 *    other signals are stored in `risk_flags` for the seller.
 */
export async function placeOrder(
  database: Db,
  store: Pick<Store, "id">,
  input: PlaceOrderInput,
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

    // ---- fake-order protection. Serialise checkouts of one phone at one store so a double tap can't race itself.
    const now = opts.now ?? new Date();
    if (isHoneypotTripped(input.hp)) throw new AppError("VALIDATION", "order_rejected");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`order:${storeId}:${input.phone}`}))`);
    const blocked = await tx
      .select({ id: storeBlockedPhones.id })
      .from(storeBlockedPhones)
      .where(and(eq(storeBlockedPhones.storeId, storeId), eq(storeBlockedPhones.phone, input.phone)))
      .limit(1);
    if (blocked.length) throw new AppError("VALIDATION", "order_rejected");
    const zone = await tx.query.deliveryZones.findFirst({
      where: and(
        eq(deliveryZones.storeId, storeId),
        eq(deliveryZones.cityKey, input.cityKey),
        eq(deliveryZones.isActive, true),
      ),
    });
    if (!zone) throw new AppError("VALIDATION", "invalid_city");

    const priced = await resolveLines(tx as unknown as Db, storeId, items, input.locale);
    for (const l of priced) {
      if (l.problem === "product_unavailable") throw new AppError("NOT_FOUND", "product_unavailable", { productId: l.productId });
      if (l.problem === "variant_required") throw new AppError("VALIDATION", "variant_required", { productId: l.productId });
      // out_of_stock is enforced by the conditional decrement below (same error, and race-safe).
    }

    const delivery = await resolveDelivery(tx as unknown as Db, storeId, zone, input.areaId, input.areaOther, input.locale);
    const totals = computeTotals(priced, delivery.fee);

    // Discount code: validate for this cart, then claim one use atomically (rolls back with the order).
    let code: DiscountRow | null = null;
    if (input.discountCode) {
      code = await findDiscountCode(tx as unknown as Db, storeId, input.discountCode);
      if (!code) throw new AppError("VALIDATION", "discount_invalid");
    }
    const [storeRow] = await tx.select({ threshold: stores.freeDeliveryThreshold }).from(stores).where(eq(stores.id, storeId));
    const applied = applyDiscount(
      { subtotal: totals.subtotal, deliveryFee: totals.deliveryFee, freeDeliveryThreshold: storeRow?.threshold ?? null, discount: code ? toRule(code) : null },
      now,
    );
    if (applied.rejection) throw new AppError("VALIDATION", `discount_${applied.rejection}`);

    // ---- fake-order protection, part 2 (the submission is valid): double tap → first order; daily cap; risk flags.
    const cartHash = cartFingerprint(items);
    const recent = await tx
      .select({
        id: orders.id,
        status: orders.status,
        cartHash: orders.cartHash,
        paymentMethod: orders.paymentMethod,
        cityKey: orders.cityKey,
        areaId: orders.areaId,
        address: orders.address,
        landmark: orders.landmark,
        discountCode: orders.discountCode,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.customerPhone, input.phone), gte(orders.createdAt, new Date(now.getTime() - DUPLICATE_WINDOW_MS))))
      .orderBy(desc(orders.createdAt));
    // A replay is the very same submission (cart, payment, where to, code); a corrected address or code is a new order.
    const typedCode = input.discountCode ? normalizeDiscountCode(input.discountCode) : null;
    const replay = recent.find(
      (o) =>
        o.cartHash === cartHash &&
        o.status === "pending" &&
        now.getTime() - o.createdAt.getTime() <= REPLAY_WINDOW_MS &&
        o.paymentMethod === input.paymentMethod &&
        o.cityKey === input.cityKey &&
        (o.areaId ?? null) === (input.areaId ?? null) &&
        o.address === input.address &&
        (o.landmark ?? null) === (input.landmark ?? null) &&
        (o.discountCode ?? null) === typedCode,
    );
    if (replay) {
      const first = await tx.query.orders.findFirst({ where: and(eq(orders.id, replay.id), eq(orders.storeId, storeId)) });
      const firstItems = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, replay.id) });
      if (first) return { ...first, items: firstItems, replayed: true };
    }
    if (recent.length >= MAX_ORDERS_PER_PHONE_PER_DAY) throw new AppError("RATE_LIMITED", "too_many_orders");
    const [history] = await tx
      .select({
        open: sql<number>`count(*) filter (where ${inArray(orders.status, [...OPEN_ORDER_STATUSES])})`,
        refused: sql<number>`count(*) filter (where ${inArray(orders.status, ["refused", "returned"])})`,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.customerPhone, input.phone)));
    const riskFlags = assessRisk({
      elapsedMs: input.elapsedMs,
      sameCartRecent: recent.filter((o) => o.cartHash === cartHash && o.status !== "cancelled").length,
      openFromPhone: Number(history?.open ?? 0),
      refusedFromPhone: Number(history?.refused ?? 0),
    });

    if (code && !(await claimDiscountUse(tx as unknown as Db, code.id, now))) throw new AppError("VALIDATION", "discount_used_up");

    // Atomic, race-safe stock decrement.
    for (const line of priced) {
      if (line.stock === null) continue;
      const updated = line.variant
        ? await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} - ${line.quantity}`, updatedAt: new Date() })
            .where(
              and(
                eq(productVariants.id, line.variant.id),
                eq(productVariants.storeId, storeId),
                isNotNull(productVariants.stock),
                gte(productVariants.stock, line.quantity),
              ),
            )
            .returning({ id: productVariants.id })
        : await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${line.quantity}`, updatedAt: new Date() })
            .where(
              and(
                eq(products.id, line.productId),
                eq(products.storeId, storeId),
                isNotNull(products.stock),
                gte(products.stock, line.quantity),
              ),
            )
            .returning({ id: products.id });
      if (!updated.length) {
        throw new AppError("OUT_OF_STOCK", "out_of_stock", { productId: line.productId, variantId: line.variantId });
      }
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
        areaName: delivery.areaName,
        landmark: input.landmark ?? null,
        ordersCount: 1,
        totalSpent: applied.total,
        lastOrderAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [customers.storeId, customers.phone],
        set: {
          name: input.customerName,
          cityKey: input.cityKey,
          address: input.address,
          areaName: delivery.areaName,
          landmark: input.landmark ?? null,
          ordersCount: sql`${customers.ordersCount} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${applied.total}`,
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
        areaId: delivery.areaId,
        areaName: delivery.areaName,
        address: input.address,
        landmark: input.landmark ?? null,
        notes: input.notes,
        subtotal: totals.subtotal,
        discountCodeId: code?.id ?? null,
        discountCode: code?.code ?? null,
        discountAmount: applied.discountAmount,
        deliveryFee: applied.deliveryFee,
        total: applied.total,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "unpaid" : "pending",
        locale: input.locale,
        riskFlags,
        cartHash,
      })
      .returning();
    if (!order) throw new Error("order insert failed");

    const insertedItems = await tx
      .insert(orderItems)
      .values(
        priced.map((l, i) => ({
          orderId: order.id,
          productId: l.productId,
          variantId: l.variant?.id ?? null,
          name: pickText(l.product!.name, input.locale),
          variantTitle: l.variantTitle,
          sku: l.sku,
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

/** What the printable packing slip shows (dashboard-only). */
export type PackingSlip = {
  store: { name: string; slug: string; logoUrl: string | null; phone: string | null; whatsapp: string | null };
  order: Order;
  items: OrderItem[];
  /** Amount the courier collects at the door: the total for unpaid COD orders, otherwise 0. */
  codToCollect: number;
};

/**
 * Packing slip for one order of the seller's own store. `storeId` must come from the session (requireStore):
 * an order of another store is simply not found, exactly like getOrder.
 */
export async function getPackingSlip(database: Db, storeId: string, orderId: string): Promise<PackingSlip | null> {
  const store = await database.query.stores.findFirst({ where: eq(stores.id, storeId) });
  if (!store) return null;
  const order = await database.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)) });
  if (!order) return null;
  const items = await database.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id), orderBy: asc(orderItems.name) });
  return {
    store: { name: store.name, slug: store.slug, logoUrl: store.logoUrl, phone: store.phone, whatsapp: store.whatsapp },
    order,
    items,
    codToCollect: codAmountToCollect(order),
  };
}

/** COD amount the courier has to collect: the order total while a COD order is unpaid, else nothing. */
export function codAmountToCollect(order: Pick<Order, "paymentMethod" | "paymentStatus" | "total">): number {
  return order.paymentMethod === "cod" && order.paymentStatus !== "paid" && order.paymentStatus !== "refunded" ? order.total : 0;
}

/**
 * Move an order along its COD lifecycle (src/lib/order-status.ts).
 * - only transitions in ORDER_TRANSITIONS are allowed (enforced here, not just in the UI);
 * - cancelled / returned restock tracked items exactly once: the restock is claimed with
 *   `UPDATE orders SET restocked_at = now() WHERE restocked_at IS NULL`, so a retried or racing change, or any
 *   future path back out of a terminal state, can never put the same stock back twice
 *   (refused doesn't restock: the parcel is still with the courier);
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
    // Courier / tracking number belong to "out for delivery"; other changes keep what the order has.
    const ship = to === "shipped" ? shipping : undefined;
    if (ship?.courierName !== undefined) patch.courierName = ship.courierName?.trim() || null;
    if (ship?.trackingNumber !== undefined) patch.trackingNumber = ship.trackingNumber?.trim() || null;

    // Optimistic concurrency: only update if status is still what we read.
    const [updated] = await tx
      .update(orders)
      .set(patch)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId), eq(orders.status, order.status)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "order_changed");

    let restock = false;
    if (RESTOCK_ON.includes(to)) {
      const claimed = await tx
        .update(orders)
        .set({ restockedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId), isNull(orders.restockedAt)))
        .returning({ id: orders.id });
      restock = claimed.length > 0;
    }
    if (restock) {
      const items = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
      for (const it of items) {
        if (it.variantId) {
          // Variant lines restock the variant (untracked variants stay untracked).
          await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} + ${it.quantity}`, updatedAt: new Date() })
            .where(and(eq(productVariants.id, it.variantId), eq(productVariants.storeId, storeId), isNotNull(productVariants.stock)));
          continue;
        }
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

/** Orders with their item lines for the seller CSV export (store-scoped; newest first; max 2000). */
export async function listOrdersForExport(database: Db, storeId: string, opts: { status?: OrderStatus } = {}) {
  const rows = await database.query.orders.findMany({
    where: opts.status ? and(eq(orders.storeId, storeId), eq(orders.status, opts.status)) : eq(orders.storeId, storeId),
    orderBy: desc(orders.createdAt),
    limit: 2000,
  });
  if (rows.length === 0) return [];
  const items = await database.query.orderItems.findMany({ where: inArray(orderItems.orderId, rows.map((r) => r.id)) });
  return rows.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
}

/** Orders still waiting for the seller's first reply (status pending). Store-scoped. */
export async function countNewOrders(database: Db, storeId: string): Promise<number> {
  const [row] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.status, "pending")));
  return row?.n ?? 0;
}
