import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { orders, products } from "@/server/db/schema";
import { placeOrder } from "@/server/services/orders";
import { checkoutSchema } from "@/lib/validation";
import { IDEMPOTENCY_KEY_RE, isIdempotencyKey, newIdempotencyKey } from "@/lib/idempotency";
import { buildInfo } from "@/server/build-info";
import { BrevoEmailProvider, ConsoleEmailProvider, ResendEmailProvider, parseFrom, selectEmailProvider } from "@/server/email";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

const KEY = "Ab3_-xYz0123456789abcd";
const countOrders = async (storeId: string) =>
  Number((await database.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.storeId, storeId)))[0]!.n);
const stockOf = async (id: string) => (await database.query.products.findFirst({ where: eq(products.id, id) }))!.stock;

describe("idempotency keys", () => {
  it("mints 22-char base64url keys that pass the shared regex, and they differ", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(IDEMPOTENCY_KEY_RE);
    expect(a).toHaveLength(22);
    expect(a).not.toBe(b);
    expect(isIdempotencyKey("short")).toBe(false);
    expect(isIdempotencyKey("x".repeat(65))).toBe(false);
    expect(isIdempotencyKey("has space in it 1234")).toBe(false);
  });

  it("checkout schema keeps a valid key and drops a malformed one without failing the order", () => {
    const base = { items: [{ productId: crypto.randomUUID(), quantity: 1 }], customerName: "Shilan", phone: "07701112233", cityKey: "erbil", address: "Near the mosque", paymentMethod: "cod" };
    expect(checkoutSchema.parse({ ...base, idempotencyKey: KEY }).idempotencyKey).toBe(KEY);
    expect(checkoutSchema.parse({ ...base, idempotencyKey: "<script>" }).idempotencyKey).toBeUndefined();
    expect(checkoutSchema.parse({ ...base, idempotencyKey: 42 }).idempotencyKey).toBeUndefined();
    expect(checkoutSchema.parse(base).idempotencyKey).toBeUndefined();
  });
});

describe("idempotent order creation", () => {
  it("the same key returns the first order: one order, one stock decrement", async () => {
    const { store } = await seller(database, "idem1");
    const p = await product(database, store.id, 10_000, 5);
    const first = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }], { idempotencyKey: KEY }));
    expect(first.replayed).toBeFalsy();
    const again = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }], { idempotencyKey: KEY }));
    expect(again.replayed).toBe(true);
    expect(again.id).toBe(first.id);
    expect(again.items).toHaveLength(1);
    expect(await countOrders(store.id)).toBe(1);
    expect(await stockOf(p.id)).toBe(3);
  });

  it("a retry still gets its order after the last unit sold (no false out-of-stock)", async () => {
    const { store } = await seller(database, "idem2");
    const p = await product(database, store.id, 10_000, 1);
    const first = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { idempotencyKey: KEY }));
    const retry = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { idempotencyKey: KEY }));
    expect(retry.id).toBe(first.id);
    expect(await stockOf(p.id)).toBe(0);
  });

  it("concurrent copies of one attempt create exactly one order", async () => {
    const { store } = await seller(database, "idem3");
    const p = await product(database, store.id, 10_000, 10);
    const key = newIdempotencyKey();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { idempotencyKey: key }))),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await countOrders(store.id)).toBe(1);
    expect(await stockOf(p.id)).toBe(9);
  });

  it("keys are per store (tenant isolation): the same key in another store is a new order there", async () => {
    const a = await seller(database, "idem4a");
    const b = await seller(database, "idem4b");
    const pa = await product(database, a.store.id, 10_000, 5);
    const pb = await product(database, b.store.id, 10_000, 5);
    const oa = await placeOrder(database, a.store, checkout([{ productId: pa.id, quantity: 1 }], { idempotencyKey: KEY }));
    const ob = await placeOrder(database, b.store, checkout([{ productId: pb.id, quantity: 1 }], { idempotencyKey: KEY }));
    expect(ob.id).not.toBe(oa.id);
    expect(ob.replayed).toBeFalsy();
    expect(ob.storeId).toBe(b.store.id);
  });

  it("a key reused with another phone never returns the first shopper's order", async () => {
    const { store } = await seller(database, "idem5");
    const p = await product(database, store.id, 10_000, 5);
    const first = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { idempotencyKey: KEY }));
    const other = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }], { idempotencyKey: KEY, phone: "9647509998877" }));
    expect(other.id).not.toBe(first.id);
    expect(other.customerPhone).toBe("9647509998877");
    expect(other.idempotencyKey).toBeNull();
    const stored = await database.query.orders.findFirst({ where: and(eq(orders.storeId, store.id), eq(orders.idempotencyKey, KEY)) });
    expect(stored?.id).toBe(first.id);
  });

  it("without a key, behaviour is unchanged (each distinct order is created)", async () => {
    const { store } = await seller(database, "idem6");
    const p = await product(database, store.id, 10_000, 5);
    const o1 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 1 }]));
    expect(o1.idempotencyKey).toBeNull();
    const o2 = await placeOrder(database, store, checkout([{ productId: p.id, quantity: 2 }]));
    expect(o2.id).not.toBe(o1.id);
  });
});

describe("migration 0015 (indexes)", () => {
  const sqlText = readFileSync(path.join(process.cwd(), "drizzle/0015_idempotency_indexes.sql"), "utf8");
  it("is additive only", () => {
    expect(sqlText).not.toMatch(/\bDROP\b|\bRENAME\b|ALTER COLUMN|\bTRUNCATE\b|\bDELETE\b/i);
  });
  it("creates the reviewed indexes on a migrated database", async () => {
    const res = await database.execute(sql`select indexname from pg_indexes where schemaname = 'public'`);
    const names = new Set((res as unknown as { rows: { indexname: string }[] }).rows.map((r) => r.indexname));
    for (const n of [
      "orders_store_idempotency_uq",
      "orders_unpaid_online_created_idx",
      "customers_store_last_order_idx",
      "order_items_product_idx",
      "products_store_sort_idx",
      "products_category_idx",
      "stores_paid_period_end_idx",
    ]) expect(names.has(n), n).toBe(true);
  });
  it("is the last journal entry and numbered after 0014", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: { idx: number; tag: string }[] };
    const last = j.entries.at(-1)!;
    expect(last.tag).toBe("0015_idempotency_indexes");
    expect(last.idx).toBe(15);
  });
});

describe("build info (/api/health)", () => {
  it("prefers the Vercel commit sha and shortens it", () => {
    const b = buildInfo({ VERCEL_GIT_COMMIT_SHA: "EB4AB9558FEB9FAA674DC0D38BB6B56942DF13C3", VERCEL_ENV: "production" });
    expect(b.sha).toBe("eb4ab9558feb9faa674dc0d38bb6b56942df13c3");
    expect(b.shortSha).toBe("eb4ab95");
    expect(b.env).toBe("production");
  });
  it("falls back to GIT_SHA, then 'unknown'; garbage is never echoed", () => {
    expect(buildInfo({ GIT_SHA: "abc1234" }).sha).toBe("abc1234");
    expect(buildInfo({}).sha).toBe("unknown");
    expect(buildInfo({ GIT_SHA: "<b>x</b>" }).sha).toBe("unknown");
  });
  it("health route reports sha, never caches, and pings the DB with a timeout", () => {
    const src = readFileSync(path.join(process.cwd(), "src/app/api/health/route.ts"), "utf8");
    expect(src).toContain("buildInfo()");
    expect(src).toContain("no-store");
    expect(src).toContain("select 1");
    expect(src).toMatch(/status: 503/);
  });
});

describe("transactional email provider", () => {
  it("selects by env and falls back to console when the key is missing", () => {
    const from = "Bazarga <hello@bazarga.app>";
    expect(selectEmailProvider({ EMAIL_DRIVER: "console", EMAIL_FROM: from })).toBeInstanceOf(ConsoleEmailProvider);
    expect(selectEmailProvider({ EMAIL_DRIVER: "resend", EMAIL_FROM: from, RESEND_API_KEY: "re_x" })).toBeInstanceOf(ResendEmailProvider);
    expect(selectEmailProvider({ EMAIL_DRIVER: "brevo", EMAIL_FROM: from, BREVO_API_KEY: "xkeysib-x" })).toBeInstanceOf(BrevoEmailProvider);
    expect(selectEmailProvider({ EMAIL_DRIVER: "brevo", EMAIL_FROM: from })).toBeInstanceOf(ConsoleEmailProvider);
    expect(selectEmailProvider({ EMAIL_DRIVER: "resend", EMAIL_FROM: from, RESEND_API_KEY: "" })).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("parses the From header", () => {
    expect(parseFrom("Bazarga <hello@bazarga.app>")).toEqual({ name: "Bazarga", email: "hello@bazarga.app" });
    expect(parseFrom("hello@bazarga.app")).toEqual({ email: "hello@bazarga.app" });
  });

  it("console provider validates the message (zod) and records it", async () => {
    const c = new ConsoleEmailProvider();
    await c.send({ to: "a@b.iq", subject: "Hi", text: "Body" });
    expect(c.sent).toHaveLength(1);
    await expect(c.send({ to: "not-an-email", subject: "Hi", text: "Body" })).rejects.toThrow();
  });

  it("brevo sends the documented payload and throws on a non-2xx", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(calls.length === 1 ? "{}" : "bad", { status: calls.length === 1 ? 201 : 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const p = new BrevoEmailProvider("xkeysib-test", "Bazarga <hello@bazarga.app>");
      await p.send({ to: "a@b.iq", subject: "Reset", text: "link" });
      expect(calls[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
      expect((calls[0]!.init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
      expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ sender: { name: "Bazarga", email: "hello@bazarga.app" }, to: [{ email: "a@b.iq" }], subject: "Reset", textContent: "link" });
      await expect(p.send({ to: "a@b.iq", subject: "Reset", text: "link" })).rejects.toThrow(/brevo send failed: 401/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("security headers + rate limits (launch verification)", () => {
  const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
  it("static security headers are set for every path", () => {
    const cfg = read("next.config.ts");
    for (const h of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security", "Cross-Origin-Opener-Policy"]) expect(cfg).toContain(h);
    expect(cfg).toContain("poweredByHeader: false");
  });
  it("auth, checkout, track and uploads are rate limited", () => {
    const auth = read("src/server/actions/auth.ts");
    for (const k of ["signup:ip:", "login:ip:", "login:email:", "forgot:ip:", "reset:ip:"]) expect(auth).toContain(k);
    const sf = read("src/server/actions/storefront.ts");
    expect(sf).toContain("`checkout:${ip}`");
    expect(sf).toContain("checkout:${store.id}:${ip}");
    expect(read("src/server/services/tracking.ts")).toContain("track:ip:");
    expect(read("src/app/api/uploads/route.ts")).toContain("upload:${store.id}");
  });
  it("the daily cron prunes stale rate-limit counters", () => {
    expect(read("src/app/api/cron/daily/route.ts")).toContain("pruneRateLimits(");
  });
});
