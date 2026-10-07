/**
 * Performance budget: gzipped first-load JS per route, from Next's build diagnostics.
 *   npm run build && npm run budget          (add --json for machine-readable output)
 * Reads .next/diagnostics/route-bundle-stats.json (route → firstLoadChunkPaths), gzips every chunk (level 9,
 * comparable to what a CDN serves) and sums them per route. Fails (exit 1) when a budgeted route is over.
 */
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const KiB = 1024;
export const BUDGETS = [
  { name: "storefront home", route: "/s/[slug]", max: 155 * KiB },
  { name: "product", route: "/s/[slug]/p/[productId]", max: 155 * KiB },
  { name: "cart", route: "/s/[slug]/cart", max: 155 * KiB },
  { name: "dashboard", route: "/dashboard", max: 200 * KiB },
];
// Every other dashboard route is held to the dashboard budget too.
const DASHBOARD_PREFIX = "/dashboard";

const STATS = ".next/diagnostics/route-bundle-stats.json";
if (!existsSync(STATS)) {
  console.error(`✗ ${STATS} not found — run \`npm run build\` first.`);
  process.exit(1);
}
const stats = JSON.parse(readFileSync(STATS, "utf8"));
const byRoute = new Map(stats.map((s) => [s.route, s]));

const gzCache = new Map();
const gz = (p) => {
  if (!gzCache.has(p)) gzCache.set(p, existsSync(p) ? gzipSync(readFileSync(p), { level: 9 }).length : 0);
  return gzCache.get(p);
};
const sizeOf = (entry) => entry.firstLoadChunkPaths.reduce((sum, p) => sum + gz(p), 0);
const fmt = (b) => `${(b / KiB).toFixed(1)} KiB`;

const rows = [];
let failed = 0;
for (const b of BUDGETS) {
  const entry = byRoute.get(b.route);
  if (!entry) {
    console.error(`✗ ${b.name} (${b.route}) missing from ${STATS}`);
    failed++;
    continue;
  }
  rows.push({ ...b, gzip: sizeOf(entry), raw: entry.firstLoadUncompressedJsBytes });
}
const dashMax = BUDGETS.find((b) => b.route === DASHBOARD_PREFIX).max;
for (const entry of stats) {
  if (entry.route.startsWith(`${DASHBOARD_PREFIX}/`)) {
    rows.push({ name: "dashboard", route: entry.route, max: dashMax, gzip: sizeOf(entry), raw: entry.firstLoadUncompressedJsBytes });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const w = Math.max(...rows.map((r) => r.route.length));
  for (const r of rows) {
    const ok = r.gzip <= r.max;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${r.route.padEnd(w)}  ${fmt(r.gzip).padStart(10)} gzip / ${fmt(r.max)}   (${fmt(r.raw)} raw)`);
  }
}
for (const r of rows) if (process.argv.includes("--json") && r.gzip > r.max) failed++;
if (failed) {
  console.error(`\n✗ ${failed} route(s) over budget`);
  process.exit(1);
}
console.log("\n✓ all routes within budget");
