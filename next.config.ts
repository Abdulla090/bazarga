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

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // Storefront subdomains ({slug}.mymarket.app) post server actions to themselves; add custom domains here or
      // forward x-forwarded-host from your reverse proxy.
      allowedOrigins: process.env.ROOT_DOMAIN ? [process.env.ROOT_DOMAIN, `*.${process.env.ROOT_DOMAIN}`] : [],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
