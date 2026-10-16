import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores, users } from "@/server/db/schema";
import { loadLiveStats } from "@/server/services/live-stats";
import { joinWaitlist } from "@/server/services/waitlist";
import { placeOrder, updateOrderStatus } from "@/server/services/orders";
import { waitlistSchema } from "@/lib/validation";
import { MIN_VISIBLE_STATS, STAT_FLOORS, visibleStats } from "@/lib/live-stats";
import { checkout, product, seller, testDb } from "./support/db";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

/** seller() signs up @example.com test accounts; give one a real-looking address so it counts. */
async function realSeller(label: string) {
  const s = await seller(db, label);
  await db.update(users).set({ email: `${label}-${Date.now()}@gmail.com` }).where(eq(users.id, s.user.id));
  return s;
}

describe("visibleStats (pure)", () => {
  it("hides counters below their floor and never shows a zero", () => {
    const out = visibleStats({ sellers: 40, stores: 2, orders: 0, waitlist: 120 });
    expect(out.map((s) => s.key)).toEqual(["sellers", "waitlist"]);
    expect(out.every((s) => s.value > 0)).toBe(true);
  });
  it("hides the whole band until two counters pass", () => {
    expect(MIN_VISIBLE_STATS).toBe(2);
    expect(visibleStats({ sellers: 99, stores: 0, orders: 0, waitlist: 0 })).toEqual([]);
    expect(visibleStats(null)).toEqual([]);
    expect(visibleStats({ sellers: STAT_FLOORS.sellers, stores: STAT_FLOORS.stores, orders: 0, waitlist: 0 })).toHaveLength(2);
  });
});

describe("loadLiveStats (real DB counts)", () => {
  it("starts empty and counts real sellers, live stores, orders and waitlist, excluding demo and test accounts", async () => {
    expect(await loadLiveStats(db)).toEqual({ sellers: 0, stores: 0, orders: 0, waitlist: 0 });

    // an @example.com test account is not a real seller
    const test = await seller(db, "test");
    await product(db, test.store.id, 10_000);
    await placeOrder(db, test.store, checkout([{ productId: (await product(db, test.store.id, 5_000)).id, quantity: 1 }]));
    expect(await loadLiveStats(db)).toMatchObject({ sellers: 0, stores: 0, orders: 0 });

    // the seeded demo seller is excluded too
    const demo = await seller(db, "demo");
    await db.update(users).set({ email: "demo@mymarket.app" }).where(eq(users.id, demo.user.id));
    await product(db, demo.store.id, 10_000);
    expect(await loadLiveStats(db)).toMatchObject({ sellers: 0, stores: 0 });

    // a real seller with no products: counted as a seller, not a live store
    const a = await realSeller("a");
    expect(await loadLiveStats(db)).toMatchObject({ sellers: 1, stores: 0 });

    const p = await product(db, a.store.id, 20_000);
    expect(await loadLiveStats(db)).toMatchObject({ sellers: 1, stores: 1 });

    // paused store drops out of live stores
    await db.update(stores).set({ isActive: false }).where(eq(stores.id, a.store.id));
    expect(await loadLiveStats(db)).toMatchObject({ sellers: 1, stores: 0 });
    await db.update(stores).set({ isActive: true }).where(eq(stores.id, a.store.id));

    // orders: cancelled ones do not count
    const o1 = await placeOrder(db, a.store, checkout([{ productId: p.id, quantity: 1 }]));
    const o2 = await placeOrder(db, a.store, checkout([{ productId: p.id, quantity: 1 }], { phone: "9647709998877", customerName: "Karwan" }));
    expect((await loadLiveStats(db)).orders).toBe(2);
    await updateOrderStatus(db, a.store.id, o2.id, "cancelled", a.user.id);
    expect((await loadLiveStats(db)).orders).toBe(1);
    expect(o1.number).toBeGreaterThan(0);

    // waitlist
    await joinWaitlist(db, waitlistSchema.parse({ name: "Dilan", whatsapp: "07501234567", sells: "c1", city: "erbil", locale: "ku" }), null);
    expect((await loadLiveStats(db)).waitlist).toBe(1);
  });
});
