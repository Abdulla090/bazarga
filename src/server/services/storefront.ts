import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import {
  categories,
  deliveryAreas,
  deliveryZones,
  productImages,
  productOptionValues,
  productOptions,
  productVariants,
  products,
  storePaymentMethods,
  stores,
} from "../db/schema";
import type { LocalizedText } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/order-status";
import type { ProductImage } from "./catalog";

/**
 * Read models for the public storefront. Each loader is a handful of indexed queries and returns plain,
 * serialisable data, so src/server/cache/storefront.ts can wrap it in `"use cache"` (one entry per store /
 * product, invalidated by tag when the seller saves). Nothing here reads cookies or headers.
 */

// ---------------------------------------------------------------- store
export type StorefrontStore = {
  id: string;
  slug: string;
  name: string;
  tagline: LocalizedText;
  logoUrl: string | null;
  defaultLocale: "ku" | "ar" | "en" | "kmr";
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  themePreset: "bazaar" | "mountain" | "night";
  accentColor: string | null;
  coverImageUrl: string | null;
  coverImagePlaceholder: string | null;
  about: LocalizedText;
  returnPolicy: LocalizedText;
  freeDeliveryThreshold: number | null;
};

export async function loadStorefrontStore(database: Db, slug: string): Promise<StorefrontStore | null> {
  const s = await database.query.stores.findFirst({
    where: and(eq(stores.slug, slug), eq(stores.isActive, true)),
    columns: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      logoUrl: true,
      defaultLocale: true,
      phone: true,
      whatsapp: true,
      instagram: true,
      city: true,
      themePreset: true,
      accentColor: true,
      coverImageUrl: true,
      coverImagePlaceholder: true,
      about: true,
      returnPolicy: true,
      freeDeliveryThreshold: true,
    },
  });
  return s ?? null;
}

// ---------------------------------------------------------------- delivery + payments
export type StorefrontArea = { id: string; name: LocalizedText; fee: number };
export type StorefrontZone = {
  key: string;
  governorateKey: string | null;
  name: LocalizedText;
  fee: number;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  areas: StorefrontArea[];
};
export type StorefrontSettings = { zones: StorefrontZone[]; payments: PaymentMethod[] };

/** Active delivery zones (with their areas, fee resolved) and the payment methods the seller switched on. */
export async function loadStorefrontSettings(database: Db, storeId: string): Promise<StorefrontSettings> {
  const [zones, areas, methods] = await Promise.all([
    database.query.deliveryZones.findMany({
      where: and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.isActive, true)),
      orderBy: [asc(deliveryZones.sort), asc(deliveryZones.cityKey)],
    }),
    database.query.deliveryAreas.findMany({
      where: and(eq(deliveryAreas.storeId, storeId), eq(deliveryAreas.isActive, true)),
      orderBy: [asc(deliveryAreas.sort), asc(deliveryAreas.createdAt)],
    }),
    database.query.storePaymentMethods.findMany({
      where: and(eq(storePaymentMethods.storeId, storeId), eq(storePaymentMethods.enabled, true)),
    }),
  ]);
  return {
    zones: zones.map((z) => ({
      key: z.cityKey,
      governorateKey: z.governorateKey,
      name: z.name,
      fee: z.fee,
      etaMinDays: z.etaMinDays,
      etaMaxDays: z.etaMaxDays,
      areas: areas.filter((a) => a.zoneId === z.id).map((a) => ({ id: a.id, name: a.name, fee: a.fee ?? z.fee })),
    })),
    payments: methods.map((m) => m.method),
  };
}

// ---------------------------------------------------------------- catalog (grid)
export type CatalogProduct = {
  id: string;
  name: LocalizedText;
  categoryId: string | null;
  /** Lowest purchasable price (variant prices included). */
  price: number;
  /** Highest variant price; equals `price` for simple products. */
  priceMax: number;
  compareAtPrice: number | null;
  /** Units left when tracked and low (≤ 5), else null. */
  lowStock: number | null;
  soldOut: boolean;
  hasVariants: boolean;
  image: ProductImage | null;
};
export type CatalogCategory = { id: string; name: LocalizedText };
export type Catalog = { products: CatalogProduct[]; categories: CatalogCategory[] };

/** Upper bound on what one store's grid holds in memory; pages of 24 are cut from it per request. */
export const CATALOG_LIMIT = 1000;

export async function loadCatalog(database: Db, storeId: string): Promise<Catalog> {
  const list = await database.query.products.findMany({
    where: and(eq(products.storeId, storeId), eq(products.isActive, true)),
    columns: { id: true, name: true, categoryId: true, price: true, compareAtPrice: true, stock: true },
    orderBy: [asc(products.sort), desc(products.createdAt)],
    limit: CATALOG_LIMIT,
  });
  const ids = list.map((p) => p.id);
  const [covers, cats, variants] = await Promise.all([
    ids.length
      ? database
          .select({
            productId: productImages.productId,
            id: productImages.id,
            url: productImages.url,
            sort: productImages.sort,
            width: productImages.width,
            height: productImages.height,
            placeholder: productImages.placeholder,
            dominantColor: productImages.dominantColor,
            renditions: productImages.renditions,
            alt: productImages.alt,
          })
          .from(productImages)
          .where(and(inArray(productImages.productId, ids), eq(productImages.sort, 0)))
      : Promise.resolve([]),
    database.query.categories.findMany({
      where: eq(categories.storeId, storeId),
      columns: { id: true, name: true },
      orderBy: [asc(categories.sort), asc(categories.createdAt)],
    }),
    ids.length
      ? database.query.productVariants.findMany({
          where: and(inArray(productVariants.productId, ids), eq(productVariants.storeId, storeId), eq(productVariants.isActive, true)),
          columns: { productId: true, price: true, stock: true },
        })
      : Promise.resolve([]),
  ]);
  const coverOf = new Map(covers.map(({ productId, ...img }) => [productId, img]));
  const products_ = list.map((p): CatalogProduct => {
    const vs = variants.filter((v) => v.productId === p.id);
    const image = coverOf.get(p.id) ?? null;
    if (!vs.length) {
      return {
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        price: p.price,
        priceMax: p.price,
        compareAtPrice: p.compareAtPrice,
        lowStock: p.stock !== null && p.stock > 0 && p.stock <= 5 ? p.stock : null,
        soldOut: p.stock !== null && p.stock <= 0,
        hasVariants: false,
        image,
      };
    }
    const inStock = vs.filter((v) => v.stock === null || v.stock > 0);
    const prices = (inStock.length ? inStock : vs).map((v) => v.price ?? p.price);
    const tracked = inStock.every((v) => v.stock !== null);
    const units = inStock.reduce((a, v) => a + (v.stock ?? 0), 0);
    return {
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      price: Math.min(...prices),
      priceMax: Math.max(...prices),
      compareAtPrice: p.compareAtPrice,
      lowStock: tracked && units > 0 && units <= 5 ? units : null,
      soldOut: inStock.length === 0,
      hasVariants: true,
      image,
    };
  });
  const used = new Set(products_.map((p) => p.categoryId));
  return { products: products_, categories: cats.filter((c) => used.has(c.id)) };
}

// ---------------------------------------------------------------- product detail
export type DetailOption = {
  id: string;
  name: LocalizedText;
  values: { id: string; label: LocalizedText; swatch: string | null }[];
};
export type DetailVariant = {
  id: string;
  /** One option value id per option, in option order. */
  optionValueIds: string[];
  sku: string | null;
  /** Effective price (variant override or the product price). */
  price: number;
  compareAtPrice: number | null;
  /** null = not tracked. */
  stock: number | null;
  imageId: string | null;
};
export type ProductDetail = {
  id: string;
  storeId: string;
  name: LocalizedText;
  description: LocalizedText;
  categoryId: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number | null;
  images: ProductImage[];
  options: DetailOption[];
  variants: DetailVariant[];
};

export async function loadProductDetail(database: Db, storeId: string, productId: string): Promise<ProductDetail | null> {
  const p = await database.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.storeId, storeId), eq(products.isActive, true)),
    columns: {
      id: true,
      storeId: true,
      name: true,
      description: true,
      categoryId: true,
      price: true,
      compareAtPrice: true,
      stock: true,
    },
  });
  if (!p) return null;
  const [images, options, values, variants] = await Promise.all([
    database
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
      })
      .from(productImages)
      .where(and(eq(productImages.productId, p.id), eq(productImages.storeId, storeId)))
      .orderBy(asc(productImages.sort)),
    database.query.productOptions.findMany({
      where: and(eq(productOptions.productId, p.id), eq(productOptions.storeId, storeId)),
      orderBy: [asc(productOptions.sort), asc(productOptions.createdAt)],
    }),
    database.query.productOptionValues.findMany({
      where: and(eq(productOptionValues.productId, p.id), eq(productOptionValues.storeId, storeId)),
      orderBy: asc(productOptionValues.sort),
    }),
    database.query.productVariants.findMany({
      where: and(eq(productVariants.productId, p.id), eq(productVariants.storeId, storeId), eq(productVariants.isActive, true)),
      orderBy: asc(productVariants.sort),
    }),
  ]);
  return {
    ...p,
    images,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      values: values.filter((v) => v.optionId === o.id).map((v) => ({ id: v.id, label: v.label, swatch: v.swatch })),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      optionValueIds: v.optionValueIds,
      sku: v.sku,
      price: v.price ?? p.price,
      compareAtPrice: v.compareAtPrice ?? (v.price === null ? p.compareAtPrice : null),
      stock: v.stock,
      imageId: v.imageId,
    })),
  };
}
