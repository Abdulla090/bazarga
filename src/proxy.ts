import { NextResponse, type NextRequest } from "next/server";
import { NONCE_HEADER, buildCsp, generateNonce } from "@/server/csp";

const STORE_SLUG_HEADER = "x-mm-store-slug";
const ROOT = (process.env.ROOT_DOMAIN ?? "mymarket.app").toLowerCase();
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "static", "mail"]);
const IS_DEV = process.env.NODE_ENV === "development";
const UPGRADE_INSECURE = (process.env.APP_URL ?? "").startsWith("https://");

/**
 * Edge of the app (Next 16 "proxy", formerly middleware):
 *  - per-request CSP nonce for every page (request header → Next stamps its scripts; response header → browser)
 *  - {slug}.ROOT_DOMAIN  → rewrite to /s/{slug}/…  (storefront subdomains)
 *  - /s/{slug}/…         → tag the request with the store slug (store-language default)
 *  - custom domains      → TODO(roadmap): look up a verified `stores.custom_domain` (cache it) and rewrite the same way.
 */
export function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  const url = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  const isApi = url.pathname.startsWith("/api/");

  // Never trust client-sent values for headers we own.
  requestHeaders.delete(STORE_SLUG_HEADER);
  requestHeaders.delete(NONCE_HEADER);

  let csp: string | undefined;
  if (!isApi) {
    const nonce = generateNonce();
    csp = buildCsp({ nonce, isDev: IS_DEV, upgradeInsecureRequests: UPGRADE_INSECURE });
    requestHeaders.set(NONCE_HEADER, nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  let res: NextResponse;
  if (host.endsWith(`.${ROOT}`) && !isApi) {
    const sub = host.slice(0, -(ROOT.length + 1));
    if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) {
      requestHeaders.set(STORE_SLUG_HEADER, sub);
      const rewritten = url.clone();
      rewritten.pathname = `/s/${sub}${url.pathname === "/" ? "" : url.pathname}`;
      res = NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
      if (csp) res.headers.set("Content-Security-Policy", csp);
      return res;
    }
  }

  const m = /^\/s\/([a-z0-9-]+)(?:\/|$)/.exec(url.pathname);
  if (m) requestHeaders.set(STORE_SLUG_HEADER, m[1]!);

  res = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|images/|api/files/|sw\\.js|offline\\.html|manifest\\.webmanifest|icons/|fonts/|apple-touch-icon\\.png).*)",
  ],
};
