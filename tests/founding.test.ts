import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores, users } from "@/server/db/schema";
import { loadFoundingSpotsLeft } from "@/server/services/founding";
import { createStore } from "@/server/services/stores";
import { signUp } from "@/server/auth/service";
import { FOUNDING_SPOTS, foundingSpotsLeft, isFoundingEligibleEmail, isFoundingNumber } from "@/lib/founding";
import { seller, testDb } from "./support/db";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

let n = 0;
async function realStore(email?: string) {
  n++;
  const user = await signUp(db, { name: "Real", email: email ?? `real${n}-${Date.now()}@gmail.com`, password: "correct horse battery", locale: "ku" });
  return createStore(db, user.id, {
    name: `Real ${n}`,
    slug: `real-${n}-${Math.random().toString(36).slice(2, 7)}`,
    defaultLocale: "ku",
    phone: "9647501234567",
    whatsapp: "9647501234567",
    instagram: null,
    city: "erbil",
    tagline: {},
  });
}

describe("founding helpers (pure)", () => {
  it("excludes the demo seller and @example.com test accounts", () => {
    expect(isFoundingEligibleEmail("demo@mymarket.app")).toBe(false);
    expect(isFoundingEligibleEmail("Bot-1@Example.com")).toBe(false);
    expect(isFoundingEligibleEmail("sara@gmail.com")).toBe(true);
  });
  it("clamps spots left to 0..100 and returns null when unknown", () => {
    expect(foundingSpotsLeft(0)).toBe(100);
    expect(foundingSpotsLeft(37)).toBe(63);
    expect(foundingSpotsLeft(500)).toBe(0);
    expect(foundingSpotsLeft(-4)).toBe(100);
    expect(foundingSpotsLeft(null)).toBeNull();
    expect(foundingSpotsLeft(Number.NaN)).toBeNull();
  });
  it("accepts only integers 1..100 as founding numbers", () => {
    expect([0, 1, 100, 101, 1.5, null, "3"].map(isFoundingNumber)).toEqual([false, true, true, false, false, false, false]);
  });
});

describe("founding numbers (db)", () => {
  it("test accounts never take a spot", async () => {
    const s = await seller(db, "ex");
    expect(s.store.foundingNumber).toBeNull();
  });
  it("real stores get 1, 2, 3… in creation order and the counter follows", async () => {
    const before = await loadFoundingSpotsLeft(db);
    const a = await realStore();
    const b = await realStore();
    expect(b.foundingNumber).toBe((a.foundingNumber ?? 0) + 1);
    expect(await loadFoundingSpotsLeft(db)).toBe(before - 2);
  });
  it("hands out numbers once and stops at 100", async () => {
    const owner = await signUp(db, { name: "Fill", email: `fill-${Date.now()}@gmail.com`, password: "correct horse battery", locale: "ku" });
    const taken = await loadFoundingSpotsLeft(db);
    // Fill the remaining spots straight through the DB (cheap), then a new real store must get none.
    const rows = await db.select({ n: stores.foundingNumber }).from(stores);
    const max = Math.max(0, ...rows.map((r) => r.n ?? 0));
    for (let i = 0; i < taken; i++) {
      await db.insert(stores).values({ ownerId: owner.id, name: `f${i}`, slug: `fill-${i}-${Math.random().toString(36).slice(2, 7)}`, foundingNumber: max + 1 + i });
    }
    expect(await loadFoundingSpotsLeft(db)).toBe(0);
    const late = await realStore();
    expect(late.foundingNumber).toBeNull();
    const [row] = await db.select({ f: stores.foundingNumber }).from(stores).where(eq(stores.id, late.id));
    expect(row?.f).toBeNull();
    expect(Math.max(...(await db.select({ n: stores.foundingNumber }).from(stores)).map((r) => r.n ?? 0))).toBeLessThanOrEqual(FOUNDING_SPOTS);
  });
  it("the unique index rejects a duplicate founding number", async () => {
    const [u] = await db.select().from(users).limit(1);
    const dup = db.insert(stores).values({ ownerId: u!.id, name: "dup", slug: `dup-${Date.now()}`, foundingNumber: 1 });
    await expect(dup).rejects.toThrow();
  });
});
