/**
 * Theme Studio preview marker. The editor loads its iframe as /s/<slug>?pv=1; the proxy turns that into this request
 * header (client-sent copies are stripped) so the storefront honours the editor's draft-design cookie for that load and
 * for the iframe's own soft navigations. `Sec-Fetch-Dest: iframe` alone is not enough: older Safari and some headless
 * Chromium builds never send it, and client-side (RSC) requests inside the iframe are `empty`.
 */
export const PREVIEW_HEADER = "x-bz-preview";
export const PREVIEW_PARAM = "pv";

export function isPreviewRequest(pathname: string, search: URLSearchParams): boolean {
  return pathname.startsWith("/s/") && search.get(PREVIEW_PARAM) === "1";
}

/**
 * Theme gallery thumbnails: /s/<slug>?pv=1&pvt=<flagship id> renders that whole flagship theme (colours, type, layout)
 * for the preview load only; pvt=t.<token> renders an AI Website Designer option (a whole theme without any text). The proxy forwards the id as this header (client copies stripped); the storefront checks
 * it against the flagship list. Like the design cookie it only picks a presentation of public data.
 */
export const PREVIEW_THEME_HEADER = "x-bz-preview-theme";
export const PREVIEW_THEME_PARAM = "pvt";

export function previewThemeParam(pathname: string, search: URLSearchParams): string | null {
  if (!isPreviewRequest(pathname, search)) return null;
  const v = search.get(PREVIEW_THEME_PARAM);
  // A flagship id, or an AI option's text-free theme token (src/lib/theme-studio/preview-token.ts).
  return v && (/^[a-z]{2,16}$/.test(v) || /^t\.[A-Za-z0-9_-]{16,2048}$/.test(v)) ? v : null;
}
