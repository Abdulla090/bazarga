import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { placeOrder } from "@/server/services/orders";
import { listOrdersForExport } from "@/server/services/orders";
import { csvCell, ordersToCsv } from "@/lib/orders-csv";
import { checkoutSchema } from "@/lib/validation";
import { checkout, product, seller, testDb } from "./support/db";
import en from "../messages/en.json";
import ku from "../messages/ku.json";
import ar from "../messages/ar.json";
import kmr from "../messages/kmr.json";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("orders CSV", () => {
  it("escapes quotes/commas/newlines and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+9647701112233")).toBe("'+9647701112233");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
  });
  it("exports only the store's own orders, with items, BOM and Baghdad time", async () => {
    const a = await seller(database, "expa");
    const b = await seller(database, "expb");
    const pa = await product(database, a.store.id, 20_000);
    const pb = await product(database, b.store.id, 20_000);
    await placeOrder(database, a.store, checkoutSchema.parse({ ...checkout([{ productId: pa.id, quantity: 2 }]), phone: "07701112233", notes: undefined }));
    await placeOrder(database, b.store, checkoutSchema.parse({ ...checkout([{ productId: pb.id, quantity: 1 }]), phone: "07701112244", notes: undefined }));
    const rows = await listOrdersForExport(database, a.store.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.items).toHaveLength(1);
    const csv = ordersToCsv(rows);
    expect(csv.startsWith("\uFEFForder,date,")).toBe(true);
    expect(csv).toContain("2 x ");
    expect(csv).toContain("'+9647701112233");
    expect(csv).not.toContain("7701112244");
    expect(csv.split("\r\n")).toHaveLength(3);
  });
  it("has the button label in all locales", () => {
    for (const m of [en, ku, ar, kmr]) expect((m as { orders: Record<string, string> }).orders.export).toBeTruthy();
  });
});

describe("new-orders badge count", () => {
  it("counts only this store's pending orders", async () => {
    const { countNewOrders } = await import("@/server/services/orders");
    const a = await seller(database, "cnta");
    const b = await seller(database, "cntb");
    const pa = await product(database, a.store.id, 20_000);
    const pb = await product(database, b.store.id, 20_000);
    expect(await countNewOrders(database, a.store.id)).toBe(0);
    await placeOrder(database, a.store, checkoutSchema.parse({ ...checkout([{ productId: pa.id, quantity: 1 }]), phone: "07701119911", notes: undefined }));
    await placeOrder(database, b.store, checkoutSchema.parse({ ...checkout([{ productId: pb.id, quantity: 1 }]), phone: "07701119922", notes: undefined }));
    expect(await countNewOrders(database, a.store.id)).toBe(1);
    expect(await countNewOrders(database, b.store.id)).toBe(1);
    for (const m of [en, ku, ar, kmr]) expect((m as { dash: Record<string, string> }).dash.newOrders).toContain("{count");
  });
});
