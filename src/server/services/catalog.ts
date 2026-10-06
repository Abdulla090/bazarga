import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { categories, productImages, products } from "../db/schema";
import { AppError } from "../errors";
import type { LocalizedText } from "@/lib/i18n";
import type { ProductInput } from "@/lib/validation";

export type Product = typeof products.$inferSelect;
export type ProductWithImages = Product & { images: { id: string; url: string; sort: number }[] };

// Every function takes `storeId` from the authenticated session and scopes every query by it.

// ---------------------------------------------------------------- categories
export async function listCategories(database: Db, storeId: string) {
  return database.query.categories.findMany({
    where: eq(categories.storeId, storeId),
    orderBy: [asc(categories.sort), asc(categories.createdAt)],
  });
}

export async function createCategory(database: Db, storeId: string, input: { name: LocalizedText; sort: number }) {
  const [c] = await database.insert(categories).values({ storeId, name: input.name, sort: input.sort }).returning();
  return c!;
}

export async function updateCategory(
  database: Db,
  storeId: string,
  id: string,
  input: { name: LocalizedText; sort: number },
) {
  const [c] = await database
    .update(categories)
    .set({ name: input.name, sort: input.sort })
    .where(and(eq(categories.id, id), eq(categories.storeId, storeId)))
    .returning();
  if (!c) throw new AppError("NOT_FOUND");
  return c;
}

export async function deleteCategory(database: Db, storeId: string, id: string) {
  const r = await database
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.storeId, storeId)))
    .returning({ id: categories.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}

async function assertCategoryInStore(database: Db, storeId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const c = await database.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.storeId, storeId)),
    columns: { id: true },
  });
  if (!c) throw new AppError("NOT_FOUND", "category_not_found");
}

// ---------------------------------------------------------------- products
async function attachImages(database: Db, list: Product[]): Promise<ProductWithImages[]> {
  if (!list.length) return [];
  const imgs = await database
    .select({ id: productImages.id, url: productImages.url, sort: productImages.sort, productId: productImages.productId })
    .from(productImages)
    .where(inArray(productImages.productId, list.map((p) => p.id)))
    .orderBy(asc(productImages.sort));
  return list.map((p) => ({ ...p, images: imgs.filter((i) => i.productId === p.id) }));
}

export async function listProducts(database: Db, storeId: string, opts: { activeOnly?: boolean } = {}) {
  const list = await database.query.products.findMany({
    where: opts.activeOnly ? and(eq(products.storeId, storeId), eq(products.isActive, true)) : eq(products.storeId, storeId),
    orderBy: [asc(products.sort), desc(products.createdAt)],
  });
  return attachImages(database, list);
}

export async function getProduct(database: Db, storeId: string, id: string): Promise<ProductWithImages | null> {
  const p = await database.query.products.findFirst({ where: and(eq(products.id, id), eq(products.storeId, storeId)) });
  if (!p) return null;
  const [withImgs] = await attachImages(database, [p]);
  return withImgs ?? null;
}

async function replaceImages(database: Db, storeId: string, productId: string, urls: string[]) {
  await database.delete(productImages).where(and(eq(productImages.productId, productId), eq(productImages.storeId, storeId)));
  if (urls.length) {
    await database
      .insert(productImages)
      .values(urls.map((url, i) => ({ productId, storeId, url, sort: i })));
  }
}

export async function createProduct(database: Db, storeId: string, input: ProductInput): Promise<Product> {
  await assertCategoryInStore(database, storeId, input.categoryId);
  return database.transaction(async (tx) => {
    const [p] = await tx
      .insert(products)
      .values({
        storeId,
        name: input.name,
        description: input.description,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        stock: input.stock ?? null,
        categoryId: input.categoryId ?? null,
        isActive: input.isActive,
      })
      .returning();
    await replaceImages(tx as unknown as Db, storeId, p!.id, input.imageUrls);
    return p!;
  });
}

export async function updateProduct(database: Db, storeId: string, id: string, input: ProductInput): Promise<Product> {
  await assertCategoryInStore(database, storeId, input.categoryId);
  return database.transaction(async (tx) => {
    const [p] = await tx
      .update(products)
      .set({
        name: input.name,
        description: input.description,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        stock: input.stock ?? null,
        categoryId: input.categoryId ?? null,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning();
    if (!p) throw new AppError("NOT_FOUND");
    await replaceImages(tx as unknown as Db, storeId, id, input.imageUrls);
    return p;
  });
}

export async function setProductActive(database: Db, storeId: string, id: string, isActive: boolean) {
  const r = await database
    .update(products)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.storeId, storeId)))
    .returning({ id: products.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}

export async function deleteProduct(database: Db, storeId: string, id: string) {
  const r = await database
    .delete(products)
    .where(and(eq(products.id, id), eq(products.storeId, storeId)))
    .returning({ id: products.id });
  if (!r.length) throw new AppError("NOT_FOUND");
}
