import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/totals";

describe("computeTotals", () => {
  it("sums lines and adds the delivery fee (whole dinars)", () => {
    const t = computeTotals(
      [
        { unitPrice: 85_000, quantity: 1 },
        { unitPrice: 25_000, quantity: 2 },
      ],
      3_000,
    );
    expect(t.lines).toEqual([85_000, 50_000]);
    expect(t.subtotal).toBe(135_000);
    expect(t.total).toBe(138_000);
  });

  it("allows a free-delivery zone and an empty cart", () => {
    expect(computeTotals([], 0)).toEqual({ subtotal: 0, deliveryFee: 0, total: 0, lines: [] });
  });

  it.each([
    [[{ unitPrice: 1.5, quantity: 1 }], 0],
    [[{ unitPrice: -1, quantity: 1 }], 0],
    [[{ unitPrice: 100, quantity: 0 }], 0],
    [[{ unitPrice: 100, quantity: 1 }], -500],
    [[{ unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 }], 0],
  ])("rejects invalid input %#", (lines, fee) => {
    expect(() => computeTotals(lines, fee)).toThrow();
  });
});
