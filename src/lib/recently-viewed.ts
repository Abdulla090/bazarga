/** Local "recently viewed" list per store (browser only, no server, no cost). Pure helpers so they are unit-testable. */
export type RecentItem = { id: string; name: string; img: string | null; price: string };
export const RECENT_MAX = 8;
export const recentKey = (slug: string) => `bz_rv_${slug}`;

export function pushRecent(list: RecentItem[], item: RecentItem, max = RECENT_MAX): RecentItem[] {
  return [item, ...list.filter((x) => x.id !== item.id)].slice(0, max);
}

export function parseRecent(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is RecentItem => !!x && typeof x.id === "string" && typeof x.name === "string" && typeof x.price === "string" && (x.img === null || typeof x.img === "string"))
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}
