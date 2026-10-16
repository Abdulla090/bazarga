// E2E audit load burst (docs/E2E-AUDIT.md): N GETs across URLs at concurrency C, reports p50/p95/p99 + errors.
//   BASE_URL=http://localhost:3000 N=1000 C=50 PATHS=/s/hawler-bazaar,/s/hawler-bazaar/p/<id> node scripts/load-burst.mjs
// Orders (local only): ORDERS=200 SLUG=scale-1000 also fires placeOrderAction via the build's action manifest, each
// from its own X-Forwarded-For + phone so the fake-order limits don't kick in (they are tested elsewhere).
// Live runs: keep C ≤ 10 (polite) and set NODE_USE_ENV_PROXY=1 behind the sandbox proxy.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const N = Number(process.env.N ?? 200);
const C = Number(process.env.C ?? 10);
const PATHS = (process.env.PATHS ?? "/,/pricing,/s/hawler-bazaar").split(",");
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];

async function run(n, c, task) {
  const times = [];
  const errors = {};
  let next = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: c }, async () => {
    while (next < n) {
      const i = next++;
      const s = performance.now();
      try {
        const r = await task(i);
        if (!r.ok) errors[r.status] = (errors[r.status] ?? 0) + 1;
      } catch (e) {
        errors[e.cause?.code ?? e.message] = (errors[e.cause?.code ?? e.message] ?? 0) + 1;
      }
      times.push(performance.now() - s);
    }
  }));
  times.sort((a, b) => a - b);
  const secs = (Date.now() - t0) / 1000;
  return { n, c, rps: +(n / secs).toFixed(1), p50: Math.round(pct(times, 50)), p95: Math.round(pct(times, 95)), p99: Math.round(pct(times, 99)), max: Math.round(times.at(-1)), errors };
}

const out = {};
for (const p of PATHS) out[`GET ${p}`] = await run(Math.ceil(N / PATHS.length), C, async () => { const r = await fetch(BASE + p); await r.arrayBuffer(); return r; });

if (process.env.ORDERS && /localhost|127\.0\.0\.1/.test(BASE)) {
  const slug = process.env.SLUG ?? "hawler-bazaar";
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const id = Object.entries(manifest).find(([, v]) => v.exportedName === "placeOrderAction")?.[0];
  const html = await (await fetch(`${BASE}/s/${slug}`)).text();
  const pids = [...new Set([...html.matchAll(/productId\\?":\\?"([0-9a-f-]{36})/g)].map((m) => m[1]))];
  let okOrders = 0;
  out[`POST placeOrder ${slug}`] = await run(Number(process.env.ORDERS), Number(process.env.OC ?? C), async (i) => {
    const r = await fetch(`${BASE}/s/${slug}/cart`, {
      method: "POST",
      headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE, "X-Forwarded-For": `10.9.${(i >> 8) & 255}.${i & 255}` },
      body: JSON.stringify([slug, { items: [{ productId: pids[i % pids.length], quantity: 1 }], customerName: `Load ${i}`, phone: `0770${String(1000000 + i).slice(-7)}`, cityKey: "erbil", landmark: "load test", areaOther: "Shawes", paymentMethod: "cod", locale: "ku", elapsedMs: 9000 }]),
    });
    const t = await r.text();
    if (t.includes("redirectTo")) okOrders++;
    return r;
  });
  out[`POST placeOrder ${slug}`].placed = okOrders;
}
console.log(JSON.stringify(out, null, 1));
