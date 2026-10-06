import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { products } from "@/server/db/schema";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getProduct,
  listCategories,
  listProducts,
  setProductActive,
  updateCategory,
  updateProduct,
} from "@/server/services/catalog";
import { getOrder, getOrderByPublicId, listCustomers, listOrders, placeOrder, quoteCart, updateOrderStatus } from "@/server/services/orders";
import { deleteZone, listZones, updateZoneFee } from "@/server/services/settings";
import { updateStore } from "@/server/services/stores";
import { checkout, product, seller, testDb } from "./support/db";

let database: Db;
let A: Awaited<ReturnType<typeof seller>>;
let B: Awaited<ReturnType<typeof seller>>;
let aProductId: string;
let aOrderId: string;
let aOrderPublicId: string;

beforeAll(async () => {
  database = await testDb();
  A = await seller(database, "alice");
  B = await seller(database, "bob");
  const p = await product(database, A.store.id, 25_000, 10);
  aProductId = p.id;
  const o = await placeOrder(database, A.store, checkout([{ productId: p.id, quantity: 1 }]));
  aOrderId = o.id;
  aOrderPublicId = o.publicId;
});

const input = {
  name: { en: "Hijacked" },
  description: {},
  price: 1,
  compareAtPrice: null,
  stock: 0,
  categoryId: null,
  isActive: true,
  imageUrls: [],
};

describe("tenant isolation: products", () => {
  it("B cannot read A's product", async () => {
    expect(await getProduct(database, B.store.id, aProductId)).toBeNull();
    expect((await listProducts(database, B.store.id)).map((p) => p.id)).not.toContain(aProductId);
  });

  it("B cannot update, toggle or delete A's product", async () => {
    await expect(updateProduct(database, B.store.id, aProductId, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setProductActive(database, B.store.id, aProductId, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteProduct(database, B.store.id, aProductId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const p = await database.query.products.findFirst({ where: eq(products.id, aProductId) });
    expect(p?.price).toBe(25_000);
    expect(p?.isActive).toBe(true);
  });

  it("B cannot attach A's category to B's product", async () => {
    const cat = await createCategory(database, A.store.id, { name: { en: "Dresses" }, sort: 0 });
    await expect(createProduct(database, B.store.id, { ...input, categoryId: cat.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("tenant isolation: categories & zones", () => {
  it("B cannot edit or delete A's categories", async () => {
    const cat = await createCategory(database, A.store.id, { name: { en: "Honey" }, sort: 0 });
    await expect(updateCategory(database, B.store.id, cat.id, { name: { en: "x" }, sort: 0 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteCategory(database, B.store.id, cat.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listCategories(database, B.store.id)).find((c) => c.id === cat.id)).toBeUndefined();
  });

  it("B cannot change or delete A's delivery zones", async () => {
    const zone = (await listZones(database, A.store.id))[0]!;
    await expect(updateZoneFee(database, B.store.id, zone.id, 0, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteZone(database, B.store.id, zone.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("tenant isolation: orders & customers", () => {
  it("B cannot list, read or move A's orders", async () => {
    expect(await listOrders(database, B.store.id)).toHaveLength(0);
    expect(await getOrder(database, B.store.id, aOrderId)).toBeNull();
    await expect(updateOrderStatus(database, B.store.id, aOrderId, "cancelled", B.user.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await getOrder(database, A.store.id, aOrderId))?.status).toBe("new");
  });

  it("the public order page requires the matching store", async () => {
    expect(await getOrderByPublicId(database, B.store.id, aOrderPublicId)).toBeNull();
    expect(await getOrderByPublicId(database, A.store.id, aOrderPublicId)).not.toBeNull();
  });

  it("B cannot see A's customers", async () => {
    expect(await listCustomers(database, B.store.id)).toHaveLength(0);
    expect(await listCustomers(database, A.store.id)).toHaveLength(1);
  });
});

describe("tenant isolation: storefront checkout", () => {
  it("a customer of B's store cannot buy A's product through B", async () => {
    await expect(placeOrder(database, B.store, checkout([{ productId: aProductId, quantity: 1 }]))).rejects.toMatchObject({
      message: "product_unavailable",
    });
    const q = await quoteCart(database, B.store.id, [{ productId: aProductId, quantity: 1 }], "erbil", "en");
    expect(q.lines[0]!.available).toBe(false);
    expect(q.total).toBe(0);
  });

  it("B cannot take A's slug", async () => {
    await expect(
      updateStore(database, B.store.id, {
        name: "B",
        slug: A.store.slug,
        defaultLocale: "ku",
        phone: null,
        whatsapp: null,
        instagram: null,
        city: null,
        tagline: {},
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
