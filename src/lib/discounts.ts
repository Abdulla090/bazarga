/**
 * Discount codes and the free-delivery threshold — pure arithmetic (whole IQD), shared by checkout and tests.
 * Schema: `discount_codes` (+ `orders.discount_*`, `stores.free_delivery_threshold`), migration 0001.
 */
export const DISCOUNT_TYPES = ["percentage", "fixed", "free_delivery"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export function isDiscountType(v: unknown): v is DiscountType {
  return typeof v === "string" && (DISCOUNT_TYPES as readonly string[]).includes(v);
}

export type DiscountRule = {
  type: DiscountType;
  /** percentage: 1–100; fixed: IQD off the subtotal; free_delivery: ignored (0). */
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export type DiscountRejection = "inactive" | "not_started" | "expired" | "used_up" | "below_minimum";

/** Codes are case-insensitive for shoppers; stored upper-case (DB check constraint enforces it). */
export function normalizeDiscountCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
export const DISCOUNT_CODE_RE = /^[A-Z0-9_-]{3,32}$/;

export function checkDiscount(rule: DiscountRule, subtotal: number, now = new Date()): DiscountRejection | null {
  if (!rule.isActive) return "inactive";
  if (rule.startsAt && now < rule.startsAt) return "not_started";
  if (rule.endsAt && now >= rule.endsAt) return "expired";
  if (rule.maxUses !== null && rule.usedCount >= rule.maxUses) return "used_up";
  if (subtotal < rule.minSubtotal) return "below_minimum";
  return null;
}

export type PricedOrder = {
  subtotal: number;
  /** Delivery fee before any free-delivery rule. */
  deliveryFee: number;
  /** Store's free-delivery threshold (IQD); null = none. */
  freeDeliveryThreshold: number | null;
  discount: DiscountRule | null;
};

export type DiscountResult = {
  /** Amount taken off the subtotal (never more than the subtotal). */
  discountAmount: number;
  deliveryFee: number;
  freeDelivery: boolean;
  total: number;
  rejection: DiscountRejection | null;
};

const assertIqd = (n: number, what: string) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Invalid ${what}: ${n}`);
};

/**
 * Apply a discount code and/or the free-delivery threshold.
 * Percentages round down to the whole dinar (the shopper never pays a fraction, the seller never gives away more
 * than advertised). The threshold is checked against the subtotal *before* the code's discount — the same rule
 * Shopify/Salla use and the one shoppers expect from "free delivery over 50,000".
 */
export function applyDiscount(o: PricedOrder, now = new Date()): DiscountResult {
  assertIqd(o.subtotal, "subtotal");
  assertIqd(o.deliveryFee, "delivery fee");
  if (o.freeDeliveryThreshold !== null) assertIqd(o.freeDeliveryThreshold, "free delivery threshold");

  let discountAmount = 0;
  let freeDelivery = o.freeDeliveryThreshold !== null && o.freeDeliveryThreshold > 0 && o.subtotal >= o.freeDeliveryThreshold;
  let rejection: DiscountRejection | null = null;

  if (o.discount) {
    rejection = checkDiscount(o.discount, o.subtotal, now);
    if (!rejection) {
      const d = o.discount;
      if (d.type === "percentage") {
        if (!Number.isInteger(d.value) || d.value < 1 || d.value > 100) throw new Error(`Invalid percentage: ${d.value}`);
        discountAmount = Math.floor((o.subtotal * d.value) / 100);
      } else if (d.type === "fixed") {
        assertIqd(d.value, "fixed discount");
        discountAmount = Math.min(d.value, o.subtotal);
      } else {
        freeDelivery = true;
      }
    }
  }
  const deliveryFee = freeDelivery ? 0 : o.deliveryFee;
  const total = o.subtotal - discountAmount + deliveryFee;
  assertIqd(total, "total");
  return { discountAmount, deliveryFee, freeDelivery, total, rejection };
}
