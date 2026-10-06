export type PricedLine = { unitPrice: number; quantity: number };

export type Totals = { subtotal: number; deliveryFee: number; total: number; lines: number[] };

/** Pure order-total arithmetic in whole dinars. Throws on anything that is not a safe non-negative integer. */
export function computeTotals(lines: PricedLine[], deliveryFee: number): Totals {
  const check = (n: number, what: string, min = 0) => {
    if (!Number.isSafeInteger(n) || n < min) throw new Error(`Invalid ${what}: ${n}`);
  };
  check(deliveryFee, "delivery fee");
  const lineTotals = lines.map((l) => {
    check(l.unitPrice, "unit price");
    check(l.quantity, "quantity", 1);
    const t = l.unitPrice * l.quantity;
    check(t, "line total");
    return t;
  });
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  check(subtotal, "subtotal");
  const total = subtotal + deliveryFee;
  check(total, "total");
  return { subtotal, deliveryFee, total, lines: lineTotals };
}
