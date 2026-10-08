import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFIRM_FIRST,
  OPEN_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  PRIMARY_NEXT,
  RESTOCK_ON,
  TERMINAL_ORDER_STATUSES,
  canTransition,
  isOrderStatus,
  type OrderStatus,
} from "@/lib/order-status";
import { codAmountToCollect } from "@/server/services/orders";

/** Pure checks on the COD status model the dashboard buttons are built from (no database). */

const reachableFrom = (start: OrderStatus): Set<OrderStatus> => {
  const seen = new Set<OrderStatus>([start]);
  const queue: OrderStatus[] = [start];
  while (queue.length) {
    for (const n of ORDER_TRANSITIONS[queue.shift()!]) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
};

describe("order status graph", () => {
  it("every status has a transition list and only points at real statuses, never at itself", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[s]).toBeDefined();
      for (const to of ORDER_TRANSITIONS[s]) {
        expect(isOrderStatus(to)).toBe(true);
        expect(to).not.toBe(s);
      }
    }
  });

  it("canTransition matches the table for every pair (8 × 8)", () => {
    for (const from of ORDER_STATUSES)
      for (const to of ORDER_STATUSES) expect(canTransition(from, to)).toBe(ORDER_TRANSITIONS[from].includes(to));
  });

  it("every status is reachable from a new order, and every non-terminal status can still end", () => {
    expect([...reachableFrom("pending")].sort()).toEqual([...ORDER_STATUSES].sort());
    for (const s of ORDER_STATUSES) {
      const ends = [...reachableFrom(s)].some((r) => TERMINAL_ORDER_STATUSES.includes(r));
      expect(ends, `${s} can reach a terminal status`).toBe(true);
    }
  });

  it("terminal statuses are exactly returned + cancelled; open statuses are the non-terminal pre-delivery ones", () => {
    expect([...TERMINAL_ORDER_STATUSES].sort()).toEqual(["cancelled", "returned"]);
    for (const s of OPEN_ORDER_STATUSES) expect(TERMINAL_ORDER_STATUSES).not.toContain(s);
  });

  it("happy path walks pending → confirmed → shipped → delivered using only PRIMARY_NEXT", () => {
    const path: OrderStatus[] = ["pending"];
    let cur: OrderStatus | undefined = "pending";
    while ((cur = PRIMARY_NEXT[cur])) path.push(cur);
    expect(path).toEqual(["pending", "confirmed", "shipped", "delivered"]);
    // A postponed order resumes by going out for delivery.
    expect(PRIMARY_NEXT.postponed).toBe("shipped");
  });

  it("restocking statuses always ask for confirmation first; refused asks too but does not restock", () => {
    for (const s of RESTOCK_ON) expect(CONFIRM_FIRST).toContain(s);
    expect(RESTOCK_ON).not.toContain("refused");
    expect(CONFIRM_FIRST).toContain("refused");
    // The primary (big) button is never a destructive change.
    for (const to of Object.values(PRIMARY_NEXT)) expect(CONFIRM_FIRST).not.toContain(to);
  });

  it("delivered orders can only come back as returned (no cancelling after delivery)", () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual(["returned"]);
    expect(ORDER_TRANSITIONS.refused).toEqual(["returned"]);
  });
});

describe("COD amount to collect", () => {
  it("is the total for unpaid / pending COD, zero once paid or refunded, zero for online payments", () => {
    expect(codAmountToCollect({ paymentMethod: "cod", paymentStatus: "unpaid", total: 25000 })).toBe(25000);
    expect(codAmountToCollect({ paymentMethod: "cod", paymentStatus: "pending", total: 25000 })).toBe(25000);
    expect(codAmountToCollect({ paymentMethod: "cod", paymentStatus: "paid", total: 25000 })).toBe(0);
    expect(codAmountToCollect({ paymentMethod: "cod", paymentStatus: "refunded", total: 25000 })).toBe(0);
    expect(codAmountToCollect({ paymentMethod: "fib", paymentStatus: "unpaid", total: 25000 })).toBe(0);
    expect(codAmountToCollect({ paymentMethod: "zaincash", paymentStatus: "paid", total: 25000 })).toBe(0);
  });
});

describe("status flow strings exist in all four locales", () => {
  const keys = [
    ...ORDER_STATUSES.map((s) => `status_${s}`),
    ...ORDER_STATUSES.filter((s) => s !== "pending").map((s) => `action_${s}`),
    ...CONFIRM_FIRST.map((s) => `confirmBody_${s}`),
    "shipDetails", "courierName", "trackingNumber", "note", "confirmTitle", "confirmKeep",
    "copyTrackingLink", "trackingLinkHint", "courier", "tracking", "packingSlip", "print",
    "slipCollect", "slipNothing", "slipDeliverTo", "slipPhone", "slipCity", "slipArea", "slipLandmark",
    "slipQty", "slipTrack", "slipScan", "slipHint",
  ];
  for (const locale of ["ku", "kmr", "ar", "en"]) {
    it(`${locale}: every orders.* key the status actions and packing slip use is translated`, () => {
      const orders = (JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as { orders: Record<string, string> }).orders;
      const missing = keys.filter((k) => typeof orders?.[k] !== "string" || !orders[k]!.trim());
      expect(missing).toEqual([]);
      expect(orders.confirmTitle).toContain("{number}");
    });
  }
});
