import { beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/server/db";
import { adminAudit, orders, products, stores, users } from "@/server/db/schema";
import { placeOrder } from "@/server/services/orders";
import { createStore } from "@/server/services/stores";
import { signUp } from "@/server/auth/service";
import { cleanupTestAccounts, isTestAccountEmail } from "@/server/services/test-accounts";
import { checkout, product, seller, testDb } from "./support/db";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const later = () => new Date(Date.now() + 60 * 60_000); // "now" an hour ahead, so freshly created rows pass min-age

async function realSeller(email: string) {
  const user = await signUp(db, { name: "Real", email, password: "correct horse battery", locale: "ku" });
  const store = await createStore(db, user.id, { name: "Real", slug: `real-${Math.random().toString(36).slice(2, 8)}`, defaultLocale: "ku", phone: "9647501234567", whatsapp: "9647501234567", instagram: null, city: "erbil", tagline: {} });
  return { user, store };
}

describe("isTestAccountEmail", () => {
  it("matches @example.com throwaways only, never the demo seller or real mail", () => {
    expect(isTestAccountEmail("e2e-123@example.com")).toBe(true);
    expect(isTestAccountEmail("Gate-1@Example.COM")).toBe(true);
    expect(isTestAccountEmail("demo@mymarket.app")).toBe(false);
    expect(isTestAccountEmail("abdulla@gmail.com")).toBe(false);
    expect(isTestAccountEmail("me@example.com.real.iq")).toBe(false);
  });
});

describe("cleanupTestAccounts", () => {
  it("deletes test accounts and everything they own; keeps real, demo, owner and too-new accounts", async () => {
    const junk = await seller(db, "e2e"); // …@example.com
    const p = await product(db, junk.store.id, 10_000);
    await placeOrder(db, junk.store, checkout([{ productId: p.id, quantity: 1 }]));
    const fresh = await seller(db, "gate");
    await db.update(users).set({ createdAt: new Date(Date.now() + 2 * 60 * 60_000) }).where(eq(users.id, fresh.user.id)); // younger than the cutoff
    const owner = await seller(db, "ownr");
    await db.update(users).set({ role: "owner" }).where(eq(users.id, owner.user.id));
    const real = await realSeller(`real-${Date.now()}@gmail.com`);
    const demo = await realSeller("demo@mymarket.app");
    const dp = await product(db, demo.store.id, 10_000);
    const testOrder = await placeOrder(db, demo.store, { ...checkout([{ productId: dp.id, quantity: 1 }]), customerName: "Social Test 4242", phone: "+9647501114242" });
    const realOrder = await placeOrder(db, demo.store, { ...checkout([{ productId: dp.id, quantity: 1 }]), customerName: "Aso Kamal", phone: "+9647502224242" });
    await db.insert(adminAudit).values([
      { actorId: demo.user.id, actorEmail: "demo@mymarket.app", action: "user.suspend", targetType: "user", targetId: junk.user.id, targetLabel: junk.user.email },
      { actorId: demo.user.id, actorEmail: "demo@mymarket.app", action: "user.suspend", targetType: "user", targetId: real.user.id, targetLabel: real.user.email },
    ]);

    const dry = await cleanupTestAccounts(db, { dryRun: true, now: later() });
    expect(dry.users).toContain(junk.user.email.toLowerCase());
    expect(await db.query.users.findFirst({ where: eq(users.id, junk.user.id) })).toBeTruthy();

    const res = await cleanupTestAccounts(db, { now: later() });
    expect(res.users).toContain(junk.user.email.toLowerCase());
    expect(res.users).not.toContain(fresh.user.email.toLowerCase());
    expect(res.demoOrders).toBe(1);
    expect(res.adminAudit).toBe(1);

    const left = (await db.select({ id: users.id }).from(users).where(inArray(users.id, [junk.user.id, fresh.user.id, owner.user.id, real.user.id, demo.user.id]))).map((r) => r.id);
    expect(left.sort()).toEqual([fresh.user.id, owner.user.id, real.user.id, demo.user.id].sort());
    expect(await db.query.stores.findFirst({ where: eq(stores.id, junk.store.id) })).toBeUndefined();
    expect(await db.query.products.findFirst({ where: eq(products.id, p.id) })).toBeUndefined();
    expect(await db.query.orders.findFirst({ where: eq(orders.id, testOrder.id) })).toBeUndefined();
    expect(await db.query.orders.findFirst({ where: eq(orders.id, realOrder.id) })).toBeTruthy();
    expect((await db.select().from(adminAudit)).map((a) => a.targetLabel)).toEqual([real.user.email]);
  });
});
