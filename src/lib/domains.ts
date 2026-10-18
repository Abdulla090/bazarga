/**
 * Storefront subdomains, env-gated (pure — unit tested, used by src/proxy.ts).
 *
 *   ROOT_DOMAIN unset            → off. Stores live at APP_URL/s/<slug> (always works, no DNS needed).
 *   ROOT_DOMAIN=bazarga.app      → on: <slug>.bazarga.app is rewritten to /s/<slug>. Needs a wildcard DNS record
 *                                  (*.bazarga.app → the host) and a wildcard TLS certificate on the host.
 *   STORE_SUBDOMAINS=false       → kill switch: keep ROOT_DOMAIN for links/emails but stop subdomain routing.
 *
 * Reserved labels (www, app, api, admin, …) never resolve to a store, and only one label deep counts
 * (a.b.bazarga.app is not a store). Before Oct 18 the root defaulted to "mymarket.app"; now no default.
 */
export type DomainConfig = { rootDomain: string | null; subdomains: boolean };

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set(["www", "app", "api", "admin", "static", "mail", "status", "cdn", "img"]);

const HOST_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function resolveDomainConfig(e: { ROOT_DOMAIN?: string; STORE_SUBDOMAINS?: string }): DomainConfig {
  const raw = (e.ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
  const rootDomain = raw && HOST_RE.test(raw) ? raw : null;
  const off = /^(false|0|off|no)$/i.test((e.STORE_SUBDOMAINS ?? "").trim());
  return { rootDomain, subdomains: !!rootDomain && !off };
}

/** The store slug a request host points at, or null (gate off, the bare root, a reserved or nested label). */
export function storeSlugFromHost(host: string, cfg: DomainConfig): string | null {
  if (!cfg.subdomains || !cfg.rootDomain) return null;
  const h = host.split(":")[0]!.toLowerCase();
  const suffix = `.${cfg.rootDomain}`;
  if (!h.endsWith(suffix)) return null;
  const sub = h.slice(0, -suffix.length);
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub) || !/^[a-z0-9-]+$/.test(sub)) return null;
  return sub;
}

/** Public storefront URL: https://<slug>.<root> when subdomains are on, else <APP_URL>/s/<slug>. */
export function publicStoreUrl(slug: string, appUrl: string, cfg: DomainConfig): string {
  if (cfg.subdomains && cfg.rootDomain) return `https://${encodeURIComponent(slug)}.${cfg.rootDomain}`;
  return `${appUrl.replace(/\/+$/, "")}/s/${encodeURIComponent(slug)}`;
}
