import { NextResponse, type NextRequest } from "next/server";

const STORE_SLUG_HEADER = "x-mm-store-slug";
const ROOT = (process.env.ROOT_DOMAIN ?? "mymarket.app").toLowerCase();
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "static", "mail"]);

/**
 * Edge of the app (Next 16 "proxy", formerly middleware):
 *  - {slug}.ROOT_DOMAIN  → rewrite to /s/{slug}/…  (storefront subdomains)
 *  - /s/{slug}/…         → tag the request with the store slug (store-language default)
 *  - custom domains      → TODO(roadmap): look up a verified `stores.custom_domain` (cache it) and rewrite the same way.
 */
export function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  const url = req.nextUrl;
  const requestHeaders = new Headers(req.headers);

  if (host.endsWith(`.${ROOT}`)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub) && !url.pathname.startsWith("/api/")) {
      requestHeaders.set(STORE_SLUG_HEADER, sub);
      const rewritten = url.clone();
      rewritten.pathname = `/s/${sub}${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
    }
  }

  const m = /^\/s\/([a-z0-9-]+)(?:\/|$)/.exec(url.pathname);
  if (m) requestHeaders.set(STORE_SLUG_HEADER, m[1]!);
  else requestHeaders.delete(STORE_SLUG_HEADER); // never trust a client-sent value

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|api/files/).*)"],
};
