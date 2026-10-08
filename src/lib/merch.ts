/**
 * Storefront merchandising — pure helpers shared by the server pages and tests (no React, no DB):
 * sale prices ("−17%"), best sellers ranked from real orders, the seller's manual badge, and the public
 * discount-code offer banner.
 */
import { percentOff } from "./product-page";

export { percentOff };

// ---------------------------------------------------------------- sale
export type Priced = { price: number; compareAtPrice: number | null };

/** On sale = a compare-at ("old") price above the price, worth at least a whole percent. */
export function isOnSale(p: Priced): boolean {
  return percentOff(p.price, p.compareAtPrice) !== null;
}

/** Amount saved per unit (compare-at − price) when on sale, else 0. */
export function savedAmount(p: Priced): number {
  return isOnSale(p) ? p.compareAtPrice! - p.price : 0;
}

/** Discounted products, biggest % off first (ties keep catalog order). */
export function saleProducts<T extends Priced & { soldOut?: boolean }>(list: readonly T[]): T[] {
  return list
    .map((p, i) => ({ p, i, pct: percentOff(p.price, p.compareAtPrice) }))
    .filter((x) => x.pct !== null && !x.p.soldOut)
    .sort((a, b) => b.pct! - a.pct! || a.i - b.i)
    .map((x) => x.p);
}

// ---------------------------------------------------------------- manual badge
export const PRODUCT_BADGES = ["new", "featured"] as const;
export type ProductBadge = (typeof PRODUCT_BADGES)[number];
export function isProductBadge(v: unknown): v is ProductBadge {
  return typeof v === "string" && (PRODUCT_BADGES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------- best sellers
/** Window, in days, that best sellers are counted over (non-cancelled/refused/returned orders). */
export const BEST_SELLER_DAYS = 30;
/** At most this many products in the storefront "Best sellers" strip. */
export const BEST_SELLER_LIMIT = 8;
/** The "Best seller" badge goes to the top N … */
export const BEST_SELLER_BADGE_TOP = 3;
/** … that were bought in at least this many separate orders (one order never makes a "best seller"). */
export const BEST_SELLER_BADGE_MIN_ORDERS = 2;
/** The strip is hidden until at least this many products have sold. */
export const BEST_SELLER_SECTION_MIN = 2;

export type SalesRow = { productId: string; orders: number; units: number };
export type BestSellers = {
  /** Ranked product ids (most orders, then most units, then id for a stable order); at most `limit`. */
  ranked: string[];
  /** Ids that earn the "Best seller" badge. */
  badged: string[];
};

/**
 * Rank products by how many separate orders bought them (then units). Only ids in `eligible` (the store's active
 * catalog) count; rows with no orders are ignored.
 */
export function rankBestSellers(
  rows: readonly SalesRow[],
  eligible: ReadonlySet<string> | null = null,
  opts: { limit?: number; badgeTop?: number; badgeMinOrders?: number } = {},
): BestSellers {
  const limit = opts.limit ?? BEST_SELLER_LIMIT;
  const top = opts.badgeTop ?? BEST_SELLER_BADGE_TOP;
  const minOrders = opts.badgeMinOrders ?? BEST_SELLER_BADGE_MIN_ORDERS;
  const merged = new Map<string, SalesRow>();
  for (const r of rows) {
    if (!r.productId || !(Number(r.orders) > 0) || (eligible && !eligible.has(r.productId))) continue;
    const prev = merged.get(r.productId);
    merged.set(r.productId, {
      productId: r.productId,
      orders: (prev?.orders ?? 0) + Number(r.orders),
      units: (prev?.units ?? 0) + Number(r.units),
    });
  }
  const sorted = [...merged.values()].sort(
    (a, b) => b.orders - a.orders || b.units - a.units || (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
  );
  return {
    ranked: sorted.slice(0, Math.max(0, limit)).map((r) => r.productId),
    badged: sorted
      .slice(0, Math.max(0, top))
      .filter((r) => r.orders >= minOrders)
      .map((r) => r.productId),
  };
}

/** Products for the "Best sellers" strip, in rank order, skipping sold-out ones; [] (strip hidden) below the minimum. */
export function bestSellerStrip<T extends { id: string; soldOut: boolean }>(
  catalog: readonly T[],
  ranked: readonly string[],
  min = BEST_SELLER_SECTION_MIN,
): T[] {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const list = ranked.map((id) => byId.get(id)).filter((p): p is T => !!p && !p.soldOut);
  return list.length >= min ? list : [];
}

// ---------------------------------------------------------------- offer banner (public discount code)
export type BannerCode = {
  code: string;
  type: "percentage" | "fixed" | "free_delivery";
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  showOnStorefront: boolean;
  /** ISO timestamps (cache-serialisable); null = open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};
export type BannerOffer = Pick<BannerCode, "code" | "type" | "value" | "minSubtotal" | "endsAt">;

/** Is the code usable right now and meant to be advertised? (Same rules checkout applies, minus the cart minimum.) */
export function isAdvertisable(c: BannerCode, now = new Date()): boolean {
  if (!c.isActive || !c.showOnStorefront) return false;
  if (c.startsAt && now < new Date(c.startsAt)) return false;
  if (c.endsAt && now >= new Date(c.endsAt)) return false;
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return false;
  if (c.type === "percentage" && !(c.value >= 1 && c.value <= 100)) return false;
  if (c.type === "fixed" && !(c.value > 0)) return false;
  return true;
}

/** The one code the banner advertises: the newest advertisable one; null = no banner. */
export function pickBannerOffer(codes: readonly BannerCode[], now = new Date()): BannerOffer | null {
  const best = codes
    .filter((c) => isAdvertisable(c, now))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.code.localeCompare(b.code)))[0];
  return best ? { code: best.code, type: best.type, value: best.value, minSubtotal: best.minSubtotal, endsAt: best.endsAt } : null;
}
