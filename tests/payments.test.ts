import { beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { orders } from "@/server/db/schema";
import { FibProvider, mapFibStatus } from "@/server/payments/fib";
import { ZainCashProvider, mapZainCashStatus, zainCashClaims } from "@/server/payments/zaincash";
import { applyPaymentStatus, claimWebhookEvent, startPayment, syncPaymentFromProvider } from "@/server/payments/service";
import { placeOrder } from "@/server/services/orders";
import { checkout, enable, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fibSeq = 0;
function fibFetch(statusValue: () => string) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/openid-connect/token")) {
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("grant_type=client_credentials");
      return jsonRes(200, { access_token: "tok", expires_in: 60 });
    }
    if (u.endsWith("/protected/v1/payments")) {
      const body = JSON.parse(String(init?.body));
      expect(body.monetaryValue).toEqual({ amount: "28000.00", currency: "IQD" });
      expect(body.description.length).toBeLessThanOrEqual(50);
      fibSeq++;
      return jsonRes(202, {
        paymentId: `pay-${fibSeq}`,
        readableCode: "ABCD-EFGH",
        qrCode: "data:image/png;base64,AAA",
        validUntil: "2026-10-07T12:00:00Z",
        personalAppLink: "https://personal.example/pay",
      });
    }
    const m = /\/payments\/(pay-\d+)\/status$/.exec(u);
    if (m) return jsonRes(200, { paymentId: m[1], status: statusValue() });
    return jsonRes(404, {});
  }) as unknown as typeof fetch;
}

async function fibOrder() {
  const { store } = await seller(database, "fib");
  await enable(database, store.id, "fib");
  const p = await product(database, store.id, 25_000);
  const order = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "fib" }), {
    isProviderAvailable: () => true,
  });
  return { store, order };
}

describe("FIB", () => {
  it("maps statuses", () => {
    expect(mapFibStatus("PAID")).toBe("paid");
    expect(mapFibStatus("DECLINED")).toBe("failed");
    expect(mapFibStatus("UNPAID")).toBe("pending");
  });

  it("creates a QR payment and applies the re-fetched status idempotently", async () => {
    let remote = "UNPAID";
    const fib = new FibProvider(
      { baseUrl: "https://fib.test", clientId: "id", clientSecret: "secret", enabled: true },
      fibFetch(() => remote),
    );
    expect(fib.isConfigured()).toBe(true);
    const { store, order } = await fibOrder();
    const init = await startPayment(database, fib, order, {
      storeName: store.name,
      returnUrl: "https://x/return",
      callbackUrl: "https://x/cb",
    });
    expect(init.kind).toBe("qr");
    if (init.kind !== "qr") return;
    const ref = init.providerRef;
    expect(ref).toMatch(/^pay-\d+$/);
    expect(init.readableCode).toBe("ABCD-EFGH");

    // Callback arrives while still unpaid → nothing changes.
    expect((await syncPaymentFromProvider(database, fib, ref)).changed).toBe(false);
    remote = "PAID";
    expect((await syncPaymentFromProvider(database, fib, ref)).changed).toBe(true);
    // Retried callback → idempotent no-op.
    expect((await syncPaymentFromProvider(database, fib, ref)).changed).toBe(false);
    const o = await database.query.orders.findFirst({ where: eq(orders.id, order.id) });
    expect(o?.paymentStatus).toBe("paid");
  });

  it("is not configured without credentials or flag", () => {
    expect(new FibProvider({ baseUrl: "x", enabled: true }).isConfigured()).toBe(false);
    expect(new FibProvider({ baseUrl: "x", clientId: "a", clientSecret: "b", enabled: false }).isConfigured()).toBe(false);
  });
});

describe("payment status application", () => {
  it("never downgrades paid → failed and rejects unknown refs", async () => {
    const fib = new FibProvider(
      { baseUrl: "https://fib.test", clientId: "id", clientSecret: "secret", enabled: true },
      fibFetch(() => "UNPAID"),
    );
    const { store, order } = await fibOrder();
    const init = await startPayment(database, fib, order, { storeName: store.name, returnUrl: "r", callbackUrl: "c" });
    if (init.kind !== "qr") throw new Error("expected qr");
    const r1 = await applyPaymentStatus(database, "fib", init.providerRef, "paid");
    const r2 = await applyPaymentStatus(database, "fib", init.providerRef, "failed");
    expect(r1.changed).toBe(true);
    expect(r2.changed).toBe(false);
    await expect(applyPaymentStatus(database, "fib", "nope", "paid")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("claims webhook event ids once", async () => {
    expect(await claimWebhookEvent(database, "zaincash", "evt-1")).toBe(true);
    expect(await claimWebhookEvent(database, "zaincash", "evt-1")).toBe(false);
  });
});

describe("ZainCash v2", () => {
  const apiKey = "test-api-key-which-is-long-enough-for-hs256";

  it("maps statuses", () => {
    expect(mapZainCashStatus("SUCCESS")).toBe("paid");
    expect(mapZainCashStatus("FAILED")).toBe("failed");
    expect(mapZainCashStatus("EXPIRED")).toBe("failed");
    expect(mapZainCashStatus("OTP_SENT")).toBe("pending");
    expect(mapZainCashStatus("REFUNDED")).toBe("refunded");
  });

  it("inits a redirect payment with OAuth2 and verifies HS256 callback tokens", async () => {
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/oauth2/token")) {
        expect(String(init?.body)).toContain("scope=payment%3Aread+payment%3Awrite");
        return jsonRes(200, { access_token: "zc", expires_in: 3600 });
      }
      if (u.endsWith("/transaction/init")) {
        const b = JSON.parse(String(init?.body));
        expect(b.amount).toEqual({ value: 28000, currency: "IQD" });
        expect(b.language).toBe("ku");
        expect(b.redirectUrls.successUrl).toContain("r=success");
        return jsonRes(200, { status: "SUCCESS", transactionId: "zc-tx-1", redirectUrl: "https://pg.zaincash/pay/zc-tx-1" });
      }
      if (u.includes("/transaction/inquiry/zc-tx-1")) return jsonRes(200, { status: "SUCCESS" });
      return jsonRes(404, {});
    }) as unknown as typeof fetch;
    const zc = new ZainCashProvider(
      { baseUrl: "https://zc.test", clientId: "c", clientSecret: "s", apiKey, scope: "payment:read payment:write", enabled: true },
      f,
    );
    const { store } = await seller(database, "zc");
    await enable(database, store.id, "zaincash");
    const p = await product(database, store.id, 25_000);
    const order = await placeOrder(
      database,
      store,
      checkout([{ productId: p.id, quantity: 1 }], { paymentMethod: "zaincash" }),
      { isProviderAvailable: () => true },
    );
    const init = await startPayment(database, zc, order, { storeName: store.name, returnUrl: "https://x/ret?o=1", callbackUrl: "c" });
    expect(init).toMatchObject({ kind: "redirect", providerRef: "zc-tx-1", url: "https://pg.zaincash/pay/zc-tx-1" });

    const good = await new SignJWT({ transactionId: "zc-tx-1", status: "SUCCESS" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(apiKey));
    const claims = zainCashClaims(await zc.verifyCallbackToken(good));
    expect(claims.transactionId).toBe("zc-tx-1");
    const bad = await new SignJWT({ transactionId: "zc-tx-1" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("wrong-key-wrong-key-wrong-key-wrong"));
    await expect(zc.verifyCallbackToken(bad)).rejects.toBeTruthy();

    const r = await syncPaymentFromProvider(database, zc, claims.transactionId!);
    expect(r.status).toBe("paid");
  });
});
