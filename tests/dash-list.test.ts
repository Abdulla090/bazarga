import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { listOrdersPage, placeOrder } from "@/server/services/orders";
import { checkoutSchema } from "@/lib/validation";
import { listHref, matchesProduct, orderQuery, pageWindow, parseDashPage, parseDashQuery } from "@/lib/dash-list";
import { checkout, product, seller, testDb } from "./support/db";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import ar from "../messages/ar.json";
import kmr from "../messages/kmr.json";

/** E2E audit A3: dashboard orders/products lists page + search instead of a hard 200 (orders) / everything (products). */
let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("dash-list helpers", () => {
  it("parses page + query defensively", () => {
    expect(parseDashPage(undefined)).toBe(1);
    expect(parseDashPage("abc")).toBe(1);
    expect(parseDashPage("-3")).toBe(1);
    expect(parseDashPage(["4"])).toBe(4);
    expect(parseDashPage("999999999")).toBe(10_000);
    expect(parseDashQuery("  hi  ")).toBe("hi");
    expect(parseDashQuery("x".repeat(200))).toHaveLength(64);
  });
  it("reads an order search as number, phone or name (Kurdish/Arabic digits too)", () => {
    expect(orderQuery("#1042")).toEqual({ number: 1042, phoneDigits: "1042", text: null });
    expect(orderQuery("0750 123 4567")).toMatchObject({ phoneDigits: "7501234567", text: "0750 123 4567" });
    expect(orderQuery("٠٧٥٠١٢٣")).toMatchObject({ number: 750123, phoneDigits: "750123" });
    expect(orderQuery("شیلان")).toEqual({ number: null, phoneDigits: null, text: "شیلان" });
    expect(orderQuery("")).toEqual({ number: null, phoneDigits: null, text: null });
  });
  it("windows pages and clamps past the end", () => {
    expect(pageWindow(1, 0)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0 });
    expect(pageWindow(2, 120)).toMatchObject({ page: 2, pages: 3, from: 51, to: 100, offset: 50 });
    expect(pageWindow(9, 120)).toMatchObject({ page: 3, from: 101, to: 120 });
  });
  it("matches products in any language + SKU, accent/letter-variant insensitive", () => {
    const p = { name: { ku: "کراسی کەتان", en: "Linen shirt" }, sku: "SH-01" };
    expect(matchesProduct(p, "linen")).toBe(true);
    expect(matchesProduct(p, "کراس")).toBe(true);
    expect(matchesProduct(p, "sh-01")).toBe(true);
    expect(matchesProduct(p, "mug")).toBe(false);
  });
  it("builds hrefs that keep filter + query", () => {
    expect(listHref("/dashboard/orders", { status: "pending", q: "a b", page: 3 })).toBe("/dashboard/orders?status=pending&q=a+b&page=3");
    expect(listHref("/dashboard/orders", { page: 1 })).toBe("/dashboard/orders");
  });
  it("has the labels in all 4 locales with matching placeholders", () => {
    for (const m of [en, ku, ar, kmr]) {
      const d = (m as { dash: Record<string, string> }).dash;
      for (const k of ["search", "searchOrders", "searchProducts", "clearSearch", "newer", "older", "prevPage", "nextPage"]) expect(d[k], k).toBeTruthy();
      expect(d.showing).toMatch(/\{from\}.*\{to\}.*\{total\}/);
      expect(d.noMatches).toContain("{q}");
    }
  });
});

describe("listOrdersPage", () => {
  it("pages past 200, searches by number / phone / name, escapes LIKE wildcards, stays in the store", async () => {
    const a = await seller(database, "pga");
    const b = await seller(database, "pgb");
    const pa = await product(database, a.store.id, 1_000);
    const pb = await product(database, b.store.id, 1_000);
    for (let i = 0; i < 7; i++) {
      await placeOrder(database, a.store, checkoutSchema.parse({ ...checkout([{ productId: pa.id, quantity: 1 }]), customerName: i === 3 ? "Shilan 100%" : `Buyer ${i}`, phone: `077011120${String(i).padStart(2, "0")}`, notes: undefined }));
    }
    await placeOrder(database, b.store, checkoutSchema.parse({ ...checkout([{ productId: pb.id, quantity: 1 }]), customerName: "Shilan other store", phone: "07701112999", notes: undefined }));
    const p1 = await listOrdersPage(database, a.store.id, { limit: 3 });
    const p3 = await listOrdersPage(database, a.store.id, { limit: 3, offset: 6 });
    expect(p1.total).toBe(7);
    expect(p1.orders).toHaveLength(3);
    expect(p3.orders).toHaveLength(1);
    expect(new Set([...p1.orders, ...p3.orders].map((o) => o.id)).size).toBe(4);
    expect((await listOrdersPage(database, a.store.id, { q: "shilan" })).orders.map((o) => o.customerName)).toEqual(["Shilan 100%"]);
    expect((await listOrdersPage(database, a.store.id, { q: "%" })).total).toBe(1);
    expect((await listOrdersPage(database, a.store.id, { q: "_" })).total).toBe(0);
    expect((await listOrdersPage(database, a.store.id, { q: "0770 111 2005" })).total).toBe(1);
    const first = p3.orders[0]!;
    expect((await listOrdersPage(database, a.store.id, { q: `#${first.number}` })).orders.map((o) => o.id)).toContain(first.id);
    expect((await listOrdersPage(database, a.store.id, { q: "other store" })).total).toBe(0);
    expect((await listOrdersPage(database, a.store.id, { status: "delivered" })).total).toBe(0);
  });
});
