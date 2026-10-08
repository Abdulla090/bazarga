import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { orders, products } from "@/server/db/schema";
import {
  assessRisk,
  cartFingerprint,
  isHoneypotTripped,
  knownRiskFlags,
  MAX_ORDERS_PER_PHONE_PER_DAY,
  MIN_FILL_MS,
  REPLAY_WINDOW_MS,
} from "@/lib/order-risk";
import { checkoutSchema } from "@/lib/validation";
import { placeOrder, updateOrderStatus } from "@/server/services/orders";
import { blockPhone, isPhoneBlocked, listBlockedPhones, unblockPhone } from "@/server/services/blocklist";
import { checkout, product, seller, testDb } from "./support/db";

const facts = { sameCartRecent: 0, openFromPhone: 0, refusedFromPhone: 0 };

describe("order-risk rules (pure)", () => {
  it("fingerprint ignores line order and includes variant + quantity", () => {
    const a = cartFingerprint([{ productId: "p1", quantity: 1 }, { productId: "p2", variantId: "v", quantity: 2 }]);
    const b = cartFingerprint([{ productId: "p2", variantId: "v", quantity: 2 }, { productId: "p1", variantId: null, quantity: 1 }]);
    expect(a).toBe(b);
    expect(cartFingerprint([{ productId: "p1", quantity: 2 }])).not.toBe(cartFingerprint([{ productId: "p1", quantity: 1 }]));
  });
  it("honeypot: only a non-blank string trips it", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped("   ")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
    expect(isHoneypotTripped("http://spam")).toBe(true);
  });
  it("flags: fast submit, duplicate, many open, refused before; nothing for a normal order", () => {
    expect(assessRisk({ ...facts, elapsedMs: 45_000 })).toEqual([]);
    expect(assessRisk({ ...facts })).toEqual([]); // no timing sent → no flag
    expect(assessRisk({ ...facts, elapsedMs: MIN_FILL_MS - 1 })).toEqual(["fast_submit"]);
    expect(assessRisk({ ...facts, elapsedMs: MIN_FILL_MS })).toEqual([]);
    expect(assessRisk({ ...facts, sameCartRecent: 1 })).toEqual(["duplicate"]);
    expect(assessRisk({ ...facts, openFromPhone: 1 })).toEqual([]);
    expect(assessRisk({ ...facts, openFromPhone: 2 })).toEqual(["many_open"]);
    expect(assessRisk({ ...facts, refusedFromPhone: 1 })).toEqual(["refused_before"]);
  });
  it("knownRiskFlags drops anything unknown", () => {
    expect(knownRiskFlags(["duplicate", "x", 3])).toEqual(["duplicate"]);
    expect(knownRiskFlags(null)).toEqual([]);
  });
  it("checkout schema keeps hp / elapsedMs and never fails an order on junk timing", () => {
    const base = {
      items: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 1 }],
      customerName: "Shilan",
      phone: "0770 111 2233",
      cityKey: "erbil",
      landmark: "Near the mosque",
      paymentMethod: "cod",
    };
    expect(checkoutSchema.parse({ ...base, hp: "", elapsedMs: 9000 })).toMatchObject({ hp: "", elapsedMs: 9000, phone: "+9647701112233" });
    expect(checkoutSchema.parse({ ...base, elapsedMs: "soon" }).elapsedMs).toBeUndefined();
    // A non-string honeypot is a bot: it becomes a tripped value instead of a validation error that reveals the field.
    expect(isHoneypotTripped(checkoutSchema.parse({ ...base, hp: 42 }).hp)).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, phone: "0712 345 6789" }).success).toBe(false); // not an Iraqi operator
  });
});

describe("placeOrder fake-order protection", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });

  it("honeypot and blocklisted phones are refused with one generic error, before stock moves", async () => {
    const { store } = await seller(database, "fo1");
    const p = await product(database, store.id, 10_000, 5);
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { hp: "spam" }))).rejects.toMatchObject({ message: "order_rejected" });
    await blockPhone(database, store.id, "0770 111 2233", "fake orders");
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647701112233" }))).rejects.toMatchObject({
      code: "VALIDATION",
      message: "order_rejected",
    });
    const [row] = await database.select({ stock: products.stock }).from(products).where(eq(products.id, p.id));
    expect(row!.stock).toBe(5);
    expect(await database.select().from(orders).where(eq(orders.storeId, store.id))).toHaveLength(0);
  });

  it("a blocklist is per store: the same phone still orders at another store", async () => {
    const a = await seller(database, "fo2a");
    const b = await seller(database, "fo2b");
    const pb = await product(database, b.store.id, 10_000);
    await blockPhone(database, a.store.id, "07701112244");
    const o = await placeOrder(database, b.store, checkout([{ productId: pb.id, quantity: 1 }], { phone: "+9647701112244" }));
    expect(o.number).toBeGreaterThan(0);
    expect(await isPhoneBlocked(database, b.store.id, "+9647701112244")).toBe(false);
    expect(await listBlockedPhones(database, b.store.id)).toHaveLength(0);
    // Unblocking from store B can't touch store A's list.
    expect(await unblockPhone(database, b.store.id, "07701112244")).toBe(false);
    expect(await isPhoneBlocked(database, a.store.id, "+9647701112244")).toBe(true);
  });

  it("blockPhone normalises, is idempotent and rejects non-mobiles", async () => {
    const { store } = await seller(database, "fo3");
    expect(await blockPhone(database, store.id, "٠٧٥٠ ١٢٣ ٤٥٦٧")).toBe("+9647501234567");
    expect(await blockPhone(database, store.id, "+964 750 123 4567")).toBe("+9647501234567");
    expect(await listBlockedPhones(database, store.id)).toHaveLength(1);
    await expect(blockPhone(database, store.id, "12345")).rejects.toMatchObject({ message: "invalid_phone" });
    expect(await unblockPhone(database, store.id, "07501234567")).toBe(true);
    expect(await listBlockedPhones(database, store.id)).toHaveLength(0);
  });

  it("a double tap (same phone + cart, first still pending) returns the first order: one order, stock moved once", async () => {
    const { store } = await seller(database, "fo4");
    const p = await product(database, store.id, 10_000, 5);
    const input = checkout([{ productId: p.id, quantity: 2 }], { phone: "+9647701112255" });
    const first = await placeOrder(database, store, input);
    const again = await placeOrder(database, store, input);
    expect(first.replayed).toBeFalsy();
    expect(again.replayed).toBe(true);
    expect(again.id).toBe(first.id);
    expect(again.items).toHaveLength(1);
    const [row] = await database.select({ stock: products.stock }).from(products).where(eq(products.id, p.id));
    expect(row!.stock).toBe(3);
  });

  it("same cart after the replay window, or once confirmed → a new order flagged duplicate", async () => {
    const { store, user } = await seller(database, "fo5");
    const p = await product(database, store.id, 10_000, null);
    const t0 = new Date("2026-10-08T09:00:00Z");
    const input = checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647701112266" });
    const first = await placeOrder(database, store, input, { now: t0 });
    await database.update(orders).set({ createdAt: t0 }).where(eq(orders.id, first.id));
    const later = await placeOrder(database, store, input, { now: new Date(t0.getTime() + REPLAY_WINDOW_MS + 1) });
    expect(later.id).not.toBe(first.id);
    expect(later.riskFlags).toEqual(["duplicate"]);
    // Confirmed first order: an identical cart right away is a new (flagged) order, not a replay.
    const s2 = await seller(database, "fo5b");
    const p2 = await product(database, s2.store.id, 10_000, null);
    const in2 = checkout([{ productId: p2.id, quantity: 1 }], { phone: "+9647701112267" });
    const o1 = await placeOrder(database, s2.store, in2);
    await updateOrderStatus(database, s2.store.id, o1.id, "confirmed", s2.user.id);
    const o2 = await placeOrder(database, s2.store, in2);
    expect(o2.id).not.toBe(o1.id);
    expect(o2.riskFlags).toContain("duplicate");
    void user;
  });

  it("refused-before, many-open and fast-submit flags are stored on the order", async () => {
    const { store, user } = await seller(database, "fo6");
    const p = await product(database, store.id, 5_000, null);
    const phone = "+9647801112277";
    const o1 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone }));
    expect(o1.riskFlags).toEqual([]);
    for (const s of ["confirmed", "shipped", "refused"] as const) await updateOrderStatus(database, store.id, o1.id, s, user.id);
    const o2 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }], { phone, elapsedMs: 800 }));
    expect(o2.riskFlags).toEqual(["fast_submit", "refused_before"]);
    const o3 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 3 }], { phone }));
    expect(o3.riskFlags).toEqual(["refused_before"]);
    const o4 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 4 }], { phone }));
    expect(o4.riskFlags).toEqual(["many_open", "refused_before"]);
    const [stored] = await database.select({ f: orders.riskFlags, h: orders.cartHash }).from(orders).where(and(eq(orders.id, o4.id), eq(orders.storeId, store.id)));
    expect(stored!.f).toEqual(["many_open", "refused_before"]);
    expect(stored!.h).toBe(`${p.id}:x4`);
  });

  it(`caps orders per phone per store per day at ${MAX_ORDERS_PER_PHONE_PER_DAY}`, async () => {
    const { store } = await seller(database, "fo7");
    const other = await seller(database, "fo7b");
    const p = await product(database, store.id, 1_000, null);
    const po = await product(database, other.store.id, 1_000, null);
    const phone = "+9647901112288";
    for (let q = 1; q <= MAX_ORDERS_PER_PHONE_PER_DAY; q++) await placeOrder(database, store, checkout([{ productId: p.id, quantity: q }], { phone }));
    await expect(placeOrder(database, store, checkout([{ productId: p.id, quantity: 9 }], { phone }))).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "too_many_orders",
    });
    // Other stores are unaffected.
    await expect(placeOrder(database, other.store, checkout([{ productId: po.id, quantity: 1 }], { phone }))).resolves.toMatchObject({ storeId: other.store.id });
  });
});

describe("fake-order protection wiring", () => {
  it("migration 0006 adds the blocklist + nullable / defaulted order columns only", () => {
    const sql = readFileSync("drizzle/0006_fake_order_protection.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "store_blocked_phones"');
    expect(sql).toMatch(/ADD COLUMN "risk_flags" jsonb DEFAULT '\[\]'::jsonb NOT NULL/);
    expect(sql).toMatch(/ADD COLUMN "cart_hash" text;/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "store_blocked_phones_store_phone_uq"/);
    expect(sql).toMatch(/ON DELETE cascade/);
    expect(sql).not.toMatch(/DROP/);
  });
  it("blocklist actions take the store from the session only", () => {
    const src = readFileSync("src/server/actions/blocklist.ts", "utf8");
    expect(src.match(/requireStore\(\)/g)?.length).toBe(2);
    expect(src).not.toMatch(/fd\.get\("storeId"\)/);
  });
  it("checkout sends the honeypot and fill time; the per-store IP limit runs before placing", () => {
    const co = readFileSync("src/components/store/CartCheckout.tsx", "utf8");
    expect(co).toMatch(/name="website"[^>]*tabIndex=\{-1\}/);
    expect(co).toContain('className="sr-only" aria-hidden="true"');
    expect(co).toContain("elapsedMs:");
    const action = readFileSync("src/server/actions/storefront.ts", "utf8");
    expect(action.indexOf("checkout:${store.id}:${ip}")).toBeGreaterThan(0);
    expect(action.indexOf("checkout:${store.id}:${ip}")).toBeLessThan(action.indexOf("placeOrder(db()"));
    expect(action).toMatch(/if \(order\.replayed\)/);
  });
  it("every risk string and both checkout errors exist in ku, ar, en and kmr", () => {
    const keys = ["title", "hint", "flag_fast_submit", "flag_duplicate", "flag_many_open", "flag_refused_before", "badge", "block", "unblock", "blocked", "blockConfirm", "listTitle", "listHint", "listEmpty", "phone", "note", "add"];
    for (const l of ["ku", "ar", "en", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { risk: Record<string, string>; errors: Record<string, string> };
      for (const k of keys) expect(m.risk[k], `${l}.risk.${k}`).toBeTruthy();
      expect(m.risk.blockConfirm).toContain("{phone}");
      expect(m.errors.order_rejected, `${l}.errors.order_rejected`).toBeTruthy();
      expect(m.errors.too_many_orders, `${l}.errors.too_many_orders`).toBeTruthy();
    }
  });
});
