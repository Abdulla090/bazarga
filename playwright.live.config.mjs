// Seller + shopper journey e2e against a deployed site (default https://bazarga.vercel.app).
//   BASE_URL=https://bazarga.vercel.app CHROMIUM_PATH=/usr/bin/chromium npm run test:live
// Proxy-aware: when HTTPS_PROXY is set (sandbox), Chromium is launched through it with its credentials.
// Specs that sign up a fixed email (mobile-overflow) are local-gate only and are not listed here.
import { defineConfig } from "@playwright/test";

function proxyOption() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return {
      server: `${u.protocol}//${u.host}`,
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      bypass: "localhost,127.0.0.1",
    };
  } catch {
    return undefined;
  }
}

export default defineConfig({
  testDir: "e2e",
  testMatch: [
    "seller-journey.spec.mjs",
    "plan-gating.spec.mjs",
    "social-first.spec.mjs",
    "pixels.spec.mjs",
    "waitlist.spec.mjs",
    "landing-why-faq.spec.mjs",
    "legal-seo.spec.mjs",
    "error-pages.spec.mjs",
  ],
  timeout: 90_000,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "https://bazarga.vercel.app",
    proxy: proxyOption(),
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
