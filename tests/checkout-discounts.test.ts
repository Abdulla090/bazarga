import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { customers, deliveryAreas, deliveryZones, discountCodes, orders, products, stores } from "@/server/db/schema";
import { claimDiscountUse, freeDeliveryRemaining, placeOrder, quoteCart } from "@/server/services/orders";
import { checkoutSchema } from "@/lib/validation";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

type CodeOpts = Partial<typeof discountCodes.$inferInsert>;
async function code(storeId: string, o: CodeOpts & { code: string; type: "percentage" | "fixed" | "free_delivery" }) {
  const [row] = await database.insert(discountCodes).values({ storeId, value: 0, ...o }).returning();
  return row!;
}
const usedCount = async (id: string) => (await database.query.discountCodes.findFirst({ where: eq(discountCodes.id, id) }))!.usedCount;
const erbilZone = async (storeId: string) =>
  (await database.query.deliveryZones.findFirst({ where: and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.cityKey, "erbil")) }))!;
const fail = (p: Promise<unknown>, message: string) => expect(p).rejects.toMatchObject({ message });

describe("discount codes at checkout", () => {
  it("applies a percentage code (rounded down), records it on the order and counts the use", async () => {
    const { store } = await seller(database, "dpct");
    const p = await product(database, store.id, 33_333);
    const c = await code(store.id, { code: "NEWROZ", type: "percentage", value: 10 });
    const zone = await erbilZone(store.id);
    const order = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "newroz " }));
    expect(order.discountAmount).toBe(3_333);
    expect(order.discountCode).toBe("NEWROZ");
    expect(order.discountCodeId).toBe(c.id);
    expect(order.deliveryFee).toBe(zone.fee);
    expect(order.total).toBe(33_333 - 3_333 + zone.fee);
    expect(await usedCount(c.id)).toBe(1);
  });

  it("fixed code never exceeds the subtotal; free_delivery code zeroes the fee", async () => {
    const { store } = await seller(database, "dfix");
    const p = await product(database, store.id, 5_000);
    await code(store.id, { code: "BIG", type: "fixed", value: 9_000 });
    await code(store.id, { code: "SHIPFREE", type: "free_delivery" });
    const a = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "BIG" }));
    expect(a.discountAmount).toBe(5_000);
    expect(a.total).toBe(a.deliveryFee);
    const b = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "SHIPFREE" }));
    expect(b.deliveryFee).toBe(0);
    expect(b.total).toBe(5_000);
  });

  it("rejects unknown, inactive, out-of-window, below-minimum and used-up codes without side effects", async () => {
    const { store } = await seller(database, "drej");
    const p = await product(database, store.id, 10_000, 5);
    const now = Date.now();
    await code(store.id, { code: "OFF", type: "fixed", value: 1000, isActive: false });
    await code(store.id, { code: "SOON", type: "fixed", value: 1000, startsAt: new Date(now + 86_400_000) });
    await code(store.id, { code: "OLD", type: "fixed", value: 1000, endsAt: new Date(now - 1000) });
    await code(store.id, { code: "MIN", type: "fixed", value: 1000, minSubtotal: 20_000 });
    const gone = await code(store.id, { code: "GONE", type: "fixed", value: 1000, maxUses: 1, usedCount: 1 });
    const one = (discountCode: string) => placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode }));
    await fail(one("NOPE"), "discount_invalid");
    await fail(one("OFF"), "discount_inactive");
    await fail(one("SOON"), "discount_not_started");
    await fail(one("OLD"), "discount_expired");
    await fail(one("MIN"), "discount_below_minimum");
    await fail(one("GONE"), "discount_used_up");
    // Every attempt rolled back: no order, stock untouched, counter untouched.
    expect(await database.query.orders.findMany({ where: eq(orders.storeId, store.id) })).toHaveLength(0);
    expect((await database.query.products.findFirst({ where: eq(products.id, p.id) }))!.stock).toBe(5);
    expect(await usedCount(gone.id)).toBe(1);
  });

  it("does not consume a use when the order fails later (out of stock)", async () => {
    const { store } = await seller(database, "droll");
    const p = await product(database, store.id, 10_000, 1);
    const c = await code(store.id, { code: "ONCE", type: "fixed", value: 1000, maxUses: 5 });
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }], { discountCode: "ONCE" }))).rejects.toMatchObject({ message: "out_of_stock" });
    expect(await usedCount(c.id)).toBe(0);
  });

  it("concurrent checkouts can't exceed the usage limit", async () => {
    const { store } = await seller(database, "drace");
    const p = await product(database, store.id, 10_000, null);
    const c = await code(store.id, { code: "LAST3", type: "fixed", value: 1000, maxUses: 3 });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "LAST3", phone: `+96477011122${String(i).padStart(2, "0")}` })),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(rejected.every((r) => (r.reason as Error).message === "discount_used_up")).toBe(true);
    expect(await usedCount(c.id)).toBe(3);
    const placed = await database.query.orders.findMany({ where: eq(orders.storeId, store.id) });
    expect(placed.filter((o) => o.discountCodeId === c.id)).toHaveLength(3);
  });

  it("claimDiscountUse is a conditional UPDATE: stops at the limit and respects the window", async () => {
    const { store } = await seller(database, "dclaim");
    const c = await code(store.id, { code: "TWO", type: "fixed", value: 1, maxUses: 2 });
    const claims = await Promise.all(Array.from({ length: 6 }, () => claimDiscountUse(database, c.id)));
    expect(claims.filter(Boolean)).toHaveLength(2);
    expect(await usedCount(c.id)).toBe(2);
    const late = await code(store.id, { code: "LATE", type: "fixed", value: 1, endsAt: new Date(Date.now() + 60_000) });
    expect(await claimDiscountUse(database, late.id, new Date(Date.now() + 120_000))).toBe(false);
    expect(await claimDiscountUse(database, late.id)).toBe(true);
  });

  it("codes are per store", async () => {
    const a = await seller(database, "dsa");
    const b = await seller(database, "dsb");
    await code(a.store.id, { code: "MINE", type: "fixed", value: 1000 });
    const p = await product(database, b.store.id, 10_000);
    await fail(placeOrder(database, b.store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "MINE" })), "discount_invalid");
  });

  it("quote reports the discount or why it doesn't apply", async () => {
    const { store } = await seller(database, "dq");
    const p = await product(database, store.id, 10_000);
    await code(store.id, { code: "TEN", type: "percentage", value: 10, minSubtotal: 15_000 });
    const below = await quoteCart(database, store.id, [{ productId: p.id, quantity: 1 }], "erbil", "ku", { discountCode: "ten" });
    expect(below.discountError).toBe("discount_below_minimum");
    expect(below.discountAmount).toBe(0);
    const ok = await quoteCart(database, store.id, [{ productId: p.id, quantity: 2 }], "erbil", "ku", { discountCode: "ten" });
    expect(ok.discountError).toBeNull();
    expect(ok.discountCode).toBe("TEN");
    expect(ok.discountAmount).toBe(2_000);
    expect(ok.total).toBe(18_000 + ok.deliveryFee);
    const bad = await quoteCart(database, store.id, [{ productId: p.id, quantity: 1 }], "erbil", "ku", { discountCode: "zzz!" });
    expect(bad.discountError).toBe("discount_invalid");
  });
});

describe("free-delivery threshold", () => {
  it("remaining amount helper", () => {
    expect(freeDeliveryRemaining(30_000, 50_000)).toBe(20_000);
    expect(freeDeliveryRemaining(50_000, 50_000)).toBeNull();
    expect(freeDeliveryRemaining(0, 50_000)).toBeNull();
    expect(freeDeliveryRemaining(30_000, null)).toBeNull();
  });

  it("quote shows how much more is needed, then free delivery; order applies it", async () => {
    const { store } = await seller(database, "thr");
    await database.update(stores).set({ freeDeliveryThreshold: 50_000 }).where(eq(stores.id, store.id));
    const p = await product(database, store.id, 20_000, null);
    const zone = await erbilZone(store.id);
    const q1 = await quoteCart(database, store.id, [{ productId: p.id, quantity: 2 }], "erbil", "ku");
    expect(q1.freeDelivery).toBe(false);
    expect(q1.freeDeliveryRemaining).toBe(10_000);
    expect(q1.deliveryFee).toBe(zone.fee);
    const q2 = await quoteCart(database, store.id, [{ productId: p.id, quantity: 3 }], "erbil", "ku");
    expect(q2.freeDelivery).toBe(true);
    expect(q2.freeDeliveryRemaining).toBeNull();
    expect(q2.deliveryFee).toBe(0);
    expect(q2.total).toBe(60_000);
    const below = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }]));
    expect(below.deliveryFee).toBe(zone.fee);
    const over = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 3 }]));
    expect(over.deliveryFee).toBe(0);
    expect(over.total).toBe(60_000);
  });

  it("threshold is checked before the code's discount", async () => {
    const { store } = await seller(database, "thr2");
    await database.update(stores).set({ freeDeliveryThreshold: 50_000 }).where(eq(stores.id, store.id));
    const p = await product(database, store.id, 50_000, null);
    await code(store.id, { code: "HALF", type: "percentage", value: 50 });
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { discountCode: "HALF" }));
    expect(o.discountAmount).toBe(25_000);
    expect(o.deliveryFee).toBe(0);
    expect(o.total).toBe(25_000);
  });
});

describe("delivery area + landmark", () => {
  it("uses the area's own fee and saves area + landmark on the order and customer", async () => {
    const { store } = await seller(database, "area");
    const zone = await erbilZone(store.id);
    const [ankawa] = await database.insert(deliveryAreas).values({ storeId: store.id, zoneId: zone.id, name: { ku: "عەنکاوە", en: "Ankawa" }, fee: 2_000 }).returning();
    const p = await product(database, store.id, 10_000);
    const q = await quoteCart(database, store.id, [{ productId: p.id, quantity: 1 }], "erbil", "en", { areaId: ankawa!.id });
    expect(q.deliveryFee).toBe(2_000);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { areaId: ankawa!.id, landmark: "Behind the Bazaar Mosque", address: "", locale: "en" }));
    expect(o.areaId).toBe(ankawa!.id);
    expect(o.areaName).toBe("Ankawa");
    expect(o.landmark).toBe("Behind the Bazaar Mosque");
    expect(o.deliveryFee).toBe(2_000);
    const cust = await database.query.customers.findFirst({ where: eq(customers.id, o.customerId!) });
    expect(cust?.landmark).toBe("Behind the Bazaar Mosque");
    expect(cust?.areaName).toBe("Ankawa");
  });

  it("'other area' keeps the zone fee; a foreign area id is rejected", async () => {
    const a = await seller(database, "areaA");
    const b = await seller(database, "areaB");
    const zoneB = await erbilZone(b.store.id);
    const [foreign] = await database.insert(deliveryAreas).values({ storeId: b.store.id, zoneId: zoneB.id, name: { en: "X" }, fee: 0 }).returning();
    const p = await product(database, a.store.id, 10_000);
    const zoneA = await erbilZone(a.store.id);
    const other = await placeOrder(database, a.store, checkout([{ productId: p.id, quantity: 1 }], { areaOther: "Shawes" }));
    expect(other.areaName).toBe("Shawes");
    expect(other.areaId).toBeNull();
    expect(other.deliveryFee).toBe(zoneA.fee);
    await fail(placeOrder(database, a.store, checkout([{ productId: p.id, quantity: 1 }], { areaId: foreign!.id })), "invalid_area");
  });

  it("checkout schema needs a landmark or an address and normalises the phone", () => {
    const base = { items: [{ productId: "00000000-0000-4000-8000-000000000000", quantity: 1 }], customerName: "Shilan", cityKey: "erbil", paymentMethod: "cod" };
    const ok = checkoutSchema.parse({ ...base, phone: "٠٧٥٠ ١٢٣ ٤٥٦٧", landmark: "Near the Citadel", areaId: "" });
    expect(ok.phone).toBe("+9647501234567");
    expect(ok.address).toBe("");
    expect(ok.areaId).toBeNull();
    const none = checkoutSchema.safeParse({ ...base, phone: "07501234567" });
    expect(none.success).toBe(false);
    expect(none.error?.issues.map((i) => i.message)).toContain("address_required");
    const op = checkoutSchema.safeParse({ ...base, phone: "07601234567", address: "Street 60" });
    expect(op.error?.issues.map((i) => i.message)).toContain("phone_operator");
  });
});
