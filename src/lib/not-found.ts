import { z } from "zod";

/**
 * Real 404 status for pages whose "not found" is only known after rendering starts (src/proxy.ts).
 * Pure helpers so the proxy rules are unit-tested without a server.
 */

/** Same rule as the storefront loader (src/app/s/[slug]/data.ts). */
export const slugExistsSchema = z.string().regex(/^[a-z0-9-]{2,40}$/);

/** Header the proxy sets on its own internal fetches so they are never intercepted again (no loops). */
export const INTERNAL_404_HEADER = "x-bz-internal";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PAYMENTS_PROVIDER as the gateway config reads it: blank/unset/none → off. */
export function paymentsGatewayOn(provider: string | undefined): boolean {
  const v = (provider ?? "").trim();
  return v !== "" && v !== "none";
}

export type NotFoundDecision = { kind: "page" | "store" } | { checkStore: string } | null;

/**
 * What the proxy should do for a page request:
 *  - `{kind}`        → answer 404 now with that body,
 *  - `{checkStore}`  → ask whether the store exists (404 with the store body when it doesn't),
 *  - `null`          → let the request through.
 * `storeSlug` is the slug the request resolves to (path /s/<slug> or a {slug}.ROOT_DOMAIN subdomain).
 */
export function decideNotFound(input: { pathname: string; search: URLSearchParams; storeSlug: string | null; gatewayOn: boolean }): NotFoundDecision {
  const { pathname, search, storeSlug, gatewayOn } = input;
  if (pathname === "/e404") return { kind: search.get("k") === "store" ? "store" : "page" };
  if (pathname === "/payments/return" || pathname === "/payments/return/") {
    if (!gatewayOn) return { kind: "page" };
    if (!UUID_RE.test(search.get("p") ?? "")) return { kind: "page" };
    return null;
  }
  if (storeSlug !== null) {
    if (!slugExistsSchema.safeParse(storeSlug).success) return { kind: "store" };
    return { checkStore: storeSlug };
  }
  return null;
}

/** Small TTL cache for store existence (per proxy instance). Positive answers live longer than negative ones. */
export class ExistenceCache {
  private map = new Map<string, { exists: boolean; until: number }>();
  constructor(
    private readonly hitMs = 5 * 60_000,
    private readonly missMs = 30_000,
    private readonly max = 5000,
  ) {}
  get(slug: string, now = Date.now()): boolean | undefined {
    const e = this.map.get(slug);
    if (!e) return undefined;
    if (e.until < now) {
      this.map.delete(slug);
      return undefined;
    }
    return e.exists;
  }
  set(slug: string, exists: boolean, now = Date.now()) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(slug, { exists, until: now + (exists ? this.hitMs : this.missMs) });
  }
  get size() {
    return this.map.size;
  }
}
