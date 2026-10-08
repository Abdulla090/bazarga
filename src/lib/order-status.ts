/**
 * Order lifecycle, modelled on how Cash-on-Delivery actually plays out in Iraq:
 *
 *   pending ─► confirmed ─► shipped ─► delivered ─► returned
 *      │           │           ├─► refused ─► returned
 *      │           │           ├─► returned (courier brought it straight back)
 *      │           │           └─► postponed ─► (confirmed | shipped | cancelled)
 *      └───────────┴─► cancelled / postponed
 *
 * - `shipped`   out for delivery (with the courier); the seller can record courier name + tracking number.
 * - `pending`   new order, seller hasn't called the customer yet (v1 "new").
 * - `postponed` customer asked to deliver later / couldn't be reached.
 * - `refused`   customer refused the parcel at the door (goods still with courier).
 * - `returned`  goods are back with the seller (stock restored).
 * Terminal: `returned`, `cancelled`.
 */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "postponed",
  "refused",
  "returned",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** v1 → v2 status names (applied to existing rows by migration 0001). */
export const LEGACY_ORDER_STATUS: Readonly<Record<string, OrderStatus>> = {
  new: "pending",
  out_for_delivery: "shipped",
};

/** Allowed transitions. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "postponed", "cancelled"],
  confirmed: ["shipped", "postponed", "cancelled"],
  shipped: ["delivered", "postponed", "refused", "returned"],
  postponed: ["confirmed", "shipped", "cancelled"],
  delivered: ["returned"],
  refused: ["returned"],
  returned: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Orders the seller still has to act on. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = ["pending", "confirmed", "shipped", "postponed"];
/** Orders that never turned into revenue. */
export const LOST_ORDER_STATUSES: readonly OrderStatus[] = ["cancelled", "refused", "returned"];
/** Entering one of these puts tracked stock back. (`refused` doesn't: the parcel is still with the courier.) */
export const RESTOCK_ON: readonly OrderStatus[] = ["cancelled", "returned"];
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter((s) => ORDER_TRANSITIONS[s].length === 0);

export const PAYMENT_METHODS = ["cod", "fib", "zaincash", "fastpay", "qicard"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: "COD",
  fib: "FIB",
  zaincash: "ZainCash",
  fastpay: "FastPay",
  qicard: "Qi Card",
};

/** The next step on the happy path, shown as the big primary action in the dashboard. */
export const PRIMARY_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "shipped",
  postponed: "shipped",
  shipped: "delivered",
};
/** Changes the seller confirms in a dialog first (they take the order off the delivery path). */
export const CONFIRM_FIRST: readonly OrderStatus[] = ["cancelled", "refused", "returned"];
