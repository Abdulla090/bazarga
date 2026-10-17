/** Local wishlist per store (browser only, no server, no cost). Pure helpers so they are unit-testable. */
import type { RecentItem } from "./recently-viewed";
export type WishItem = RecentItem;
export const WISH_MAX = 24;
export const wishKey = (slug: string) => `bz_wl_${slug}`;
export function parseWish(raw: string | null): WishItem[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is WishItem => !!x && typeof x.id === "string" && typeof x.name === "string" && typeof x.price === "string" && (x.img === null || typeof x.img === "string"))
      .slice(0, WISH_MAX);
  } catch {
    return [];
  }
}
export const hasWish = (list: WishItem[], id: string) => list.some((x) => x.id === id);
export function toggleWish(list: WishItem[], item: WishItem, max = WISH_MAX): WishItem[] {
  return hasWish(list, item.id) ? list.filter((x) => x.id !== item.id) : [item, ...list].slice(0, max);
}
