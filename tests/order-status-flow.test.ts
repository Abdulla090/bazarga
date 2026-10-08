import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { orderEvents, orders, products, productVariants } from "@/server/db/schema";
import { codAmountToCollect, getPackingSlip, placeOrder, updateOrderStatus } from "@/server/services/orders";
import { ORDER_STATUSES, ORDER_TRANSITIONS, PRIMARY_NEXT, CONFIRM_FIRST, canTransition, type OrderStatus } from "@/lib/order-status";
import { orderStatusSchema } from "@/lib/validation";
import { checkout, enable, product, seller, testDb } from "./support/db";

/** COD status flow (seller dashboard): transitions, restock exactly once, COD paid, tenant isolation, packing slip. */
let database: Db;
beforeAll(async () => {
  database = await testDb();
});

const stockOf = async (id: string) => (await database.query.products.findFirst({ where: eq(products.id, id) }))!.stock;
const eventsOf = async (orderId: string) =>
  (await database.query.orderEvents.findMany({ where: eq(orderEvents.orderId, orderId) })).map((e) => e.toStatus);
const orderRow = async (id: string) => (await database.query.orders.findFirst({ where: eq(orders.id, id) }))!;

describe("status transitions are enforced in the service", () => {
  it("pending → confirmed → out for delivery (shipped) → delivered, each change in order_events", async () => {
    const { store, user } = await seller(database, "path");
    const p = await product(database, store.id, 5_000, 3);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    for (const s of ["confirmed", "shipped", "delivered"] as const) await updateOrderStatus(database, store.id, o.id, s, user.id);
    expect(await eventsOf(o.id)).toEqual(["pending", "confirmed", "shipped", "delivered"]);
    expect((await orderRow(o.id)).status).toBe("delivered");
  });

  it("rejects every transition not in ORDER_TRANSITIONS without changing the order or writing an event", async () => {
    const { store, user } = await seller(database, "matrix");
    const p = await product(database, store.id, 1_000, null);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    let rejected = 0;
    for (const from of ORDER_STATUSES) {
      // Put the order in `from` directly (bypassing the service) and try every illegal target.
      await database.update(orders).set({ status: from }).where(eq(orders.id, o.id));
      for (const to of ORDER_STATUSES) {
        if (canTransition(from, to)) continue;
        await expect(updateOrderStatus(database, store.id, o.id, to, user.id)).rejects.toMatchObject({ message: "invalid_transition" });
        rejected++;
      }
      expect((await orderRow(o.id)).status).toBe(from);
    }
    expect(rejected).toBeGreaterThan(40);
    expect(await eventsOf(o.id)).toEqual(["pending"]);
  });

  it("terminal states have no way out; the courier can bring a parcel straight back (shipped → returned)", () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.returned).toEqual([]);
    expect(canTransition("shipped", "returned")).toBe(true);
    expect(canTransition("pending", "returned")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    // Dashboard helpers only point at legal moves.
    for (const [from, to] of Object.entries(PRIMARY_NEXT)) expect(canTransition(from as OrderStatus, to)).toBe(true);
    expect([...CONFIRM_FIRST].sort()).toEqual(["cancelled", "refused", "returned"]);
  });

  it("courier + tracking number are saved only when marking out for delivery, and snapshotted in the event", async () => {
    const { store, user } = await seller(database, "courier");
    const p = await product(database, store.id, 1_000, null);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    const c = await updateOrderStatus(database, store.id, o.id, "confirmed", user.id, undefined, { courierName: "Ignored", trackingNumber: "X" });
    expect(c).toMatchObject({ courierName: null, trackingNumber: null });
    const s = await updateOrderStatus(database, store.id, o.id, "shipped", user.id, "left at 10", { courierName: " Miran Express ", trackingNumber: " ME-42 " });
    expect(s).toMatchObject({ courierName: "Miran Express", trackingNumber: "ME-42" });
    const d = await updateOrderStatus(database, store.id, o.id, "delivered", user.id);
    expect(d).toMatchObject({ courierName: "Miran Express", trackingNumber: "ME-42" });
    const ev = await database.query.orderEvents.findMany({ where: eq(orderEvents.orderId, o.id) });
    expect(ev.find((e) => e.toStatus === "shipped")).toMatchObject({ courierName: "Miran Express", trackingNumber: "ME-42", note: "left at 10" });
  });

  it("validates the dashboard input (status enum, courier / tracking length)", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(orderStatusSchema.safeParse({ orderId: id, status: "shipped", courierName: "Al-Waseet", trackingNumber: "WS-1" }).success).toBe(true);
    expect(orderStatusSchema.safeParse({ orderId: id, status: "out_for_delivery" }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ orderId: id, status: "shipped", courierName: "x".repeat(81) }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ orderId: "nope", status: "confirmed" }).success).toBe(false);
    expect(orderStatusSchema.parse({ orderId: id, status: "confirmed", note: "  " }).note).toBeUndefined();
  });
});

describe("restock on returned / cancelled happens exactly once", () => {
  it("cancel restocks once and marks restocked_at; a forced re-entry cannot restock again", async () => {
    const { store, user } = await seller(database, "once");
    const p = await product(database, store.id, 2_000, 5);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }]));
    expect(await stockOf(p.id)).toBe(3);
    await updateOrderStatus(database, store.id, o.id, "cancelled", user.id);
    expect(await stockOf(p.id)).toBe(5);
    expect((await orderRow(o.id)).restockedAt).toBeInstanceOf(Date);
    // Simulate any future path out of a terminal state (or a manual DB fix): the order is open again…
    await database.update(orders).set({ status: "confirmed" }).where(eq(orders.id, o.id));
    await updateOrderStatus(database, store.id, o.id, "cancelled", user.id);
    expect(await stockOf(p.id)).toBe(5); // …but its stock was already put back.
  });

  it("two racing cancels: one wins, stock comes back once", async () => {
    const { store, user } = await seller(database, "race");
    const p = await product(database, store.id, 2_000, 4);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 3 }]));
    const r = await Promise.allSettled([
      updateOrderStatus(database, store.id, o.id, "cancelled", user.id),
      updateOrderStatus(database, store.id, o.id, "cancelled", user.id),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(4);
    expect((await eventsOf(o.id)).filter((s) => s === "cancelled")).toHaveLength(1);
  });

  it("shipped → returned restocks tracked products and variants once; untracked stock stays untracked", async () => {
    const { store, user } = await seller(database, "ret");
    const tracked = await product(database, store.id, 3_000, 2);
    const untracked = await product(database, store.id, 3_000, null);
    const vp = await product(database, store.id, 9_000, null);
    const [v] = await database
      .insert(productVariants)
      .values({ productId: vp.id, storeId: store.id, price: 9_000, stock: 1 })
      .returning();
    const o = await placeOrder(
      database,
      store,
      checkout([
        { productId: tracked.id, quantity: 2 },
        { productId: untracked.id, quantity: 1 },
        { productId: vp.id, variantId: v!.id, quantity: 1 },
      ]),
    );
    const vStock = async () => (await database.query.productVariants.findFirst({ where: eq(productVariants.id, v!.id) }))!.stock;
    expect(await stockOf(tracked.id)).toBe(0);
    expect(await vStock()).toBe(0);
    for (const s of ["confirmed", "shipped", "returned"] as const) await updateOrderStatus(database, store.id, o.id, s, user.id);
    expect(await stockOf(tracked.id)).toBe(2);
    expect(await stockOf(untracked.id)).toBeNull();
    expect(await vStock()).toBe(1);
    await expect(updateOrderStatus(database, store.id, o.id, "cancelled", user.id)).rejects.toMatchObject({ message: "invalid_transition" });
    expect(await stockOf(tracked.id)).toBe(2);
  });

  it("delivered then returned restocks once (refused in between does not restock)", async () => {
    const { store, user } = await seller(database, "refret");
    const p = await product(database, store.id, 3_000, 3);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    for (const s of ["confirmed", "shipped", "refused"] as const) await updateOrderStatus(database, store.id, o.id, s, user.id);
    expect(await stockOf(p.id)).toBe(2);
    expect((await orderRow(o.id)).restockedAt).toBeNull();
    await updateOrderStatus(database, store.id, o.id, "returned", user.id);
    expect(await stockOf(p.id)).toBe(3);
  });
});

describe("COD payment status", () => {
  it("delivering a COD order marks it paid; nothing is left to collect", async () => {
    const { store, user } = await seller(database, "codpaid");
    const p = await product(database, store.id, 7_000, null);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }]));
    expect(o.paymentStatus).toBe("unpaid");
    expect(codAmountToCollect(o)).toBe(o.total);
    for (const s of ["confirmed", "shipped"] as const) {
      const r = await updateOrderStatus(database, store.id, o.id, s, user.id);
      expect(r.paymentStatus).toBe("unpaid");
    }
    const d = await updateOrderStatus(database, store.id, o.id, "delivered", user.id);
    expect(d.paymentStatus).toBe("paid");
    expect(codAmountToCollect(d)).toBe(0);
  });

  it("delivering an online-payment order does not mark it paid (the provider decides)", async () => {
    const { store, user } = await seller(database, "fibdel");
    await enable(database, store.id, "fib");
    const p = await product(database, store.id, 7_000, null);
    const o = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    await database.update(orders).set({ paymentMethod: "fib", paymentStatus: "pending" }).where(eq(orders.id, o.id));
    for (const s of ["confirmed", "shipped", "delivered"] as const) await updateOrderStatus(database, store.id, o.id, s, user.id);
    const row = await orderRow(o.id);
    expect(row.paymentStatus).toBe("pending");
    expect(codAmountToCollect(row)).toBe(0);
  });
});

describe("tenant isolation", () => {
  it("seller B cannot change A's order status, restock A's stock, or read A's packing slip", async () => {
    const a = await seller(database, "tA");
    const b = await seller(database, "tB");
    const p = await product(database, a.store.id, 4_000, 3);
    const o = await placeOrder(database, a.store, checkout([{ productId: p.id, quantity: 2 }]));
    for (const s of ["confirmed", "cancelled", "returned"] as const) {
      await expect(updateOrderStatus(database, b.store.id, o.id, s, b.user.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(await stockOf(p.id)).toBe(1);
    expect((await orderRow(o.id)).status).toBe("pending");
    expect(await eventsOf(o.id)).toEqual(["pending"]);
    expect(await getPackingSlip(database, b.store.id, o.id)).toBeNull();
    expect(await getPackingSlip(database, a.store.id, o.id)).not.toBeNull();
  });
});

describe("packing slip", () => {
  it("has the store, the order's delivery details, items with quantities, totals and the COD amount", async () => {
    const { store, user } = await seller(database, "slip");
    const p = await product(database, store.id, 12_500, null);
    const o = await placeOrder(
      database,
      store,
      checkout([{ productId: p.id, quantity: 3 }], { landmark: "Behind Shawes school", notes: "Call before" }),
    );
    const slip = (await getPackingSlip(database, store.id, o.id))!;
    expect(slip.store).toMatchObject({ name: store.name, slug: store.slug });
    expect(slip.order).toMatchObject({ number: o.number, customerName: "Shilan", cityKey: "erbil", landmark: "Behind Shawes school", notes: "Call before" });
    expect(slip.items).toHaveLength(1);
    expect(slip.items[0]).toMatchObject({ quantity: 3, unitPrice: 12_500, lineTotal: 37_500 });
    expect(slip.codToCollect).toBe(o.total);
    for (const s of ["confirmed", "shipped", "delivered"] as const) await updateOrderStatus(database, store.id, o.id, s, user.id);
    expect((await getPackingSlip(database, store.id, o.id))!.codToCollect).toBe(0);
  });

  it("is not found for an unknown order id", async () => {
    const { store } = await seller(database, "slip404");
    expect(await getPackingSlip(database, store.id, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("migration 0004 (orders.restocked_at)", () => {
  it("marks orders already cancelled / returned as restocked, leaves the rest open", async () => {
    const SRC = path.join(process.cwd(), "drizzle");
    const tmp = mkdtempSync(path.join(os.tmpdir(), "mm-mig4-"));
    const dir = path.join(tmp, "upto-4");
    cpSync(SRC, dir, { recursive: true });
    const jp = path.join(dir, "meta", "_journal.json");
    const j = JSON.parse(readFileSync(jp, "utf8")) as { entries: unknown[] };
    j.entries = j.entries.slice(0, 4);
    writeFileSync(jp, JSON.stringify(j));
    const pg = new PGlite();
    const db = drizzle(pg);
    try {
      await migrate(db, { migrationsFolder: dir });
      const [u] = (await pg.query<{ id: string }>(`insert into users (email, password_hash, name) values ('m4@x.iq','h','M') returning id`)).rows;
      const [s] = (await pg.query<{ id: string }>(`insert into stores (owner_id, name, slug) values ($1,'M4','m4-shop') returning id`, [u!.id])).rows;
      let n = 1000;
      for (const status of ["pending", "shipped", "delivered", "refused", "cancelled", "returned"]) {
        await pg.query(
          `insert into orders (store_id, number, public_id, customer_name, customer_phone, city_key, city_name, address, subtotal, delivery_fee, total, status, payment_method)
           values ($1,$2,$3,'C','+9647501111111','erbil','Erbil','a',1000,0,1000,$4,'cod')`,
          [s!.id, ++n, `m4-${n}`, status],
        );
      }
      await migrate(db, { migrationsFolder: SRC });
      const rows = (await pg.query<{ status: string; r: boolean }>(`select status, restocked_at is not null as r from orders order by number`)).rows;
      expect(rows.filter((r) => r.r).map((r) => r.status)).toEqual(["cancelled", "returned"]);
    } finally {
      await pg.close();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
