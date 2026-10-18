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
