/**
 * Storefront performance probe against a running server started with DB_QUERY_STATS=1:
 *   DB_QUERY_STATS=1 npm start   # in one shell
 *   BASE_URL=http://localhost:3000 node scripts/measure.mjs [--json]
 *
 * For each storefront route it reports:
 *   - SQL statements per view, cold (first view after start / after an invalidation) and warm (repeat view),
 *     read from GET /api/health → dbQueries (process-wide counter, so run it against an otherwise idle server);
 *   - first-load JS: every <script src> the HTML references (what a first visit downloads before hydration),
 *     summed raw and gzip-compressed (level 9, comparable to what CDNs serve). `nomodule` polyfills are skipped
 *     (modern browsers never download them). The framework share (Next's rootMainFiles: React DOM + App Router
 *     runtime, identical on every route) is reported separately from the route's own code.
 */
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SLUG = process.env.STORE_SLUG ?? "hawler-bazaar";
const asJson = process.argv.includes("--json");

async function queries() {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  if (typeof h.dbQueries !== "number") throw new Error("start the server with DB_QUERY_STATS=1");
  return h.dbQueries;
}

async function view(path, headers = {}) {
  const before = await queries();
  const res = await fetch(BASE + path, { headers });
  const html = await res.text();
  const after = await queries();
  // -1: the `select 1` the first health probe ran after reading the counter.
  return { status: res.status, html, queries: after - before - 1 };
}

const rootMain = existsSync(".next/build-manifest.json")
  ? new Set(JSON.parse(readFileSync(".next/build-manifest.json", "utf8")).rootMainFiles.map((f) => `/_next/${f}`))
  : new Set();

const jsCache = new Map();
async function firstLoadJs(html) {
  const tags = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"[^>]*>/g)].filter((m) => !/nomodule/i.test(m[0]));
  const srcs = [...new Set(tags.map((m) => m[1]))];
  let raw = 0;
  let gz = 0;
  let fwGz = 0;
  for (const src of srcs) {
    if (!jsCache.has(src)) {
      const buf = Buffer.from(await (await fetch(new URL(src, BASE))).arrayBuffer());
      jsCache.set(src, { raw: buf.length, gz: gzipSync(buf, { level: 9 }).length });
    }
    const s = jsCache.get(src);
    raw += s.raw;
    gz += s.gz;
    if (rootMain.has(src.split("?")[0])) fwGz += s.gz;
  }
  const kb = (n) => +(n / 1024).toFixed(1);
  return { files: srcs.length, rawKB: kb(raw), gzipKB: kb(gz), frameworkGzipKB: kb(fwGz), routeGzipKB: kb(gz - fwGz) };
}

// Discover a product id (the variant dress when present) from the storefront HTML.
const home = await view(`/s/${SLUG}`, { Cookie: "mm_locale=en" });
const ids = [...new Set([...home.html.matchAll(/\/s\/[a-z0-9-]+\/p\/([0-9a-f-]{36})/g)].map((m) => m[1]))];
const productId = ids[0];

const routes = [
  { name: "storefront home", path: `/s/${SLUG}` },
  { name: "storefront search", path: `/s/${SLUG}?q=honey` },
  { name: "product page", path: `/s/${SLUG}/p/${productId}` },
  { name: "cart / checkout", path: `/s/${SLUG}/cart` },
];

const out = [];
for (const r of routes) {
  const cold = r.name === "storefront home" ? home : await view(r.path, { Cookie: "mm_locale=en" });
  const warm = await view(r.path, { Cookie: "mm_locale=en" });
  const warmKu = await view(r.path, { Cookie: "mm_locale=ku" });
  out.push({
    route: r.name,
    path: r.path,
    status: warm.status,
    queriesCold: cold.queries,
    queriesWarm: warm.queries,
    queriesWarmKu: warmKu.queries,
    js: await firstLoadJs(warm.html),
  });
}

if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log("route                | status | SQL cold | SQL warm (en/ku) | first-load JS gzip (framework + route) / raw, files");
  for (const o of out) {
    console.log(
      `${o.route.padEnd(20)} | ${String(o.status).padEnd(6)} | ${String(o.queriesCold).padEnd(8)} | ${`${o.queriesWarm}/${o.queriesWarmKu}`.padEnd(16)} | ${o.js.gzipKB} KB (${o.js.frameworkGzipKB} + ${o.js.routeGzipKB}) / ${o.js.rawKB} KB, ${o.js.files}`,
    );
  }
}
