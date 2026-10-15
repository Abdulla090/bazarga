import { z } from "zod";

/** Short product links: `/p/<code>` → the product page, keeping every query param (notably `?src=tiktok`). */
export const shortCodeSchema = z.string().regex(/^[a-z0-9]{6,12}$/);

export const shortLinkPath = (code: string) => `/p/${code}`;

/** Absolute short link for a product (`base` = APP_URL). `src` is an already-validated platform key. */
export function shortLinkUrl(base: string, code: string, src?: string): string {
  const url = `${base.replace(/\/$/, "")}${shortLinkPath(code)}`;
  return src ? `${url}?src=${encodeURIComponent(src)}` : url;
}

/** Where a short code lands: the canonical product page path plus the original query string. */
export function shortLinkTarget(slug: string, productId: string, search: string): string {
  const q = search.startsWith("?") ? search : search ? `?${search}` : "";
  return `/s/${slug}/p/${productId}${q === "?" ? "" : q}`;
}
