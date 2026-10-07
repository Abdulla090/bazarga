import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { placeOrder, updateOrderStatus } from "@/server/services/orders";
import { findOrderForTracking, getTrackedOrder, trackOrder, TRACK_IP_LIMIT, TRACK_ORDER_LIMIT } from "@/server/services/tracking";
import { buildTrackingTimeline, parseOrderNumber, trackingPath } from "@/lib/order-tracking";
import { orderSummaryText } from "@/lib/whatsapp";
import { checkoutSchema } from "@/lib/validation";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

/** Place an order the way the storefront does: the payload goes through the checkout schema (phone → +964…). */
async function order(label: string, phone = "0770 111 2233") {
  const s = await seller(database, label);
  const p = await product(database, s.store.id, 20_000);
  const input = checkoutSchema.parse({ ...checkout([{ productId: p.id, quantity: 2 }]), phone, notes: undefined, landmark: "Bazaar mosque" });
  const placed = await placeOrder(database, s.store, input);
  return { ...s, order: placed };
}

describe("order tracking: lookup", () => {
  it("finds the order with its number + the checkout phone, with items, totals and history", async () => {
    const { store, user, order: o } = await order("trk");
    expect(o.customerPhone).toBe("+9647701112233");
    await updateOrderStatus(database, store.id, o.id, "confirmed", user.id, "called her — internal note");
    const found = await findOrderForTracking(database, store.id, String(o.number), "07701112233");
    expect(found).not.toBeNull();
    expect(found!.number).toBe(o.number);
    expect(found!.status).toBe("confirmed");
    expect(found!.items).toHaveLength(1);
    expect(found!.items[0]).toMatchObject({ quantity: 2, lineTotal: 40_000 });
    expect(found!.total).toBe(o.total);
    expect(found!.deliveryFee).toBe(o.deliveryFee);
    expect(found!.events.map((e) => e.toStatus)).toEqual(["pending", "confirmed"]);
    // Shopper-safe shape: no address, notes, internal ids or seller notes.
    expect(Object.keys(found!)).not.toEqual(expect.arrayContaining(["address"]));
    expect(JSON.stringify(found)).not.toContain("internal note");
    expect(JSON.stringify(found)).not.toContain(o.id);
  });

  it("normalises the phone like checkout: +964, 00964, spaces, Eastern Arabic digits, '#' before the number", async () => {
    const { store, order: o } = await order("norm");
    for (const phone of ["+964 770 111 2233", "00964-770-111-2233", "٠٧٧٠ ١١١ ٢٢٣٣", "7701112233", "964 7701112233"]) {
      expect(await findOrderForTracking(database, store.id, `#${o.number}`, phone), phone).not.toBeNull();
    }
    const eastern = String(o.number).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
    expect(await findOrderForTracking(database, store.id, eastern, "07701112233")).not.toBeNull();
  });

  it("returns the same not-found for a wrong phone, a wrong number or junk", async () => {
    const { store, order: o } = await order("wrong");
    expect(await findOrderForTracking(database, store.id, String(o.number), "07701112234")).toBeNull();
    expect(await findOrderForTracking(database, store.id, String(o.number + 1), "07701112233")).toBeNull();
    expect(await findOrderForTracking(database, store.id, String(o.number), "")).toBeNull();
    expect(await findOrderForTracking(database, store.id, "abc", "07701112233")).toBeNull();
    expect(await findOrderForTracking(database, store.id, String(o.number), "0760 111 2233")).toBeNull(); // not an operator
    const a = await trackOrder(database, { storeId: store.id, ip: "203.0.113.5", number: String(o.number), phone: "07701112299" });
    const b = await trackOrder(database, { storeId: store.id, ip: "203.0.113.5", number: "999999", phone: "07701112233" });
    expect(a).toEqual({ ok: false, reason: "not_found" });
    expect(b).toEqual(a);
  });

  it("is scoped to the store: another store can't see the order even with the right number + phone", async () => {
    const mine = await order("own");
    const other = await order("oth", "0750 999 8877");
    // Both stores start numbering at the same value; the phone decides nothing across stores.
    expect(other.order.number).toBe(mine.order.number);
    expect(await findOrderForTracking(database, other.store.id, String(mine.order.number), "07701112233")).toBeNull();
    expect(await findOrderForTracking(database, mine.store.id, String(mine.order.number), "07509998877")).toBeNull();
    expect(await getTrackedOrder(database, other.store.id, mine.order.publicId)).toBeNull();
    expect((await getTrackedOrder(database, mine.store.id, mine.order.publicId))?.number).toBe(mine.order.number);
    expect(await getTrackedOrder(database, mine.store.id, "bad id!")).toBeNull();
  });

  it("matches a legacy 9647… phone row too", async () => {
    const s = await seller(database, "legacy");
    const p = await product(database, s.store.id, 5_000);
    const o = await placeOrder(database, s.store, checkout([{ productId: p.id, quantity: 1 }])); // phone stored as given: 9647701112233
    expect(o.customerPhone).toBe("9647701112233");
    expect(await findOrderForTracking(database, s.store.id, String(o.number), "0770 111 2233")).not.toBeNull();
  });
});

describe("order tracking: rate limit", () => {
  it(`allows ${TRACK_IP_LIMIT} lookups per IP per store, then rate-limits that IP only`, async () => {
    const { store, order: o } = await order("rlip");
    const ip = "198.51.100.7";
    for (let i = 0; i < TRACK_IP_LIMIT; i++) {
      // Different numbers so the per-order limit never kicks in first.
      const r = await trackOrder(database, { storeId: store.id, ip, number: String(5000 + i), phone: "07701112233" });
      expect(r).toEqual({ ok: false, reason: "not_found" });
    }
    expect(await trackOrder(database, { storeId: store.id, ip, number: String(o.number), phone: "07701112233" })).toEqual({ ok: false, reason: "rate_limited" });
    const fresh = await trackOrder(database, { storeId: store.id, ip: "198.51.100.8", number: String(o.number), phone: "07701112233" });
    expect(fresh.ok).toBe(true);
  });

  it(`caps guesses on one order number across IPs at ${TRACK_ORDER_LIMIT}`, async () => {
    const { store, order: o } = await order("rlord");
    for (let i = 0; i < TRACK_ORDER_LIMIT; i++) {
      const r = await trackOrder(database, { storeId: store.id, ip: `192.0.2.${i}`, number: String(o.number), phone: `077011122${10 + i}` });
      expect(r.ok).toBe(false);
    }
    const r = await trackOrder(database, { storeId: store.id, ip: "192.0.2.200", number: String(o.number), phone: "07701112233" });
    expect(r).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("order tracking: helpers", () => {
  it("parses shopper-typed order numbers", () => {
    expect(parseOrderNumber("1001")).toBe(1001);
    expect(parseOrderNumber(" #1 001 ")).toBe(1001);
    expect(parseOrderNumber("١٠٠١")).toBe(1001);
    expect(parseOrderNumber("۱۰۰۱")).toBe(1001);
    expect(parseOrderNumber("0")).toBeNull();
    expect(parseOrderNumber("12a")).toBeNull();
    expect(parseOrderNumber("1234567890")).toBeNull();
    expect(parseOrderNumber(null)).toBeNull();
  });

  const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 10, m));
  const states = (t: ReturnType<typeof buildTrackingTimeline>) => t.map((s) => `${s.status}:${s.state}`);

  it("builds the main-path timeline", () => {
    expect(states(buildTrackingTimeline("pending", [{ toStatus: "pending", createdAt: at(0) }]))).toEqual([
      "pending:current", "confirmed:upcoming", "shipped:upcoming", "delivered:upcoming",
    ]);
    const shipped = buildTrackingTimeline("shipped", [
      { toStatus: "pending", createdAt: at(0) },
      { toStatus: "confirmed", createdAt: at(5) },
      { toStatus: "shipped", createdAt: at(9) },
    ]);
    expect(states(shipped)).toEqual(["pending:done", "confirmed:done", "shipped:current", "delivered:upcoming"]);
    expect(shipped[2]!.at).toEqual(at(9));
    expect(shipped[3]!.at).toBeNull();
    expect(states(buildTrackingTimeline("delivered", []))).toEqual(["pending:done", "confirmed:done", "shipped:done", "delivered:done"]);
  });

  it("shows exceptions after the last step reached", () => {
    const ev = [
      { toStatus: "pending" as const, createdAt: at(0) },
      { toStatus: "confirmed" as const, createdAt: at(1) },
      { toStatus: "postponed" as const, createdAt: at(2) },
    ];
    expect(states(buildTrackingTimeline("postponed", ev))).toEqual(["pending:done", "confirmed:done", "postponed:current", "shipped:upcoming", "delivered:upcoming"]);
    expect(buildTrackingTimeline("postponed", ev)[2]!.tone).toBe("warn");
    expect(states(buildTrackingTimeline("cancelled", [{ toStatus: "pending", createdAt: at(0) }, { toStatus: "cancelled", createdAt: at(3) }]))).toEqual(["pending:done", "cancelled:current"]);
    const returned = buildTrackingTimeline("returned", [
      { toStatus: "pending", createdAt: at(0) },
      { toStatus: "confirmed", createdAt: at(1) },
      { toStatus: "shipped", createdAt: at(2) },
      { toStatus: "refused", createdAt: at(3) },
      { toStatus: "returned", createdAt: at(4) },
    ]);
    expect(states(returned)).toEqual(["pending:done", "confirmed:done", "shipped:done", "refused:done", "returned:current"]);
    expect(returned.at(-1)!.tone).toBe("bad");
  });

  it("puts the tracking link in the WhatsApp order summary", () => {
    const url = `https://mymarket.app${trackingPath("hawler-bazaar", 1001)}`;
    expect(url).toBe("https://mymarket.app/s/hawler-bazaar/track?n=1001");
    const base = {
      storeName: "Hawler Bazaar", orderNumber: 1001, items: [{ name: "Honey", quantity: 1, lineTotal: 25_000 }],
      subtotal: 25_000, deliveryFee: 3_000, total: 28_000, customerName: "Shilan", cityName: "Erbil", address: "Shawes", paymentLabel: "COD",
    };
    expect(orderSummaryText({ ...base, trackUrl: url }, "ku")).toContain(`بەدواداچوونی داواکاری: ${url}`);
    expect(orderSummaryText({ ...base, trackUrl: url }, "ar")).toContain(`تتبع الطلب: ${url}`);
    expect(orderSummaryText({ ...base, trackUrl: url }, "en")).toContain(`Track order: ${url}`);
    expect(orderSummaryText(base, "en")).not.toContain("Track order");
  });
});
