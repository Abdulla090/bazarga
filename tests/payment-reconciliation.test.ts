import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db";
import { orderEvents, orders, paymentTransactions, products } from "@/server/db/schema";
import { placeOrder, updateOrderStatus } from "@/server/services/orders";
import { applyPaymentStatus, listPaymentAttempts, startPayment } from "@/server/payments/service";
import {
  EXPIRED_NOTE,
  expireAbandonedOrders,
  reconcilePendingPayments,
  RECONCILE_AFTER_MS,
  RECONCILE_EVERY_MS,
  RECONCILE_MAX_CHECKS,
  runPaymentJobs,
} from "@/server/payments/reconcile";
import type { NormalizedPaymentStatus, PaymentProvider } from "@/server/payments/types";
import type { PaymentMethod } from "@/lib/order-status";
import { isCronAuthorized } from "@/lib/cron-auth";
import { checkout, enable, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

/** Mock provider: no network, status per provider ref decided by the test. */
function mockProvider(id: PaymentMethod, statusOf: (ref: string) => NormalizedPaymentStatus | Error, configured = true) {
  let n = 0;
  return {
    id,
    isConfigured: () => configured,
    createPayment: vi.fn(async () => ({ kind: "redirect" as const, providerRef: `${id}-ref-${++n}-${Math.random().toString(36).slice(2, 8)}`, url: "https://pay.example/x", raw: {} })),
    fetchStatus: vi.fn(async (ref: string) => {
      const s = statusOf(ref);
      if (s instanceof Error) throw s;
      return { status: s, raw: { ref } };
    }),
  } satisfies PaymentProvider;
}

let phoneSeq = 0;
async function onlineOrder(method: "fib" | "zaincash", provider: PaymentProvider, stock: number | null = 5, qty = 2) {
  const { store, user } = await seller(database, `rc${method}`);
  await enable(database, store.id, method);
  const p = await product(database, store.id, 10_000, stock);
  const order = await placeOrder(database, store, checkout([{ productId: p.id, quantity: qty }], { paymentMethod: method, phone: `+96477022${String(++phoneSeq).padStart(5, "0")}` }), {
    isProviderAvailable: () => true,
  });
  const init = await startPayment(database, provider, order, { storeName: store.name, returnUrl: "https://x/r", callbackUrl: "https://x/c" });
  const ref = init.kind === "offline" ? "" : init.providerRef;
  return { store, user, product: p, order, ref };
}
const later = (ms: number) => new Date(Date.now() + ms);
const orderRow = async (id: string) => (await database.select().from(orders).where(eq(orders.id, id)))[0]!;
const stockOf = async (id: string) => (await database.select({ s: products.stock }).from(products).where(eq(products.id, id)))[0]!.s;

describe("reconcilePendingPayments", () => {
  it("applies the provider's paid status to old pending attempts, idempotently", async () => {
    const fib = mockProvider("fib", () => "paid");
    const { order, ref } = await onlineOrder("fib", fib);
    const providerFor = (m: PaymentMethod) => (m === "fib" ? fib : mockProvider(m, () => "pending", false));
    // Too fresh: nothing happens yet.
    const early = await reconcilePendingPayments(database, { now: new Date(), providerFor });
    expect(fib.fetchStatus).not.toHaveBeenCalledWith(ref);
    expect(early.checked).toBe(0);
    const r = await reconcilePendingPayments(database, { now: later(RECONCILE_AFTER_MS + 1000), providerFor });
    expect(r).toMatchObject({ paid: 1, errors: 0 });
    expect((await orderRow(order.id)).paymentStatus).toBe("paid");
    const again = await reconcilePendingPayments(database, { now: later(RECONCILE_AFTER_MS + RECONCILE_EVERY_MS * 3), providerFor });
    expect(again.paid).toBe(0);
    expect(fib.fetchStatus.mock.calls.filter(([x]) => x === ref)).toHaveLength(1);
    const [tx] = await database.select().from(paymentTransactions).where(eq(paymentTransactions.providerRef, ref));
    expect(tx).toMatchObject({ status: "paid", checkCount: 1 });
  });

  it("still-pending attempts are re-checked only every RECONCILE_EVERY_MS and give up after RECONCILE_MAX_CHECKS", async () => {
    const zc = mockProvider("zaincash", () => "pending");
    const { ref } = await onlineOrder("zaincash", zc);
    const providerFor = (m: PaymentMethod) => (m === "zaincash" ? zc : mockProvider(m, () => "pending", false));
    const t0 = Date.now() + RECONCILE_AFTER_MS + 1000;
    await reconcilePendingPayments(database, { now: new Date(t0), providerFor });
    await reconcilePendingPayments(database, { now: new Date(t0 + 60_000), providerFor }); // within the interval
    const calls = () => zc.fetchStatus.mock.calls.filter(([x]) => x === ref).length;
    expect(calls()).toBe(1);
    await reconcilePendingPayments(database, { now: new Date(t0 + RECONCILE_EVERY_MS + 1), providerFor });
    expect(calls()).toBe(2);
    await database.update(paymentTransactions).set({ checkCount: RECONCILE_MAX_CHECKS }).where(eq(paymentTransactions.providerRef, ref));
    await reconcilePendingPayments(database, { now: new Date(t0 + RECONCILE_EVERY_MS * 10), providerFor });
    expect(calls()).toBe(2);
  });

  it("never calls a provider that isn't configured, and counts provider errors without throwing", async () => {
    const off = mockProvider("fib", () => "paid", false);
    const boom = mockProvider("zaincash", () => new Error("provider down"));
    const a = await onlineOrder("fib", mockProvider("fib", () => "pending"));
    const b = await onlineOrder("zaincash", boom);
    const providerFor = (m: PaymentMethod) => (m === "fib" ? off : boom);
    const r = await reconcilePendingPayments(database, { now: later(RECONCILE_AFTER_MS + RECONCILE_EVERY_MS * 50), providerFor });
    expect(off.fetchStatus).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThan(0);
    expect(r.errors).toBeGreaterThan(0);
    expect((await orderRow(a.order.id)).paymentStatus).toBe("pending");
    expect((await orderRow(b.order.id)).paymentStatus).toBe("pending");
  });
});

describe("expireAbandonedOrders", () => {
  it("cancels an unpaid online order after the TTL, releases stock once, marks the attempt failed and records why", async () => {
    const fib = mockProvider("fib", () => "pending");
    const { store, order, product: p, ref } = await onlineOrder("fib", fib, 5, 2);
    expect(await stockOf(p.id)).toBe(3);
    const providerFor = () => fib;
    const fresh = await expireAbandonedOrders(database, { ttlMinutes: 60, now: later(30 * 60_000), providerFor });
    expect((await orderRow(order.id)).status).toBe("pending");
    expect(fresh.expired).toBe(0);
    const r = await expireAbandonedOrders(database, { ttlMinutes: 60, now: later(61 * 60_000), providerFor });
    expect(r.expired).toBeGreaterThanOrEqual(1);
    const row = await orderRow(order.id);
    expect(row).toMatchObject({ status: "cancelled", paymentStatus: "failed" });
    expect(row.expiredAt).toBeInstanceOf(Date);
    expect(row.restockedAt).toBeInstanceOf(Date);
    expect(await stockOf(p.id)).toBe(5);
    const events = await database.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
    expect(events.find((e) => e.toStatus === "cancelled")).toMatchObject({ note: EXPIRED_NOTE, actorUserId: null });
    const [tx] = await database.select().from(paymentTransactions).where(eq(paymentTransactions.providerRef, ref));
    expect(tx!.status).toBe("failed");
    // Re-running is a no-op: no second restock.
    await expireAbandonedOrders(database, { ttlMinutes: 60, now: later(120 * 60_000), providerFor });
    expect(await stockOf(p.id)).toBe(5);
    // A late "paid" from the provider still lands; the seller sees a paid, cancelled order.
    await applyPaymentStatus(database, "fib", ref, "paid", { late: true });
    expect(await orderRow(order.id)).toMatchObject({ status: "cancelled", paymentStatus: "paid" });
    expect((await listPaymentAttempts(database, store.id, order.id))[0]!.status).toBe("paid");
  });

  it("a payment that went through at the last check is kept, not expired", async () => {
    const fib = mockProvider("fib", () => "paid");
    const { order, product: p } = await onlineOrder("fib", fib, 4, 1);
    const r = await expireAbandonedOrders(database, { ttlMinutes: 60, now: later(61 * 60_000), providerFor: () => fib });
    expect(r.paidLate).toBeGreaterThanOrEqual(1);
    expect(await orderRow(order.id)).toMatchObject({ status: "pending", paymentStatus: "paid", expiredAt: null });
    expect(await stockOf(p.id)).toBe(3);
  });

  it("leaves COD orders, seller-confirmed orders and other stores' data alone; orders without an attempt still expire", async () => {
    const { store, user } = await seller(database, "rcmix");
    await enable(database, store.id, "fib");
    const p = await product(database, store.id, 5_000, 10);
    const cod = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { phone: "+9647703300001" }));
    const confirmed = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "fib", phone: "+9647703300002" }), { isProviderAvailable: () => true });
    await updateOrderStatus(database, store.id, confirmed.id, "confirmed", user.id);
    // Checkout created the order but the provider call failed: no attempt row at all.
    const noAttempt = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "fib", phone: "+9647703300003" }), { isProviderAvailable: () => true });
    const unconfigured = mockProvider("fib", () => "paid", false);
    await expireAbandonedOrders(database, { ttlMinutes: 60, now: later(2 * 3600_000), providerFor: () => unconfigured });
    expect((await orderRow(cod.id)).status).toBe("pending");
    expect((await orderRow(confirmed.id)).status).toBe("confirmed");
    expect(await orderRow(noAttempt.id)).toMatchObject({ status: "cancelled", paymentStatus: "failed" });
    expect(unconfigured.fetchStatus).not.toHaveBeenCalled();
  });

  it("runPaymentJobs runs both and reports counts", async () => {
    const fib = mockProvider("fib", () => "failed");
    await onlineOrder("fib", fib, null, 1);
    const r = await runPaymentJobs(database, { ttlMinutes: 60, now: later(3 * 3600_000), providerFor: () => fib });
    expect(r.reconcile).toHaveProperty("checked");
    expect(r.expiry.expired).toBeGreaterThanOrEqual(1);
  });
});

describe("cron auth + wiring", () => {
  it("Bearer secret check is exact and off without a secret", () => {
    const s = "s3cret-s3cret-s3cret";
    expect(isCronAuthorized(`Bearer ${s}`, s)).toBe(true);
    expect(isCronAuthorized(`bearer   ${s}`, s)).toBe(true);
    expect(isCronAuthorized(`Bearer ${s}x`, s)).toBe(false);
    expect(isCronAuthorized(s, s)).toBe(false);
    expect(isCronAuthorized(null, s)).toBe(false);
    expect(isCronAuthorized(`Bearer ${s}`, undefined)).toBe(false);
  });
  it("the cron route is 404 without CRON_SECRET and runs the jobs with the configured TTL", () => {
    const src = readFileSync("src/app/api/cron/payments/route.ts", "utf8");
    expect(src).toMatch(/if \(!e\.CRON_SECRET\) return new NextResponse\(null, \{ status: 404 \}\)/);
    expect(src).toContain("isCronAuthorized(");
    expect(src).toContain("ttlMinutes: e.PAYMENT_ORDER_TTL_MINUTES");
    expect(readFileSync("package.json", "utf8")).toContain('"payments:reconcile"');
    const env = readFileSync("src/server/env.ts", "utf8");
    expect(env).toMatch(/PAYMENT_ORDER_TTL_MINUTES: z\.coerce\.number\(\)\.int\(\)\.min\(5\).*\.default\(60\)/);
    expect(env).toMatch(/FIB_ENABLED: bool/); // providers stay off unless enabled in env
  });
  it("migration 0008 only adds nullable / defaulted columns and an index", () => {
    const sql = readFileSync("drizzle/0008_payment_reconciliation.sql", "utf8");
    expect(sql).toMatch(/ADD COLUMN "expired_at" timestamp with time zone;/);
    expect(sql).toMatch(/ADD COLUMN "last_checked_at" timestamp with time zone;/);
    expect(sql).toMatch(/ADD COLUMN "check_count" integer DEFAULT 0 NOT NULL;/);
    expect(sql).not.toMatch(/DROP/);
  });
  it("the seller's check-now action is session-scoped; strings exist in all 4 locales", () => {
    const src = readFileSync("src/server/actions/payments.ts", "utf8");
    expect(src).toContain("requireStore()");
    expect(src).toMatch(/eq\(orders\.storeId, store\.id\)/);
    for (const l of ["ku", "ar", "en", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { payStatus: Record<string, string>; errors: Record<string, string> };
      for (const k of ["title", "ref", "checked", "neverChecked", "checkNow", "expired", "paidAfterExpiry", "noAttempts", "auto"]) expect(m.payStatus[k], `${l}.${k}`).toBeTruthy();
      expect(m.payStatus.expired).toContain("{minutes}");
      expect(m.errors.payment_check_unavailable).toBeTruthy();
    }
  });
});
