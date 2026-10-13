import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { ledgerEntries, orders, paymentEvents, payments, storePlanHistory, stores } from "@/server/db/schema";
import { placeOrder } from "@/server/services/orders";
import { parseGatewayConfig, resetGatewayConfig, type GatewayConfig } from "@/server/payments/gateway/config";
import { MockProvider } from "@/server/payments/gateway/mock";
import { mapRasediStatus, rasediSignature, RasediProvider } from "@/server/payments/gateway/rasedi";
import { gateway, setGateway } from "@/server/payments/gateway/registry";
import { commissionIqd, subscriptionPrice, usdToIqd } from "@/server/payments/gateway/pricing";
import { checkoutCore } from "@/server/payments/gateway/http";
import {
  applyGatewayStatus,
  createPayout,
  handleGatewayWebhook,
  listStorePayments,
  markPayoutPaid,
  publicPaymentView,
  reconcileGatewayPayments,
  reviewPayoutProfile,
  savePayoutProfile,
  sellerBalance,
  setOnlinePayments,
  startOrderCheckout,
  startSubscriptionCheckout,
  storeOnlineStatus,
} from "@/server/payments/gateway/service";
import { AppError } from "@/server/errors";
import { checkout, product, seller, testDb } from "./support/db";

const SECRET = "test-webhook-secret-0123456789abcdef";
const APP = "https://bazarga.test";
const mockConfig = (over: Partial<Exclude<GatewayConfig, { provider: "none" }>> = {}): GatewayConfig => ({
  provider: "mock",
  mode: "mock",
  apiBase: "mock://",
  keyId: "mock",
  privateKeyPem: "",
  webhookSecret: SECRET,
  gateways: ["FIB", "ZAIN"],
  amountScale: 100,
  feeFromCustomer: false,
  usdIqdRate: 1310,
  commissionBps: 500,
  ...over,
});

let database: Db;
let mock: MockProvider;
beforeAll(async () => {
  database = await testDb();
});
function useMock(over?: Partial<Exclude<GatewayConfig, { provider: "none" }>>) {
  resetGatewayConfig(mockConfig(over));
  mock = new MockProvider(SECRET);
  setGateway(mock);
  return mock;
}
afterEach(() => {
  setGateway(undefined);
  resetGatewayConfig(undefined);
});

const hook = (ref: string, status: string, token = SECRET, provider = "mock") => ({
  url: `${APP}/api/payments/webhook/${provider}?token=${encodeURIComponent(token)}`,
  headers: new Headers({ "content-type": "application/json" }),
  body: JSON.stringify({ referenceCode: ref, status, payoutAmount: "0" }),
});

async function verifiedStoreWithOnline(label: string) {
  const s = await seller(database, label);
  await savePayoutProfile(database, s.store.id, { method: "fib", accountName: "Shilan Ahmed", accountIdentifier: "9647501234567" });
  await reviewPayoutProfile(database, s.store.id, "verified");
  await setOnlinePayments(database, s.store.id, true, gateway());
  return s;
}

async function onlineOrder(storeId: string, price = 25_000) {
  const p = await product(database, storeId, price);
  return placeOrder(database, { id: storeId }, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "online", phone: `96477${Math.floor(10_000_000 + Math.random() * 89_999_999)}` }), {
    isProviderAvailable: (m) => m === "online",
  });
}

describe("pricing", () => {
  it("prices plans in IQD from USD_IQD_RATE, rounded to 250", () => {
    expect(usdToIqd(10, 1310)).toBe(13_000);
    expect(usdToIqd(1, 1310)).toBe(1_250);
    expect(subscriptionPrice("pro", 1, 1310, true)).toEqual({ usd: 1, iqd: 1_250, promo: true });
    expect(subscriptionPrice("pro", 1, 1310, false)).toEqual({ usd: 10, iqd: 13_000, promo: false });
    expect(subscriptionPrice("pro", 12, 1310, true)).toEqual({ usd: 100, iqd: 131_000, promo: false });
    expect(subscriptionPrice("business", 1, 1310, true).usd).toBe(20);
    expect(commissionIqd(25_000, 500)).toBe(1_250);
    expect(commissionIqd(25_000, 0)).toBe(0);
  });
});

describe("config (fail closed)", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  it("defaults to none: today's behaviour", () => {
    expect(parseGatewayConfig({}).provider).toBe("none");
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "" }).provider).toBe("none");
  });
  it("turns itself off on any invalid or incomplete value", () => {
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "stripe" })).toMatchObject({ provider: "none", reason: "invalid" });
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "rasedi" })).toMatchObject({ provider: "none", reason: "invalid" });
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "rasedi", RASEDI_KEY_ID: "live_abcdefgh", RASEDI_PRIVATE_KEY: "not a pem at all, just some text here ok", RASEDI_WEBHOOK_SECRET: SECRET })).toMatchObject({ provider: "none" });
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "rasedi", RASEDI_MODE: "live", RASEDI_KEY_ID: "test_abcdefgh", RASEDI_PRIVATE_KEY: pem, RASEDI_WEBHOOK_SECRET: SECRET })).toMatchObject({ provider: "none" });
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "rasedi", RASEDI_KEY_ID: "test_abcdefgh", RASEDI_PRIVATE_KEY: pem, RASEDI_WEBHOOK_SECRET: SECRET, RASEDI_GATEWAYS: "FIB,QI" })).toMatchObject({ provider: "none" });
    expect(parseGatewayConfig({ PAYMENTS_PROVIDER: "mock", NODE_ENV: "production" })).toMatchObject({ provider: "none" });
  });
  it("accepts a complete rasedi config (single-line PEM from Vercel too)", () => {
    const c = parseGatewayConfig({ PAYMENTS_PROVIDER: "rasedi", RASEDI_KEY_ID: "test_abcdefgh", RASEDI_PRIVATE_KEY: pem.replace(/\n/g, "\\n"), RASEDI_WEBHOOK_SECRET: SECRET, USD_IQD_RATE: "1320", PLATFORM_COMMISSION_BPS: "250" });
    expect(c).toMatchObject({ provider: "rasedi", mode: "test", usdIqdRate: 1320, commissionBps: 250, gateways: ["FIB", "ZAIN", "ASIA_PAY", "NASS_WALLET", "CREDIT_CARD"] });
  });
});

describe("rasedi client", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  it("signs '<METHOD> || <x-id> || <path>' with Ed25519", () => {
    const sig = rasediSignature("POST", "test_key_123", "/v1/payment/rest/test/create", pem);
    expect(verify(null, Buffer.from("POST || test_key_123 || /v1/payment/rest/test/create"), publicKey, Buffer.from(sig, "base64"))).toBe(true);
  });
  it("creates a payment with the documented body and maps statuses", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchStub = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ referenceCode: "ref-1", amount: "1250000", redirectUrl: "https://pay.example/ref-1", status: "PENDING", paidVia: null, paidAt: null }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = new RasediProvider({ apiBase: "https://api.rasedi.com", mode: "test", keyId: "test_key_123", privateKeyPem: pem, webhookSecret: SECRET, amountScale: 100 }, fetchStub);
    const out = await r.createCheckout({ paymentId: "p", amountIqd: 12_500, title: "T", description: "D", gateways: ["FIB", "ZAIN"], redirectUrl: `${APP}/r`, callbackUrl: `${APP}/c`, collectFeeFromCustomer: false, collectCustomerPhoneNumber: false });
    expect(out).toMatchObject({ providerRef: "ref-1", checkoutUrl: "https://pay.example/ref-1" });
    expect(calls[0]!.url).toBe("https://api.rasedi.com/v1/payment/rest/test/create");
    const h = calls[0]!.init.headers as Record<string, string>;
    expect(h["x-id"]).toBe("test_key_123");
    expect(verify(null, Buffer.from("POST || test_key_123 || /v1/payment/rest/test/create"), publicKey, Buffer.from(h["x-signature"]!, "base64"))).toBe(true);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ amount: "1250000", gateways: ["FIB", "ZAIN"], collectFeeFromCustomer: false, collectCustomerEmail: false });
    expect(mapRasediStatus("PAID")).toBe("paid");
    expect(mapRasediStatus("CANCELED")).toBe("failed");
    expect(mapRasediStatus("TIMED_OUT")).toBe("expired");
    expect(mapRasediStatus("PENDING")).toBe("pending");
    // webhook auth: token in our callback URL
    expect(r.verifyWebhook(hook("ref-1", "PAID", SECRET, "rasedi"))).toMatchObject({ providerRef: "ref-1", eventId: "ref-1:PAID" });
    expect(r.verifyWebhook(hook("ref-1", "PAID", "wrong-token-wrong-token-wrong", "rasedi"))).toBeNull();
  });
});

describe("mock provider end-to-end", () => {
  it("subscription: checkout → webhook paid → plan active (first month promo, history, expiry)", async () => {
    useMock();
    const s = await seller(database, "gwsub");
    const c = await startSubscriptionCheckout(database, s.store.id, { plan: "pro", months: 1 }, APP);
    const row = await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) });
    expect(row).toMatchObject({ kind: "subscription", status: "pending", amountIqd: 1_250, storeId: s.store.id });
    expect(c.url).toContain(`/payments/return?p=${c.paymentId}`);
    // The redirect alone changes nothing.
    expect((await publicPaymentView(database, c.paymentId))!.status).toBe("pending");
    mock.settle(row!.providerRef!, "paid");
    const r = await handleGatewayWebhook(database, "mock", hook(row!.providerRef!, "PAID"));
    expect(r).toEqual({ status: 200, body: { ok: true, changed: true } });
    const st = await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) });
    expect(st!.plan).toBe("pro");
    expect(st!.planPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    const h = await database.select().from(storePlanHistory).where(eq(storePlanHistory.storeId, s.store.id));
    expect(h.map((x) => x.reason)).toEqual(["upgrade:online"]);
    // Second purchase is full price (promo used).
    const c2 = await startSubscriptionCheckout(database, s.store.id, { plan: "pro", months: 1 }, APP);
    expect((await database.query.payments.findFirst({ where: eq(payments.id, c2.paymentId) }))!.amountIqd).toBe(13_000);
  });

  it("order: checkout → webhook paid → order paid → ledger (sale, commission)", async () => {
    useMock();
    const s = await verifiedStoreWithOnline("gword");
    expect((await storeOnlineStatus(database, s.store.id, gateway())).available).toBe(true);
    const order = await onlineOrder(s.store.id, 25_000);
    const c = await startOrderCheckout(database, s.store.id, order.id, APP, { storeName: "Test", provider: gateway() });
    // Re-entering checkout re-uses the open hosted page.
    const again = await startOrderCheckout(database, s.store.id, order.id, APP, { storeName: "Test", provider: gateway() });
    expect(again.paymentId).toBe(c.paymentId);
    const row = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    expect(row).toMatchObject({ kind: "order", amountIqd: order.total, commissionIqd: commissionIqd(order.total, 500) });
    expect((await database.query.orders.findFirst({ where: eq(orders.id, order.id) }))!.paymentStatus).toBe("pending");
    mock.settle(row.providerRef!, "paid", "ZAIN");
    expect((await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "PAID"))).status).toBe(200);
    expect((await database.query.orders.findFirst({ where: eq(orders.id, order.id) }))!.paymentStatus).toBe("paid");
    const paid = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    expect(paid).toMatchObject({ status: "paid", gateway: "ZAIN" });
    const led = await database.select().from(ledgerEntries).where(eq(ledgerEntries.paymentId, row.id));
    expect(led.map((l) => [l.account, l.entryType, l.amountIqd]).sort()).toEqual(
      [
        ["platform", "commission_income", row.commissionIqd],
        ["seller", "commission", -row.commissionIqd],
        ["seller", "sale", order.total],
      ].sort(),
    );
    expect(await sellerBalance(database, s.store.id)).toBe(order.total - row.commissionIqd);
    // Payout: queue the balance, mark paid once → balance 0.
    const po = await createPayout(database, s.store.id);
    expect(po.amountIqd).toBe(order.total - row.commissionIqd);
    await expect(createPayout(database, s.store.id)).rejects.toThrow();
    expect(await markPayoutPaid(database, po.id, "FIB-123")).toEqual({ already: false });
    expect(await markPayoutPaid(database, po.id, "FIB-123")).toEqual({ already: true });
    expect(await sellerBalance(database, s.store.id)).toBe(0);
  });

  it("failed then late paid; return-page sync uses the provider, not the redirect", async () => {
    useMock();
    const s = await verifiedStoreWithOnline("gwlate");
    const order = await onlineOrder(s.store.id);
    const c = await startOrderCheckout(database, s.store.id, order.id, APP, { storeName: "T", provider: gateway() });
    const row = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    mock.settle(row.providerRef!, "failed");
    await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "FAILED"));
    expect((await database.query.orders.findFirst({ where: eq(orders.id, order.id) }))!.paymentStatus).toBe("failed");
    mock.settle(row.providerRef!, "paid");
    await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "PAID"));
    expect((await database.query.orders.findFirst({ where: eq(orders.id, order.id) }))!.paymentStatus).toBe("paid");
    // paid never goes back to failed
    const r = await applyGatewayStatus(database, row.id, { status: "failed", gateway: null, paidAt: null, raw: {} }, "test");
    expect(r.changed).toBe(false);
  });

  it("reconciliation re-checks payments pending for over 15 minutes", async () => {
    useMock();
    const s = await seller(database, "gwrec");
    const c = await startSubscriptionCheckout(database, s.store.id, { plan: "business", months: 1 }, APP);
    const row = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    mock.settle(row.providerRef!, "paid");
    const early = await reconcileGatewayPayments(database, { now: new Date(Date.now() + 5 * 60_000), provider: gateway() });
    expect(early.checked).toBe(0);
    const later = await reconcileGatewayPayments(database, { now: new Date(Date.now() + 16 * 60_000), provider: gateway() });
    expect(later.checked).toBeGreaterThanOrEqual(1);
    expect((await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) }))!.plan).toBe("business");
  });
});

describe("webhook security + idempotency", () => {
  it("bad signature/token → 401 and nothing changes", async () => {
    useMock();
    const s = await seller(database, "gwbad");
    const c = await startSubscriptionCheckout(database, s.store.id, { plan: "pro", months: 12 }, APP);
    const row = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    mock.settle(row.providerRef!, "paid");
    expect((await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "PAID", "forged-token-forged-token-forged"))).status).toBe(401);
    expect((await handleGatewayWebhook(database, "mock", { ...hook(row.providerRef!, "PAID"), url: `${APP}/api/payments/webhook/mock` })).status).toBe(401);
    expect((await handleGatewayWebhook(database, "mock", { ...hook(row.providerRef!, "PAID"), body: "{not json" })).status).toBe(401);
    expect((await handleGatewayWebhook(database, "rasedi", hook(row.providerRef!, "PAID"))).status).toBe(404);
    expect((await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!.status).toBe("pending");
    expect((await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) }))!.plan).toBe("free");
  });

  it("a forged PAID body for an unpaid payment changes nothing (status is re-fetched)", async () => {
    useMock();
    const s = await seller(database, "gwforge");
    const c = await startSubscriptionCheckout(database, s.store.id, { plan: "pro", months: 1 }, APP);
    const row = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    const r = await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "PAID"));
    expect(r.body).toMatchObject({ changed: false });
    expect((await database.query.stores.findFirst({ where: eq(stores.id, s.store.id) }))!.plan).toBe("free");
  });

  it("duplicate webhook is idempotent (one event, one activation, one ledger booking)", async () => {
    useMock();
    const s = await verifiedStoreWithOnline("gwdup");
    const order = await onlineOrder(s.store.id);
    const c = await startOrderCheckout(database, s.store.id, order.id, APP, { storeName: "T", provider: gateway() });
    const row = (await database.query.payments.findFirst({ where: eq(payments.id, c.paymentId) }))!;
    mock.settle(row.providerRef!, "paid");
    const a = await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "PAID"));
    const b = await handleGatewayWebhook(database, "mock", hook(row.providerRef!, "PAID"));
    const [x, y] = await Promise.all([
      handleGatewayWebhook(database, "mock", hook(row.providerRef!, "paid")),
      applyGatewayStatus(database, row.id, { status: "paid", gateway: "FIB", paidAt: null, raw: {} }, "race"),
    ]);
    expect(a.body).toMatchObject({ changed: true });
    expect(b.body).toMatchObject({ duplicate: true });
    expect(x.status).toBe(200);
    expect(y.changed).toBe(false);
    const ev = await database.select().from(paymentEvents).where(and(eq(paymentEvents.provider, "mock"), eq(paymentEvents.providerRef, row.providerRef!)));
    expect(ev).toHaveLength(1);
    const led = await database.select().from(ledgerEntries).where(eq(ledgerEntries.paymentId, row.id));
    expect(led.filter((l) => l.entryType === "sale")).toHaveLength(1);
  });
});

describe("tenant isolation", () => {
  it("one store can't start, see or pay another store's checkout", async () => {
    useMock();
    const a = await verifiedStoreWithOnline("gwta");
    const b = await verifiedStoreWithOnline("gwtb");
    const orderA = await onlineOrder(a.store.id);
    await expect(startOrderCheckout(database, b.store.id, orderA.id, APP, { storeName: "B", provider: gateway() })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Public checkout: B's slug + A's order id → not found.
    const ctx = (store: typeof a.store) => ({ ip: "1.2.3.4", appUrl: APP, sessionStore: async () => store });
    await expect(checkoutCore(database, gateway(), { kind: "order", slug: b.store.slug, publicId: orderA.publicId }, ctx(b.store))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const okA = await checkoutCore(database, gateway(), { kind: "order", slug: a.store.slug, publicId: orderA.publicId }, ctx(b.store));
    expect(okA.paymentId).toBeTruthy();
    // Subscriptions always bill the session's store, whatever the body says.
    const sub = await checkoutCore(database, gateway(), { kind: "subscription", plan: "pro", months: 1, storeId: a.store.id }, ctx(b.store));
    const subRow = await database.query.payments.findFirst({ where: eq(payments.id, sub.paymentId) });
    expect(subRow!.storeId).toBe(b.store.id);
    // Reads are scoped.
    expect((await listStorePayments(database, b.store.id)).every((p) => p.storeId === b.store.id)).toBe(true);
    expect((await listStorePayments(database, a.store.id)).some((p) => p.id === sub.paymentId)).toBe(false);
    // Payout profile edits only touch the caller's store, and send it back to review (toggle off).
    await savePayoutProfile(database, b.store.id, { method: "bank", accountName: "B Owner", accountIdentifier: "IQ12BANK0001" });
    expect((await storeOnlineStatus(database, a.store.id, gateway())).available).toBe(true);
    expect((await storeOnlineStatus(database, b.store.id, gateway())).available).toBe(false);
  });
});

describe("provider none (default) = today's behaviour", () => {
  it("no gateway, no online option, routes report disabled", async () => {
    resetGatewayConfig(parseGatewayConfig({}));
    setGateway(undefined);
    expect(gateway()).toBeNull();
    const s = await seller(database, "gwnone");
    await savePayoutProfile(database, s.store.id, { method: "fib", accountName: "Owner Name", accountIdentifier: "9647501234567" });
    await reviewPayoutProfile(database, s.store.id, "verified");
    await expect(setOnlinePayments(database, s.store.id, true, null)).rejects.toBeInstanceOf(AppError);
    expect((await storeOnlineStatus(database, s.store.id, null)).available).toBe(false);
    await expect(checkoutCore(database, null, { kind: "subscription", plan: "pro", months: 1 }, { ip: "x", appUrl: APP, sessionStore: async () => s.store })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await handleGatewayWebhook(database, "rasedi", hook("x", "PAID", SECRET, "rasedi"), null)).toEqual({ status: 404, body: { ok: false } });
    expect(await reconcileGatewayPayments(database, { provider: null })).toEqual({ checked: 0, changed: 0, errors: 0, orphaned: 0 });
    // Checkout refuses `online` when it isn't available.
    const p = await product(database, s.store.id, 5000);
    await expect(placeOrder(database, { id: s.store.id }, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "online" }), { isProviderAvailable: () => false })).rejects.toThrow();
  });
});
