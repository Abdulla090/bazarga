import { NextResponse, type NextRequest } from "next/server";
import { NONCE_HEADER, buildCsp, generateNonce } from "@/server/csp";
import { ExistenceCache, INTERNAL_404_HEADER, decideNotFound, paymentsGatewayOn } from "@/lib/not-found";
import { GEO_LOCALE_HEADER, guessLocale } from "@/lib/geo-locale";
import { SOURCE_COOKIE_MAX_AGE, parseSource, sourceCookieName } from "@/lib/social";
import { resolveDomainConfig, storeSlugFromHost } from "@/lib/domains";

const STORE_SLUG_HEADER = "x-mm-store-slug";
// Storefront subdomains are off unless ROOT_DOMAIN is set (src/lib/domains.ts; docs/LAUNCH.md "Custom domain").
const DOMAINS = resolveDomainConfig({ ROOT_DOMAIN: process.env.ROOT_DOMAIN, STORE_SUBDOMAINS: process.env.STORE_SUBDOMAINS });
const IS_DEV = process.env.NODE_ENV === "development";
const UPGRADE_INSECURE = (process.env.APP_URL ?? "").startsWith("https://");
const GATEWAY_ON = paymentsGatewayOn(process.env.PAYMENTS_PROVIDER);
const storeExistence = new ExistenceCache();

/** A full-page browser navigation (not an RSC/prefetch/server-action request), the only kind we answer with an HTML 404. */
function isDocumentRequest(req: NextRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (req.headers.get("rsc") || req.headers.get("next-router-prefetch") || req.headers.get("next-action")) return false;
  return (req.headers.get("accept") ?? "").includes("text/html");
}

async function storeExists(origin: string, slug: string): Promise<boolean> {
  const cached = storeExistence.get(slug);
  if (cached !== undefined) return cached;
  try {
    const r = await fetch(`${origin}/api/store-exists/${slug}`, { headers: { [INTERNAL_404_HEADER]: "1" }, signal: AbortSignal.timeout(2000), cache: "no-store" });
    if (!r.ok) return true; // fail open: the page still renders its own not-found UI
    const exists = Boolean(((await r.json()) as { exists?: unknown }).exists);
    storeExistence.set(slug, exists);
    return exists;
  } catch {
    return true;
  }
}

/**
 * Answer with the branded 404 page and a real 404 status. With Cache Components the status line of a page is sent
 * before `notFound()` can run, so the proxy renders /e404 itself (forwarding cookies + language so the page is in the
 * visitor's locale) and returns that HTML with status 404 and the page's own CSP (its scripts carry that nonce).
 */
async function notFoundResponse(req: NextRequest, kind: "page" | "store"): Promise<NextResponse | null> {
  try {
    const headers = new Headers({ [INTERNAL_404_HEADER]: "1", accept: "text/html" });
    for (const h of ["cookie", "accept-language", "x-forwarded-host", "x-forwarded-proto"]) {
      const v = req.headers.get(h);
      if (v) headers.set(h, v);
    }
    const r = await fetch(`${req.nextUrl.origin}/e404${kind === "store" ? "?k=store" : ""}`, { headers, signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "manual" });
    if (!r.ok) return null;
    const out = new NextResponse(req.method === "HEAD" ? null : await r.text(), { status: 404 });
    out.headers.set("Content-Type", "text/html; charset=utf-8");
    out.headers.set("Cache-Control", "no-store");
    out.headers.set("X-Robots-Tag", "noindex");
    const csp = r.headers.get("content-security-policy");
    if (csp) out.headers.set("Content-Security-Policy", csp);
    return out;
  } catch {
    return null; // fall back to the in-page not-found UI (status 200)
  }
}

/**
 * Edge of the app (Next 16 "proxy", formerly middleware):
 *  - per-request CSP nonce for every page (request header → Next stamps its scripts; response header → browser)
 *  - {slug}.ROOT_DOMAIN  → rewrite to /s/{slug}/…  (storefront subdomains; only when ROOT_DOMAIN is set)
 *  - /s/{slug}/…         → tag the request with the store slug (store-language default)
 *  - custom domains      → TODO(roadmap): look up a verified `stores.custom_domain` (cache it) and rewrite the same way.
 */
export async function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  const url = req.nextUrl;
  const subSlug = storeSlugFromHost(host, DOMAINS);
  const requestHeaders = new Headers(req.headers);
  const isApi = url.pathname.startsWith("/api/");

  // Never trust client-sent values for headers we own.
  requestHeaders.delete(STORE_SLUG_HEADER);
  requestHeaders.delete(NONCE_HEADER);
  requestHeaders.delete(GEO_LOCALE_HEADER);
  // Language from IP location (Vercel edge geo headers; no browser permission prompt). Used only when the visitor has no saved choice.
  const geoLocale = guessLocale(req.headers.get("x-vercel-ip-country"), req.headers.get("x-vercel-ip-country-region"), req.headers.get("accept-language"));
  if (geoLocale) requestHeaders.set(GEO_LOCALE_HEADER, geoLocale);

  // Real 404 status for unknown stores, /payments/return while payments are off, and /e404 itself.
  if (!isApi && !req.headers.get(INTERNAL_404_HEADER) && isDocumentRequest(req)) {
    const pathSlug = /^\/s\/([^/]+)(?:\/|$)/.exec(url.pathname)?.[1] ?? null;
    const decision = decideNotFound({ pathname: url.pathname, search: url.searchParams, storeSlug: subSlug ?? pathSlug, gatewayOn: GATEWAY_ON });
    let kind: "page" | "store" | null = null;
    if (decision && "kind" in decision) kind = decision.kind;
    else if (decision && !(await storeExists(url.origin, decision.checkStore))) kind = "store";
    if (kind) {
      const nf = await notFoundResponse(req, kind);
      if (nf) return nf;
    }
  }

  let csp: string | undefined;
  if (!isApi) {
    const nonce = generateNonce();
    const storefront = url.pathname.startsWith("/s/") || !!subSlug;
    csp = buildCsp({ nonce, isDev: IS_DEV, upgradeInsecureRequests: UPGRADE_INSECURE, storefront });
    requestHeaders.set(NONCE_HEADER, nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  let res: NextResponse;
  // /e404 is the platform 404 body (fetched by the proxy itself): never rewrite it into a storefront.
  if (subSlug && !isApi && url.pathname !== "/e404") {
    requestHeaders.set(STORE_SLUG_HEADER, subSlug);
    const rewritten = url.clone();
    rewritten.pathname = `/s/${subSlug}${url.pathname === "/" ? "" : url.pathname}`;
    res = NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
    if (csp) res.headers.set("Content-Security-Policy", csp);
    return withSourceCookie(res, req, subSlug);
  }

  const m = /^\/s\/([a-z0-9-]+)(?:\/|$)/.exec(url.pathname);
  if (m) requestHeaders.set(STORE_SLUG_HEADER, m[1]!);

  res = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) res.headers.set("Content-Security-Policy", csp);
  return m ? withSourceCookie(res, req, m[1]!) : res;
}

/**
 * `?src=<platform>` on a storefront page also sets the per-store attribution cookie on the response, so the source
 * survives a shopper who taps on before the page has hydrated (SourceCapture only runs after hydration; on a slow
 * phone the first tap could beat it and the order then showed as direct). Same name, value and lifetime as
 * src/lib/source-client.ts; not HttpOnly because checkout reads it in the browser.
 */
function withSourceCookie(res: NextResponse, req: NextRequest, slug: string): NextResponse {
  const src = parseSource(req.nextUrl.searchParams.get("src"));
  if (src && isDocumentRequest(req)) res.cookies.set(sourceCookieName(slug), src, { path: "/", maxAge: SOURCE_COOKIE_MAX_AGE, sameSite: "lax" });
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|images/|api/files/|sw\\.js|offline\\.html|manifest\\.webmanifest|icons/|fonts/|apple-touch-icon\\.png|og\\.png).*)",
  ],
};
