import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { customers, orderEvents, products } from "@/server/db/schema";
import { placeOrder, quoteCart, updateOrderStatus, storeStats, startOfIraqDay } from "@/server/services/orders";
import { upsertZone } from "@/server/services/settings";
import { AppError } from "@/server/errors";
import { checkout, enable, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

const stockOf = async (id: string) =>
  (await database.query.products.findFirst({ where: eq(products.id, id) }))!.stock;

describe("checkout: order totals", () => {
  it("prices from the DB and adds the city delivery fee", async () => {
    const { store } = await seller(database, "tot");
    const dress = await product(database, store.id, 85_000);
    const honey = await product(database, store.id, 25_000);
    const order = await placeOrder(
      database,
      store,
      checkout(
        [
          { productId: dress.id, quantity: 1 },
          { productId: honey.id, quantity: 2 },
        ],
        { cityKey: "baghdad" },
      ),
    );
    expect(order.subtotal).toBe(135_000);
    expect(order.deliveryFee).toBe(6_000);
    expect(order.total).toBe(141_000);
    expect(order.number).toBe(1001);
    expect(order.items.map((i) => i.lineTotal).sort()).toEqual([50_000, 85_000]);
    expect(order.paymentStatus).toBe("unpaid");
    expect(order.publicId.length).toBeGreaterThanOrEqual(16);
  });

  it("ignores any client-supplied price field", async () => {
    const { store } = await seller(database, "tamper");
    const p = await product(database, store.id, 40_000);
    const input = checkout([{ productId: p.id, quantity: 1 }]) as ReturnType<typeof checkout> & { total?: number };
    input.total = 1;
    (input.items[0] as Record<string, unknown>).price = 1;
    const order = await placeOrder(database, store, input);
    expect(order.total).toBe(43_000);
  });

  it("merges duplicate lines and numbers orders sequentially per store", async () => {
    const { store } = await seller(database, "seq");
    const p = await product(database, store.id, 1_000, 5);
    const o1 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }, { productId: p.id, quantity: 2 }]));
    expect(o1.items).toHaveLength(1);
    expect(o1.items[0]!.quantity).toBe(3);
    const o2 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    expect(o2.number).toBe(o1.number + 1);
  });

  it("uses an edited zone fee and rejects unknown/inactive cities", async () => {
    const { store } = await seller(database, "zone");
    const p = await product(database, store.id, 10_000);
    await upsertZone(database, store.id, { cityKey: "erbil", name: { en: "Erbil" }, fee: 0, isActive: true });
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    expect(o.total).toBe(10_000);
    await upsertZone(database, store.id, { cityKey: "erbil", name: { en: "Erbil" }, fee: 0, isActive: false });
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]))).rejects.toMatchObject({
      message: "invalid_city",
    });
    await expect(
      placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { cityKey: "atlantis" })),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects payment methods the seller has not enabled or the server has not configured", async () => {
    const { store } = await seller(database, "pm");
    const p = await product(database, store.id, 10_000);
    await expect(
      placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "fib" })),
    ).rejects.toMatchObject({ message: "payment_method_unavailable" });
    await enable(database, store.id, "fib");
    await expect(
      placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "fib" }), {
        isProviderAvailable: () => false,
      }),
    ).rejects.toMatchObject({ message: "payment_method_unavailable" });
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "fib" }), {
      isProviderAvailable: () => true,
    });
    expect(o.paymentStatus).toBe("pending");
  });

  it("upserts the customer and accumulates their spend", async () => {
    const { store } = await seller(database, "cust");
    const p = await product(database, store.id, 5_000, null);
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }]));
    const c = await database.query.customers.findMany({ where: eq(customers.storeId, store.id) });
    expect(c).toHaveLength(1);
    expect(c[0]!.ordersCount).toBe(2);
    expect(c[0]!.totalSpent).toBe(8_000 + 13_000);
  });
});

describe("checkout: stock", () => {
  it("decrements tracked stock and leaves untracked (null) stock alone", async () => {
    const { store } = await seller(database, "stock");
    const tracked = await product(database, store.id, 1_000, 5);
    const untracked = await product(database, store.id, 1_000, null);
    await placeOrder(
      database,
      store,
      checkout([
        { productId: tracked.id, quantity: 3 },
        { productId: untracked.id, quantity: 7 },
      ]),
    );
    expect(await stockOf(tracked.id)).toBe(2);
    expect(await stockOf(untracked.id)).toBeNull();
  });

  it("fails with OUT_OF_STOCK and rolls back every line when one is short", async () => {
    const { store } = await seller(database, "short");
    const a = await product(database, store.id, 1_000, 5);
    const b = await product(database, store.id, 1_000, 1);
    await expect(
      placeOrder(
        database,
        store,
        checkout([
          { productId: a.id, quantity: 2 },
          { productId: b.id, quantity: 2 },
        ]),
      ),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await stockOf(a.id)).toBe(5); // rolled back
    expect(await stockOf(b.id)).toBe(1);
  });

  it("never oversells the last unit under concurrent checkouts", async () => {
    const { store } = await seller(database, "race");
    const p = await product(database, store.id, 1_000, 1);
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(0);
  });

  it("restocks when an order is cancelled", async () => {
    const { store, user } = await seller(database, "cancel");
    const p = await product(database, store.id, 1_000, 4);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 3 }]));
    expect(await stockOf(p.id)).toBe(1);
    await updateOrderStatus(database, store.id, o.id, "cancelled", user.id);
    expect(await stockOf(p.id)).toBe(4);
  });

  it("rejects inactive products", async () => {
    const { store } = await seller(database, "inactive");
    const p = await product(database, store.id, 1_000, 4);
    await database.update(products).set({ isActive: false }).where(eq(products.id, p.id));
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]))).rejects.toMatchObject({
      message: "product_unavailable",
    });
  });
});

describe("order status flow", () => {
  it("follows pending → confirmed → shipped → delivered and marks COD paid", async () => {
    const { store, user } = await seller(database, "flow");
    const p = await product(database, store.id, 2_000);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    await expect(updateOrderStatus(database, store.id, o.id, "delivered", user.id)).rejects.toMatchObject({
      message: "invalid_transition",
    });
    await updateOrderStatus(database, store.id, o.id, "confirmed", user.id);
    await updateOrderStatus(database, store.id, o.id, "shipped", user.id);
    const done = await updateOrderStatus(database, store.id, o.id, "delivered", user.id);
    expect(done.paymentStatus).toBe("paid");
    await expect(updateOrderStatus(database, store.id, o.id, "cancelled", user.id)).rejects.toBeInstanceOf(AppError);
    const events = await database.query.orderEvents.findMany({ where: eq(orderEvents.orderId, o.id) });
    expect(events.map((e) => e.toStatus)).toEqual(["pending", "confirmed", "shipped", "delivered"]);
  });
});

describe("COD status expansion", () => {
  it("refused at the door does not restock; returned does; history snapshots courier + tracking", async () => {
    const { store, user } = await seller(database, "refuse");
    const p = await product(database, store.id, 4_000, 5);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }]));
    expect(o.status).toBe("pending");
    expect(o.governorateKey).toBe("erbil");
    expect(await stockOf(p.id)).toBe(3);
    await updateOrderStatus(database, store.id, o.id, "confirmed", user.id);
    const shipped = await updateOrderStatus(database, store.id, o.id, "shipped", user.id, undefined, {
      courierName: " Al-Waseet ",
      trackingNumber: "WS-123456",
    });
    expect(shipped).toMatchObject({ courierName: "Al-Waseet", trackingNumber: "WS-123456" });
    await updateOrderStatus(database, store.id, o.id, "refused", user.id, "customer not home, refused on call");
    expect(await stockOf(p.id)).toBe(3);
    await updateOrderStatus(database, store.id, o.id, "returned", user.id);
    expect(await stockOf(p.id)).toBe(5);
    const events = await database.query.orderEvents.findMany({ where: eq(orderEvents.orderId, o.id) });
    expect(events.map((e) => e.toStatus)).toEqual(["pending", "confirmed", "shipped", "refused", "returned"]);
    expect(events.find((e) => e.toStatus === "shipped")).toMatchObject({ courierName: "Al-Waseet", trackingNumber: "WS-123456" });
    await expect(updateOrderStatus(database, store.id, o.id, "shipped", user.id)).rejects.toMatchObject({
      message: "invalid_transition",
    });
  });

  it("postponed can be re-shipped; delivered-then-returned COD is refunded and excluded from revenue", async () => {
    const { store, user } = await seller(database, "postpone");
    const p = await product(database, store.id, 10_000, null);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    for (const s of ["confirmed", "shipped", "postponed", "shipped", "delivered"] as const) {
      await updateOrderStatus(database, store.id, o.id, s, user.id);
    }
    expect((await storeStats(database, store.id)).revenueWeek).toBe(13_000);
    const r = await updateOrderStatus(database, store.id, o.id, "returned", user.id);
    expect(r.paymentStatus).toBe("refunded");
    const s = await storeStats(database, store.id);
    expect(s.revenueWeek).toBe(0);
    expect(s.openOrders).toBe(0);
  });
});

describe("quote & stats", () => {
  it("flags unavailable lines and prices the rest", async () => {
    const { store } = await seller(database, "quote");
    const p = await product(database, store.id, 7_000, 1);
    const q = await quoteCart(
      database,
      store.id,
      [
        { productId: p.id, quantity: 1 },
        { productId: "00000000-0000-4000-8000-000000000000", quantity: 1 },
      ],
      "duhok",
      "en",
    );
    expect(q.lines.map((l) => l.available)).toEqual([true, false]);
    expect(q.total).toBe(12_000);
  });

  it("counts today's orders and this week's revenue, excluding cancelled", async () => {
    const { store, user } = await seller(database, "stats");
    const p = await product(database, store.id, 10_000, null);
    await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    const c = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    await updateOrderStatus(database, store.id, c.id, "cancelled", user.id);
    const s = await storeStats(database, store.id);
    expect(s.ordersToday).toBe(1);
    expect(s.revenueWeek).toBe(13_000);
  });

  it("computes the start of the Iraqi day (UTC+3)", () => {
    expect(startOfIraqDay(new Date("2026-10-06T22:30:00Z")).toISOString()).toBe("2026-10-06T21:00:00.000Z");
    expect(startOfIraqDay(new Date("2026-10-06T20:30:00Z")).toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });
});
