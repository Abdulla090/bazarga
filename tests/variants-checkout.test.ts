import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { productOptionValues, productOptions, productVariants, products } from "@/server/db/schema";
import { mergeCart, placeOrder, quoteCart, updateOrderStatus } from "@/server/services/orders";
import { cartItemSchema } from "@/lib/validation";
import { initialSelection, isValueAvailable, matchVariant, priceRange } from "@/lib/variants";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => {
  database = await testDb();
});

const variantStock = async (id: string) =>
  (await database.query.productVariants.findFirst({ where: eq(productVariants.id, id) }))!.stock;
const productStock = async (id: string) => (await database.query.products.findFirst({ where: eq(products.id, id) }))!.stock;

/** A dress in S / M / L (stock 1 / 5 / untracked; L costs more) and Red / Blue. */
async function dress(storeId: string) {
  const p = await product(database, storeId, 80_000, 99); // product stock is ignored once variants exist
  const [size, colour] = await database
    .insert(productOptions)
    .values([
      { productId: p.id, storeId, name: { en: "Size" }, sort: 0 },
      { productId: p.id, storeId, name: { en: "Colour" }, sort: 1 },
    ])
    .returning();
  const vals = await database
    .insert(productOptionValues)
    .values([
      { optionId: size!.id, productId: p.id, storeId, label: { en: "S" }, sort: 0 },
      { optionId: size!.id, productId: p.id, storeId, label: { en: "M" }, sort: 1 },
      { optionId: size!.id, productId: p.id, storeId, label: { en: "L" }, sort: 2 },
      { optionId: colour!.id, productId: p.id, storeId, label: { en: "Red", ku: "سوور" }, swatch: "#C62828", sort: 0 },
    ])
    .returning();
  const [S, M, L, red] = vals as [typeof vals[0], typeof vals[0], typeof vals[0], typeof vals[0]];
  const [vS, vM, vL] = await database
    .insert(productVariants)
    .values([
      { productId: p.id, storeId, optionValueIds: [S.id, red.id], sku: `D-S-${p.id.slice(0, 4)}`, stock: 1, sort: 0 },
      { productId: p.id, storeId, optionValueIds: [M.id, red.id], stock: 5, sort: 1 },
      { productId: p.id, storeId, optionValueIds: [L.id, red.id], stock: null, price: 90_000, sort: 2 },
    ])
    .returning();
  return { p, vS: vS!, vM: vM!, vL: vL!, size: size!, colour: colour!, S, M, L, red };
}

describe("variant checkout", () => {
  it("prices per variant, snapshots title + SKU on the order item and decrements only that variant", async () => {
    const { store } = await seller(database, "var");
    const d = await dress(store.id);
    const order = await placeOrder(
      database,
      store,
      checkout([
        { productId: d.p.id, variantId: d.vM.id, quantity: 2 },
        { productId: d.p.id, variantId: d.vL.id, quantity: 1 },
      ]),
    );
    expect(order.subtotal).toBe(2 * 80_000 + 90_000);
    const m = order.items.find((i) => i.variantId === d.vM.id)!;
    expect(m).toMatchObject({ unitPrice: 80_000, quantity: 2, variantTitle: "M / سوور", name: "کاڵا" }); // titles snapshot in the order language (ku)
    const l = order.items.find((i) => i.variantId === d.vL.id)!;
    expect(l.unitPrice).toBe(90_000);
    expect(await variantStock(d.vM.id)).toBe(3);
    expect(await variantStock(d.vL.id)).toBeNull(); // untracked stays untracked
    expect(await variantStock(d.vS.id)).toBe(1);
    expect(await productStock(d.p.id)).toBe(99); // product-level stock untouched
  });

  it("refuses a product with variants bought without one, and a variant of another product", async () => {
    const { store } = await seller(database, "varreq");
    const d = await dress(store.id);
    const other = await product(database, store.id, 1_000, 5);
    await expect(placeOrder(database, store, checkout([{ productId: d.p.id, quantity: 1 }]))).rejects.toMatchObject({
      code: "VALIDATION",
      message: "variant_required",
    });
    await expect(
      placeOrder(database, store, checkout([{ productId: d.p.id, variantId: "00000000-0000-4000-8000-000000000000", quantity: 1 }])),
    ).rejects.toMatchObject({ message: "variant_required" });
    // A simple product can't carry a variant id (stale cart after the seller removed variants).
    await expect(
      placeOrder(database, store, checkout([{ productId: other.id, variantId: d.vM.id, quantity: 1 }])),
    ).rejects.toMatchObject({ message: "product_unavailable" });
  });

  it("another store's variant id never prices or decrements", async () => {
    const a = await seller(database, "varA");
    const b = await seller(database, "varB");
    const d = await dress(a.store.id);
    await expect(
      placeOrder(database, b.store, checkout([{ productId: d.p.id, variantId: d.vM.id, quantity: 1 }])),
    ).rejects.toMatchObject({ message: "product_unavailable" });
    expect(await variantStock(d.vM.id)).toBe(5);
  });

  it("never oversells the last unit of a variant under concurrent checkouts", async () => {
    const { store } = await seller(database, "varrace");
    const d = await dress(store.id);
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => placeOrder(database, store, checkout([{ productId: d.p.id, variantId: d.vS.id, quantity: 1 }]))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await variantStock(d.vS.id)).toBe(0);
  });

  it("rolls back every line when one variant is short", async () => {
    const { store } = await seller(database, "varshort");
    const d = await dress(store.id);
    await expect(
      placeOrder(
        database,
        store,
        checkout([
          { productId: d.p.id, variantId: d.vM.id, quantity: 2 },
          { productId: d.p.id, variantId: d.vS.id, quantity: 2 },
        ]),
      ),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await variantStock(d.vM.id)).toBe(5);
    expect(await variantStock(d.vS.id)).toBe(1);
  });

  it("cancelling or returning restocks the variant, not the product", async () => {
    const { store, user } = await seller(database, "varrestock");
    const d = await dress(store.id);
    const o = await placeOrder(database, store, checkout([{ productId: d.p.id, variantId: d.vM.id, quantity: 3 }]));
    expect(await variantStock(d.vM.id)).toBe(2);
    await updateOrderStatus(database, store.id, o.id, "cancelled", user.id);
    expect(await variantStock(d.vM.id)).toBe(5);
    expect(await productStock(d.p.id)).toBe(99);
  });

  it("deactivated variants can't be bought", async () => {
    const { store } = await seller(database, "varoff");
    const d = await dress(store.id);
    await database.update(productVariants).set({ isActive: false }).where(eq(productVariants.id, d.vM.id));
    await expect(
      placeOrder(database, store, checkout([{ productId: d.p.id, variantId: d.vM.id, quantity: 1 }])),
    ).rejects.toMatchObject({ message: "variant_required" });
  });
});

describe("variant quote (cart page)", () => {
  it("keeps variants of one product as separate lines and flags the ones that can't be bought", async () => {
    const { store } = await seller(database, "varq");
    const d = await dress(store.id);
    const q = await quoteCart(
      database,
      store.id,
      [
        { productId: d.p.id, variantId: d.vM.id, quantity: 1 },
        { productId: d.p.id, variantId: d.vM.id, quantity: 1 },
        { productId: d.p.id, variantId: d.vS.id, quantity: 4 },
        { productId: d.p.id, quantity: 1 },
      ],
      "erbil",
      "ku",
    );
    expect(q.lines.map((l) => [l.variantId, l.quantity, l.available, l.problem])).toEqual([
      [d.vM.id, 2, true, null],
      [d.vS.id, 4, false, "out_of_stock"],
      [null, 1, false, "variant_required"],
    ]);
    expect(q.lines[0]!.variantTitle).toBe("M / سوور");
    expect(q.subtotal).toBe(160_000);
  });
});

describe("cart input", () => {
  it("merges by product + variant and validates variant ids", () => {
    expect(
      mergeCart([
        { productId: "a", quantity: 1 },
        { productId: "a", variantId: null, quantity: 2 },
        { productId: "a", variantId: "v1", quantity: 1 },
      ]),
    ).toEqual([
      { productId: "a", variantId: null, quantity: 3 },
      { productId: "a", variantId: "v1", quantity: 1 },
    ]);
    const id = "11111111-1111-4111-8111-111111111111";
    expect(cartItemSchema.safeParse({ productId: id, variantId: "nope", quantity: 1 }).success).toBe(false);
    expect(cartItemSchema.parse({ productId: id, quantity: 1 }).variantId).toBeUndefined();
  });
});

describe("variant picker rules", () => {
  const v = (id: string, ids: string[], stock: number | null, price = 100) => ({ id, optionValueIds: ids, stock, price });
  const variants = [v("sR", ["S", "R"], 0), v("sB", ["S", "B"], 2), v("mR", ["M", "R"], null, 120), v("mB", ["M", "B"], 0)];

  it("disables values with no in-stock combination given the other picks", () => {
    expect(isValueAvailable(variants, {}, "size", "S")).toBe(true);
    expect(isValueAvailable(variants, { colour: "R" }, "size", "S")).toBe(false);
    expect(isValueAvailable(variants, { colour: "B" }, "size", "M")).toBe(false);
    expect(isValueAvailable(variants, { size: "M" }, "colour", "R")).toBe(true);
  });

  it("matches a variant only when every option is picked; ranges ignore sold-out variants", () => {
    expect(matchVariant(["size", "colour"], variants, { size: "M" })).toBeNull();
    expect(matchVariant(["size", "colour"], variants, { size: "M", colour: "R" })?.id).toBe("mR");
    expect(priceRange(variants, 0)).toEqual({ min: 100, max: 120 });
    expect(priceRange([v("x", [], 0, 50)], 0)).toEqual({ min: 50, max: 50 });
    expect(initialSelection([{ id: "o1", values: [{ id: "only" }] }, { id: "o2", values: [{ id: "a" }, { id: "b" }] }])).toEqual({ o1: "only" });
  });
});
