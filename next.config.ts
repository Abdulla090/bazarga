import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Content-Security-Policy is NOT set here: it carries a per-request script nonce, so it is built in
// src/proxy.ts (see src/server/csp.ts). These static headers apply to every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const IMMUTABLE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // `"use cache"` + cacheTag for the storefront data layer (src/server/cache/storefront.ts). Pages still render
  // per request (root layout → connection() for the CSP nonce); only data is cached.
  cacheComponents: true,
  // Every route blocks on connection() at the root, so there is no App Shell to prefetch; keep classic prefetching.
  partialPrefetching: false,
  cacheLife: {
    // Storefront reads are invalidated by tag on every seller write; this lifetime is only the safety net for
    // changes made outside the app. stale = client router reuse window.
    storefront: { stale: 60, revalidate: 900, expire: 86_400 },
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg", "web-push"],
  // Story-image fonts are read from disk at runtime (src/server/share/story.ts); make sure the standalone output has them.
  outputFileTracingIncludes: { "/api/share/story": ["./src/server/share/fonts/*.ttf"] },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // Storefront subdomains ({slug}.mymarket.app) post server actions to themselves; add custom domains here or
      // forward x-forwarded-host from your reverse proxy.
      allowedOrigins: process.env.ROOT_DOMAIN ? [process.env.ROOT_DOMAIN, `*.${process.env.ROOT_DOMAIN}`] : [],
    },
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      { source: "/:path*", headers: securityHeaders },
      // Hashed build output never changes under a URL (Next sets this too in production; stated explicitly so a
      // CDN in front sees it). Not in dev, where chunk names are stable across edits.
      ...(isProd ? [{ source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE }] }] : []),
      // Service worker: always revalidated so a deploy reaches clients on the next visit.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      // Static offline fallback: no scripts at all (it is served outside the nonce proxy).
      {
        source: "/offline.html",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" },
        ],
      },
      // Unhashed public assets: long-lived but not immutable (a rebrand replaces them in place).
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }] },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
