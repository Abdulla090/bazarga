import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every public POST route handler must be rate limited, or be explicitly listed here with the reason it is
 * protected another way. A new route that is neither fails this test, so a public write can't ship unthrottled.
 */
const ALLOWLIST: Record<string, string> = {
  "src/app/api/cron/payments/route.ts": "CRON_SECRET bearer, not callable by the public",
  "src/app/api/payments/checkout/route.ts": "payments gateway: off by default, signed/validated per provider",
  "src/app/api/payments/fib/callback/route.ts": "payments gateway callback, verified against the provider",
  "src/app/api/payments/webhook/[provider]/route.ts": "payments webhook, signature verified",
  "src/app/api/payments/zaincash/webhook/route.ts": "payments webhook, signature verified",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

describe("rate limit coverage", () => {
  const routes = walk("src/app/api").filter((f) => /export (async function|const) POST/.test(readFileSync(f, "utf8")));

  it("finds the POST routes", () => {
    expect(routes.length).toBeGreaterThan(3);
  });

  it.each(routes)("%s is rate limited or allowlisted", (f) => {
    const key = f.replaceAll("\\", "/");
    const limited = /enforceRateLimit\(/.test(readFileSync(f, "utf8"));
    expect(limited || key in ALLOWLIST, `${key} accepts POST without enforceRateLimit`).toBe(true);
  });

  it("the allowlist has no stale entries", () => {
    const keys = new Set(routes.map((f) => f.replaceAll("\\", "/")));
    for (const k of Object.keys(ALLOWLIST)) expect(keys.has(k), `${k} no longer exists / has no POST`).toBe(true);
  });

  it("public server actions that write throttle themselves", () => {
    const need: [string, RegExp][] = [
      ["src/server/actions/storefront.ts", /placeOrderAction[\s\S]*?enforceRateLimit\(/],
      ["src/server/actions/marketing.ts", /joinWaitlistAction[\s\S]*?enforceRateLimit\(/],
      ["src/server/actions/upgrade.ts", /requestUpgradeAction[\s\S]*?enforceRateLimit\(/],
      ["src/server/actions/auth.ts", /logInAction[\s\S]*?enforceRateLimit\(/],
    ];
    for (const [f, re] of need) expect(re.test(readFileSync(f, "utf8")), f).toBe(true);
  });
});
