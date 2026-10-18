/**
 * Custom domain per seller (SF7, Business+). Pure helpers shared by the dashboard, the verify action, the proxy and tests.
 *
 * The seller points a domain they own at the platform:
 *   subdomain (shop.brand.com) → CNAME  shop → CUSTOM_DOMAIN_CNAME   (default cname.vercel-dns.com)
 *   apex      (brand.com)      → A      @    → CUSTOM_DOMAIN_A       (default 76.76.21.21, Vercel's anycast IP)
 * "Verify" does a server DNS lookup; once it matches, src/proxy.ts serves the store on that host (/s/<slug> rewrite).
 * The host must also be attached to the deployment: automatically through the Vercel API when the operator sets
 * VERCEL_TOKEN + VERCEL_PROJECT_ID (optional VERCEL_TEAM_ID), otherwise by hand (docs/SETUP.md).
 */
const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const DEFAULT_CNAME_TARGET = "cname.vercel-dns.com";
export const DEFAULT_A_TARGET = "76.76.21.21";

export type DomainTargets = { cname: string; a: string };

export function domainTargets(e: { CUSTOM_DOMAIN_CNAME?: string; CUSTOM_DOMAIN_A?: string }): DomainTargets {
  return { cname: (e.CUSTOM_DOMAIN_CNAME || DEFAULT_CNAME_TARGET).trim().toLowerCase().replace(/\.$/, ""), a: (e.CUSTOM_DOMAIN_A || DEFAULT_A_TARGET).trim() };
}

/** "https://Shop.Brand.com/path" → "shop.brand.com"; null when it is not a usable public hostname. */
export function normalizeDomain(raw: string): string | null {
  const h = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!HOST_RE.test(h)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  return h;
}

/** Hosts a seller may never claim: the platform's own hosts and their subdomains, plus shared hosting suffixes. */
export function isReservedDomain(host: string, platformHosts: string[]): boolean {
  const shared = ["vercel.app", "vercel.com", "netlify.app", "github.io", "localhost", "example.com", "example.org", "example.net"];
  return [...platformHosts.filter(Boolean).map((h) => h.toLowerCase()), ...shared].some((p) => host === p || host.endsWith(`.${p}`));
}

/** Two labels (brand.com, brand.iq) = apex; deeper = subdomain. Good enough for the instructions (co.uk-style apexes show both). */
export function isApex(host: string): boolean {
  return host.split(".").length === 2;
}

export type DnsRecord = { type: "CNAME" | "A"; name: string; value: string };

/** The DNS record the seller adds at their registrar. */
export function dnsInstructions(host: string, t: DomainTargets): DnsRecord {
  if (isApex(host)) return { type: "A", name: "@", value: t.a };
  return { type: "CNAME", name: host.split(".").slice(0, -2).join("."), value: t.cname };
}

export type DnsLookup = { cname: (h: string) => Promise<string[]>; a: (h: string) => Promise<string[]> };

/** Does the host point at the platform? CNAME to the target (any case, trailing dot) or an A record on the target IP. */
export async function checkDns(host: string, t: DomainTargets, dns: DnsLookup): Promise<{ ok: boolean; found: string[] }> {
  const found: string[] = [];
  const cn = await dns.cname(host).catch(() => [] as string[]);
  for (const c of cn) found.push(`CNAME ${c}`);
  if (cn.some((c) => c.toLowerCase().replace(/\.$/, "") === t.cname)) return { ok: true, found };
  const a = await dns.a(host).catch(() => [] as string[]);
  for (const ip of a) found.push(`A ${ip}`);
  return { ok: a.includes(t.a), found };
}

/** True when the host may belong to a seller's custom domain (not the app's own host, not a dev/preview host). Proxy pre-filter. */
export function maybeCustomHost(host: string, platformHosts: string[]): boolean {
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes(".")) return false;
  return !isReservedDomain(host, platformHosts);
}

/**
 * Hosts that are the platform itself (never looked up as a seller domain): APP_URL's host, ROOT_DOMAIN and the
 * deployment's own Vercel hosts. *.vercel.app etc. are excluded by isReservedDomain anyway.
 */
export function platformHostsFromEnv(e: Record<string, string | undefined>): string[] {
  const host = (v?: string) => {
    if (!v) return "";
    try { return new URL(v.includes("://") ? v : `https://${v}`).hostname.toLowerCase(); } catch { return ""; }
  };
  return [host(e.APP_URL), host(e.ROOT_DOMAIN), host(e.VERCEL_URL), host(e.VERCEL_PROJECT_PRODUCTION_URL), host(e.VERCEL_BRANCH_URL)].filter(Boolean);
}

/** host → store slug (or null = not a verified seller domain), with short TTLs so a new verification shows fast. */
export class HostSlugCache {
  private map = new Map<string, { slug: string | null; until: number }>();
  constructor(private readonly hitMs = 5 * 60_000, private readonly missMs = 60_000, private readonly max = 5000) {}
  get(host: string, now = Date.now()): string | null | undefined {
    const e = this.map.get(host);
    if (!e) return undefined;
    if (e.until < now) { this.map.delete(host); return undefined; }
    return e.slug;
  }
  set(host: string, slug: string | null, now = Date.now()) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(host, { slug, until: now + (slug ? this.hitMs : this.missMs) });
  }
}
