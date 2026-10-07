import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { categories, productImages, products } from "../db/schema";
import { AppError } from "../errors";
import type { LocalizedText } from "@/lib/i18n";
import type { ProductImageInput, ProductInput } from "@/lib/validation";

export type Product = typeof products.$inferSelect;
type ProductImageRow = typeof productImages.$inferSelect;
export type ProductImage = Pick<
  ProductImageRow,
  "id" | "url" | "sort" | "width" | "height" | "placeholder" | "dominantColor" | "renditions" | "alt"
>;
export type ProductWithImages = Product & { images: ProductImage[] };

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
    .select({
      id: productImages.id,
      url: productImages.url,
      sort: productImages.sort,
      width: productImages.width,
      height: productImages.height,
      placeholder: productImages.placeholder,
      dominantColor: productImages.dominantColor,
      renditions: productImages.renditions,
      alt: productImages.alt,
      productId: productImages.productId,
    })
    .from(productImages)
    .where(inArray(productImages.productId, list.map((p) => p.id)))
    .orderBy(asc(productImages.sort));
  return list.map((p) => ({
    ...p,
    images: imgs.filter((i) => i.productId === p.id).map(({ productId: _productId, ...img }) => img),
  }));
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

/** Gallery from the form: pipeline metadata when present, else bare URLs (seed images, legacy clients). */
export function imagesFromInput(input: Pick<ProductInput, "images" | "imageUrls">): ProductImageInput[] {
  return input.images ?? input.imageUrls.map((url) => ({ url, renditions: [] }));
}

async function replaceImages(database: Db, storeId: string, productId: string, images: ProductImageInput[]) {
  await database.delete(productImages).where(and(eq(productImages.productId, productId), eq(productImages.storeId, storeId)));
  if (images.length) {
    await database.insert(productImages).values(
      images.map((img, i) => {
        const hasDims = img.width != null && img.height != null;
        return {
          productId,
          storeId,
          url: img.url,
          storageKey: img.renditions.find((r) => r.url === img.url)?.key ?? null,
          sort: i,
          width: hasDims ? img.width! : null,
          height: hasDims ? img.height! : null,
          placeholder: img.placeholder ?? null,
          dominantColor: img.dominantColor ?? null,
          renditions: img.renditions,
        };
      }),
    );
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
        sku: input.sku ?? null,
        specs: input.specs ?? [],
        categoryId: input.categoryId ?? null,
        isActive: input.isActive,
      })
      .returning();
    await replaceImages(tx as unknown as Db, storeId, p!.id, imagesFromInput(input));
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
        sku: input.sku ?? null,
        specs: input.specs ?? [],
        categoryId: input.categoryId ?? null,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning();
    if (!p) throw new AppError("NOT_FOUND");
    await replaceImages(tx as unknown as Db, storeId, id, imagesFromInput(input));
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
