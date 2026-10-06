export const ORDER_STATUSES = ["new", "confirmed", "out_for_delivery", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed forward transitions. Delivered and cancelled are terminal. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export const PAYMENT_METHODS = ["cod", "fib", "zaincash", "fastpay", "qicard"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: "COD",
  fib: "FIB",
  zaincash: "ZainCash",
  fastpay: "FastPay",
  qicard: "Qi Card",
};
