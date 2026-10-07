/**
 * Pure helpers behind the storefront product page (/s/[slug]/p/[productId]): sale badge, stock status, related
 * products, safe description paragraphs, specs rows and the schema.org Product JSON-LD. No React, no Node APIs.
 */
import { pickText, type Locale, type LocalizedText } from "./i18n";

/** Whole-percent discount when a compare-at price is above the price, else null ("−17%" badge). */
export function percentOff(price: number, compareAt: number | null | undefined): number | null {
  if (compareAt == null || !(compareAt > price) || compareAt <= 0) return null;
  const pct = Math.round((1 - price / compareAt) * 100);
  return pct >= 1 ? pct : null;
}

export type StockStatus = { kind: "in" } | { kind: "low"; count: number } | { kind: "out" } | { kind: "untracked" };

/** Low-stock threshold shared with the catalog card ("Only N left"). */
export const LOW_STOCK = 5;

/** `stock` null = not tracked (always available). */
export function stockStatus(stock: number | null, soldOut = false): StockStatus {
  if (soldOut || (stock !== null && stock <= 0)) return { kind: "out" };
  if (stock === null) return { kind: "untracked" };
  if (stock <= LOW_STOCK) return { kind: "low", count: stock };
  return { kind: "in" };
}

/**
 * "More from this store": same category first, then the rest of the catalog in its own order, skipping the current
 * product and anything sold out; at most `limit` (8).
 */
export function relatedProducts<T extends { id: string; categoryId: string | null; soldOut: boolean }>(
  catalog: readonly T[],
  current: { id: string; categoryId: string | null },
  limit = 8,
): T[] {
  const pool = catalog.filter((p) => p.id !== current.id && !p.soldOut);
  const same = current.categoryId ? pool.filter((p) => p.categoryId === current.categoryId) : [];
  const rest = pool.filter((p) => !same.includes(p));
  return [...same, ...rest].slice(0, Math.max(0, limit));
}

/**
 * Seller description → paragraphs (split on blank lines), each a list of lines (single line breaks kept).
 * Rendered as text nodes, so markup in the description is shown literally, never parsed.
 */
export function descriptionParagraphs(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((p) =>
      p
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);
}

export type SpecLike = { label: LocalizedText; value: LocalizedText };

/** Specs in the shopper's language (with the usual fallbacks); rows that end up blank are dropped. */
export function specRows(specs: readonly SpecLike[] | null | undefined, locale: Locale): { label: string; value: string }[] {
  return (specs ?? [])
    .map((s) => ({ label: pickText(s.label, locale), value: pickText(s.value, locale) }))
    .filter((r) => r.label && r.value);
}

export type JsonLdInput = {
  url: string;
  name: string;
  description: string;
  images: string[];
  sku: string | null;
  storeName: string;
  /** Lowest price for products with variants. */
  price: number;
  /** Highest variant price (AggregateOffer when above `price`). */
  priceMax?: number;
  soldOut: boolean;
};

/** schema.org Product + Offer (IQD) for rich results and link previews. */
export function productJsonLd(i: JsonLdInput): Record<string, unknown> {
  const availability = i.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
  const offers =
    i.priceMax !== undefined && i.priceMax > i.price
      ? { "@type": "AggregateOffer", priceCurrency: "IQD", lowPrice: i.price, highPrice: i.priceMax, availability, url: i.url }
      : {
          "@type": "Offer",
          priceCurrency: "IQD",
          price: i.price,
          availability,
          itemCondition: "https://schema.org/NewCondition",
          url: i.url,
          seller: { "@type": "Organization", name: i.storeName },
        };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: i.name,
    ...(i.description ? { description: i.description.slice(0, 5000) } : {}),
    ...(i.images.length ? { image: i.images } : {}),
    ...(i.sku ? { sku: i.sku } : {}),
    brand: { "@type": "Brand", name: i.storeName },
    url: i.url,
    offers,
  };
}

/** JSON for an inline <script type="application/ld+json">: `<`, `>`, `&` and line separators escaped so seller text can't close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Absolute URL for an image path ("/uploads/x.webp" → "https://host/uploads/x.webp"). */
export function absoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}
