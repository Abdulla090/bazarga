import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products } from "@/server/db/schema";
import { listLowStock } from "@/server/services/catalog";
import { LOW_STOCK_THRESHOLD, rankLowStock, stockLevel } from "@/lib/low-stock";
import { product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

describe("stockLevel", () => {
  it("classifies units", () => {
    expect(stockLevel(null)).toBe("untracked");
    expect(stockLevel(0)).toBe("out");
    expect(stockLevel(1)).toBe("low");
    expect(stockLevel(LOW_STOCK_THRESHOLD)).toBe("low");
    expect(stockLevel(LOW_STOCK_THRESHOLD + 1)).toBe("ok");
  });
  it("ranks sold out first and caps", () => {
    const r = (stock: number) => ({ productId: String(stock), name: {}, variantLabels: [], stock });
    expect(rankLowStock([r(4), r(0), r(2)], 2).map((x) => x.stock)).toEqual([0, 2]);
  });
});

describe("listLowStock", () => {
  it("returns only this store's visible tracked low products", async () => {
    const a = await seller(database, "low-a");
    const b = await seller(database, "low-b");
    const low = await product(database, a.store.id, 1000, 2);
    await product(database, a.store.id, 1000, 50);
    await product(database, a.store.id, 1000, null);
    const hidden = await product(database, a.store.id, 1000, 1);
    await database.update(products).set({ isActive: false }).where(eq(products.id, hidden.id));
    await product(database, b.store.id, 1000, 0);
    const res = await listLowStock(database, a.store.id);
    expect(res.total).toBe(1);
    expect(res.rows[0]!.productId).toBe(low.id);
    expect(res.rows[0]!.stock).toBe(2);
  });
});
