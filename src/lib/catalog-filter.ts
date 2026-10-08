import type { Locale, LocalizedText } from "@/lib/i18n";
import { pickText } from "@/lib/i18n";
import { percentOff } from "@/lib/product-page";

/**
 * Storefront grid filtering — pure, so the server page and tests share it.
 * Search matches every translation of the product name (a shopper may type Arabic on a Kurdish store),
 * after folding the letter variants Iraqi keyboards produce interchangeably.
 */
export const DEFAULT_PAGE_SIZE = 24;

/** Fold Arabic-script variants so ي/ی, ك/ک, ه/ە, أ/إ/آ/ا, ة/ه, ى/ی compare equal; strip tatweel, diacritics, ZWNJ. */
export function normalizeSearchText(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // harakat, superscript alef, Quranic marks
    .replace(/[\u0640\u200C\u200D\u200E\u200F]/g, "") // tatweel, ZWNJ/ZWJ, bidi marks
    .replace(/[يىۍێ]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ەةھہۀ]/g, "ه")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/\s+/g, " ")
    .trim();
}

export type FilterableProduct = { name: LocalizedText; categoryId: string | null; price?: number; compareAtPrice?: number | null };

export type CatalogFilter = {
  q?: string | null;
  c?: string | null;
  /** 1-based; cumulative ("show more") — page N returns the first N*pageSize matches. */
  page?: number | string | null;
  pageSize?: number;
  locale: Locale;
  /** "Offers" filter: only products on sale (compare-at above price). */
  offers?: boolean;
};

export type FilterResult<T> = { items: T[]; total: number; hasMore: boolean; page: number };

export function parsePage(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 1000);
}

export function filterCatalog<T extends FilterableProduct>(products: readonly T[], f: CatalogFilter): FilterResult<T> {
  const pageSize = f.pageSize && f.pageSize > 0 ? Math.floor(f.pageSize) : DEFAULT_PAGE_SIZE;
  const page = parsePage(f.page);
  const q = normalizeSearchText(f.q ?? "");
  const terms = q ? q.split(" ") : [];
  const matches = products.filter((p) => {
    if (f.c && p.categoryId !== f.c) return false;
    if (f.offers && !(p.price !== undefined && percentOff(p.price, p.compareAtPrice) !== null)) return false;
    if (!terms.length) return true;
    const hay = normalizeSearchText([pickText(p.name, f.locale), ...Object.values(p.name)].filter(Boolean).join(" "));
    return terms.every((t) => hay.includes(t));
  });
  const limit = page * pageSize;
  return { items: matches.slice(0, limit), total: matches.length, hasMore: matches.length > limit, page };
}
