import { and, asc, count, desc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { Db } from "../db";
import { categories, productImages, productOptionValues, productOptions, productVariants, products, stores } from "../db/schema";
import { AppError } from "../errors";
import { normalizePlan, productLimit, productsShown } from "@/lib/plans";
import type { LocalizedText } from "@/lib/i18n";
import type { ExportProduct } from "@/lib/products-csv";
import { LOW_STOCK_THRESHOLD, rankLowStock, type LowStockRow } from "@/lib/low-stock";
import type { ProductImageInput, ProductInput, ProductVariantsInput } from "@/lib/validation";

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

/** Every product of the store (active or hidden) shaped for the CSV export. Store-scoped; two cheap aggregate queries. */
export async function listProductsForExport(database: Db, storeId: string): Promise<ExportProduct[]> {
  const [list, cats, imgCounts, varCounts] = await Promise.all([
    database.query.products.findMany({ where: eq(products.storeId, storeId), orderBy: [asc(products.sort), desc(products.createdAt)] }),
    database.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.storeId, storeId)),
    database.select({ productId: productImages.productId, n: count() }).from(productImages).where(eq(productImages.storeId, storeId)).groupBy(productImages.productId),
    database.select({ productId: productVariants.productId, n: count() }).from(productVariants).where(eq(productVariants.storeId, storeId)).groupBy(productVariants.productId),
  ]);
  const catName = new Map(cats.map((c) => [c.id, (c.name as LocalizedText | null) ?? {}]));
  const imgs = new Map(imgCounts.map((r) => [r.productId, Number(r.n)]));
  const vars = new Map(varCounts.map((r) => [r.productId, Number(r.n)]));
  return list.map((p) => {
    const cn = p.categoryId ? catName.get(p.categoryId) : undefined;
    return {
      name: p.name,
      description: p.description,
      sku: p.sku,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stock: p.stock,
      isActive: p.isActive,
      badge: p.badge,
      categoryName: cn ? (cn.ku ?? cn.en ?? cn.ar ?? cn.kmr ?? null) : null,
      shortCode: p.shortCode,
      imageCount: imgs.get(p.id) ?? 0,
      variantCount: vars.get(p.id) ?? 0,
      createdAt: p.createdAt,
    };
  });
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

export async function createProduct(database: Db, storeId: string, input: ProductInput, variants?: ProductVariantsInput): Promise<Product> {
  await assertCategoryInStore(database, storeId, input.categoryId);
  await assertWithinProductLimit(database, storeId);
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
        badge: input.badge ?? null,
        isActive: input.isActive,
      })
      .returning();
    await replaceImages(tx as unknown as Db, storeId, p!.id, imagesFromInput(input));
    if (variants) await syncVariants(tx as unknown as Db, storeId, p!.id, variants);
    return p!;
  });
}

export async function updateProduct(database: Db, storeId: string, id: string, input: ProductInput, variants?: ProductVariantsInput): Promise<Product> {
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
        badge: input.badge ?? null,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning();
    if (!p) throw new AppError("NOT_FOUND");
    await replaceImages(tx as unknown as Db, storeId, id, imagesFromInput(input));
    if (variants) await syncVariants(tx as unknown as Db, storeId, id, variants);
    return p;
  });
}

// ---------------------------------------------------------------- variants
export type ProductVariantData = {
  options: { id: string; name: LocalizedText }[];
  values: { id: string; optionId: string; label: LocalizedText; swatch: string | null }[];
  variants: (typeof productVariants.$inferSelect)[];
};

/** Every option, value and variant (inactive ones too) of one product, for the seller's editor. */
export async function getProductVariants(database: Db, storeId: string, productId: string): Promise<ProductVariantData> {
  const [options, values, variants] = await Promise.all([
    database.query.productOptions.findMany({
      where: and(eq(productOptions.productId, productId), eq(productOptions.storeId, storeId)),
      orderBy: [asc(productOptions.sort), asc(productOptions.createdAt)],
    }),
    database.query.productOptionValues.findMany({
      where: and(eq(productOptionValues.productId, productId), eq(productOptionValues.storeId, storeId)),
      orderBy: asc(productOptionValues.sort),
    }),
    database.query.productVariants.findMany({
      where: and(eq(productVariants.productId, productId), eq(productVariants.storeId, storeId)),
      orderBy: asc(productVariants.sort),
    }),
  ]);
  return {
    options: options.map((o) => ({ id: o.id, name: o.name })),
    values: values.map((v) => ({ id: v.id, optionId: v.optionId, label: v.label, swatch: v.swatch })),
    variants,
  };
}

const isUniqueViolation = (e: unknown) => {
  for (let x: unknown = e, i = 0; x && typeof x === "object" && i < 4; x = (x as { cause?: unknown }).cause, i++) {
    if ((x as { code?: unknown }).code === "23505") return true;
  }
  return false;
};

/**
 * Make the product's options/values/variants match the editor. Rows are updated in place when their id still belongs
 * to this product (so carts, order lines and variant photos keep pointing at them) and the rest are replaced.
 * Variants are matched by their combination of values, not by the id the client sent.
 */
export async function syncVariants(database: Db, storeId: string, productId: string, input: ProductVariantsInput) {
  const cur = await getProductVariants(database, storeId, productId);
  const curOpt = new Set(cur.options.map((o) => o.id));
  const curVal = new Map(cur.values.map((v) => [v.id, v.optionId]));
  const keyToId = new Map<string, string>();
  const keptOpts = new Set<string>();
  const keptVals = new Set<string>();

  for (const [oi, o] of input.options.entries()) {
    let optionId = o.id && curOpt.has(o.id) && !keptOpts.has(o.id) ? o.id : null;
    if (optionId) {
      await database.update(productOptions).set({ name: o.name, sort: oi }).where(and(eq(productOptions.id, optionId), eq(productOptions.storeId, storeId)));
    } else {
      const [row] = await database.insert(productOptions).values({ productId, storeId, name: o.name, sort: oi }).returning({ id: productOptions.id });
      optionId = row!.id;
    }
    keptOpts.add(optionId);
    for (const [vi, v] of o.values.entries()) {
      const swatch = o.swatches ? (v.swatch ?? null) : null;
      let valueId = v.id && curVal.get(v.id) === optionId && !keptVals.has(v.id) ? v.id : null;
      if (valueId) {
        await database
          .update(productOptionValues)
          .set({ label: v.label, swatch, sort: vi })
          .where(and(eq(productOptionValues.id, valueId), eq(productOptionValues.storeId, storeId)));
      } else {
        const [row] = await database
          .insert(productOptionValues)
          .values({ optionId, productId, storeId, label: v.label, swatch, sort: vi })
          .returning({ id: productOptionValues.id });
        valueId = row!.id;
      }
      keptVals.add(valueId);
      keyToId.set(v.key, valueId);
    }
  }

  const goneOpts = cur.options.map((o) => o.id).filter((id) => !keptOpts.has(id));
  if (goneOpts.length) await database.delete(productOptions).where(and(eq(productOptions.storeId, storeId), inArray(productOptions.id, goneOpts)));
  const goneVals = cur.values.map((v) => v.id).filter((id) => !keptVals.has(id) && !goneOpts.includes(curVal.get(id)!));
  if (goneVals.length) await database.delete(productOptionValues).where(and(eq(productOptionValues.storeId, storeId), inArray(productOptionValues.id, goneVals)));

  // Variants: same set of value ids → same row. Clear SKUs first so a SKU can move between rows without a clash.
  const setKey = (ids: string[]) => [...ids].sort().join("|");
  const curBySet = new Map(cur.variants.map((v) => [setKey(v.optionValueIds), v]));
  const curById = new Map(cur.variants.map((v) => [v.id, v]));
  const keptVariants = new Set<string>();
  const planned = input.variants.map((v, i) => {
    const ids = v.keys.map((k) => keyToId.get(k)!);
    const sent = v.id ? curById.get(v.id) : undefined;
    const match = curBySet.get(setKey(ids)) ?? (sent && !input.variants.some((w) => w !== v && w.id === sent.id) ? sent : undefined);
    const existing = match && !keptVariants.has(match.id) ? match : undefined;
    if (existing) keptVariants.add(existing.id);
    return { v, i, ids, existing };
  });
  const goneVariants = cur.variants.map((v) => v.id).filter((id) => !keptVariants.has(id));
  if (goneVariants.length) await database.delete(productVariants).where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, goneVariants)));
  if (keptVariants.size)
    await database.update(productVariants).set({ sku: null }).where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, [...keptVariants])));
  try {
    for (const { v, i, ids, existing } of planned) {
      const data = {
        optionValueIds: ids,
        price: v.price,
        compareAtPrice: v.compareAtPrice ?? null,
        stock: v.stock,
        sku: v.sku,
        isActive: v.isActive,
        sort: i,
      };
      if (existing) {
        await database.update(productVariants).set({ ...data, updatedAt: new Date() }).where(and(eq(productVariants.id, existing.id), eq(productVariants.storeId, storeId)));
      } else {
        await database.insert(productVariants).values({ productId, storeId, ...data });
      }
    }
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("VALIDATION", "sku_taken");
    throw e;
  }
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

/**
 * Product cap per plan (src/lib/plans.ts PRODUCT_CAP: 10 / 100 / hidden 1000 / hidden 10000).
 * Throws a VALIDATION AppError with code message "plan_limit_products".
 */
export async function assertWithinProductLimit(database: Db, storeId: string) {
  const usage = await getProductUsage(database, storeId);
  if (usage.used >= usage.cap) throw new AppError("VALIDATION", "plan_limit_products");
}

/** Products used vs the plan cap. `shown` is null for "Unlimited" plans (their cap is a hidden safety net). */
export async function getProductUsage(database: Db, storeId: string) {
  const [st] = await database.select({ plan: stores.plan }).from(stores).where(eq(stores.id, storeId));
  const plan = normalizePlan(st?.plan);
  const [c] = await database.select({ n: count() }).from(products).where(eq(products.storeId, storeId));
  return { plan, used: Number(c?.n ?? 0), cap: productLimit(plan), shown: productsShown(plan) };
}

/**
 * Visible products (or their variants) with tracked stock at or below the low-stock threshold, fewest units first.
 * A product that has variants is judged by its variants only; its own stock column is unused once variants exist.
 * Store-scoped; two small indexed reads.
 */
export async function listLowStock(database: Db, storeId: string, limit = 6): Promise<{ rows: LowStockRow[]; total: number }> {
  const [simple, vars] = await Promise.all([
    database
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.isActive, true), isNotNull(products.stock), lte(products.stock, LOW_STOCK_THRESHOLD))),
    database
      .select({ id: productVariants.id, productId: productVariants.productId, optionValueIds: productVariants.optionValueIds, stock: productVariants.stock, name: products.name })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.storeId, storeId), eq(productVariants.isActive, true), eq(products.isActive, true), isNotNull(productVariants.stock), lte(productVariants.stock, LOW_STOCK_THRESHOLD))),
  ]);
  const hasVariants = new Set(
    (await database.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.storeId, storeId))).map((r) => r.productId),
  );
  const valueIds = [...new Set(vars.flatMap((v) => v.optionValueIds))];
  const values = valueIds.length
    ? await database.select({ id: productOptionValues.id, label: productOptionValues.label }).from(productOptionValues).where(and(eq(productOptionValues.storeId, storeId), inArray(productOptionValues.id, valueIds)))
    : [];
  const label = new Map(values.map((v) => [v.id, v.label]));
  const all: LowStockRow[] = [
    ...simple.filter((p) => !hasVariants.has(p.id)).map((p) => ({ productId: p.id, name: p.name as LowStockRow["name"], variantLabels: [], stock: p.stock ?? 0 })),
    ...vars.map((v) => ({
      productId: v.productId,
      name: v.name as LowStockRow["name"],
      variantLabels: v.optionValueIds.map((id) => label.get(id)).filter((l): l is LocalizedText => !!l),
      stock: v.stock ?? 0,
    })),
  ];
  return { rows: rankLowStock(all, limit), total: all.length };
}
