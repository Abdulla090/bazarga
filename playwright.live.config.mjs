// Live runs against the deployed site from a sandbox behind an authenticating egress proxy (HTTPS_PROXY):
//   BASE_URL=https://bazarga.vercel.app CHROMIUM_PATH=/usr/bin/chromium npx playwright test -c playwright.live.config.mjs e2e/<spec>
// Run with NODE_USE_ENV_PROXY=1 so Node-side fetch() in specs goes through the same proxy.
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

const p = process.env.HTTPS_PROXY ? new URL(process.env.HTTPS_PROXY) : null;
const proxy = p ? { server: `${p.protocol}//${p.host}`, username: decodeURIComponent(p.username), password: decodeURIComponent(p.password) } : undefined;

export default defineConfig({
  ...base,
  timeout: 180_000,
  use: { ...base.use, baseURL: process.env.BASE_URL ?? "https://bazarga.vercel.app", proxy, launchOptions: { ...base.use.launchOptions, args: ["--no-sandbox", "--disable-dev-shm-usage"] } },
});
