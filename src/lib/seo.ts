import { z } from "zod";
import { hasFeature, type PlanId } from "./plans";
import type { ProductSeo, StoreSeo } from "@/server/db/schema";
/** Public site URL for absolute links (sitemap, robots, OG). APP_URL without a trailing slash; localhost in dev. */
export function siteUrl(appUrl: string | undefined = process.env.APP_URL): string {
  try {
    const u = new URL(appUrl || "http://localhost:3000");
    return u.origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Marketing + legal pages that belong in the sitemap. */
export const STATIC_PUBLIC_PATHS = ["/", "/pricing", "/showcase", "/terms", "/privacy", "/refund"] as const;

/** Never indexed: private, transactional or per-shopper pages. Mirrored in robots.txt and page-level noindex. */
export const ROBOTS_DISALLOW = ["/dashboard", "/admin", "/api/", "/onboarding", "/payments/", "/invite/", "/e404", "/s/*/cart", "/s/*/order/", "/s/*/track"] as const;

// ---------------------------------------------------------------- advanced SEO + white-label (Max)
export type { ProductSeo, StoreSeo };

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;

const opt = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v), z.string().max(max).optional())
    .transform((v) => (v ? v : undefined));

export const storeSeoSchema = z.object({
  title: opt(SEO_TITLE_MAX),
  description: opt(SEO_DESCRIPTION_MAX),
  ogImageUrl: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.url({ protocol: /^https$/ }).max(500).optional()),
});
export const productSeoSchema = z.object({ title: opt(SEO_TITLE_MAX), description: opt(SEO_DESCRIPTION_MAX) });

/** Drop undefined keys so the stored JSON stays small ({} = no overrides). */
export function compactSeo<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

/** The overrides a storefront applies: only on plans with Advanced SEO (Max); otherwise none (defaults derive from content). */
export function effectiveSeo<T extends StoreSeo | ProductSeo>(plan: PlanId, seo: T | null | undefined): T | Record<string, never> {
  return hasFeature(plan, "seoAdvanced") && seo ? seo : {};
}

/** White-label is on only when the store is on a plan that includes it and the seller switched it on. */
export function whiteLabelOn(plan: PlanId, flag: boolean | null | undefined): boolean {
  return hasFeature(plan, "whiteLabel") && !!flag;
}

/** schema.org Store for a storefront home page (inline JSON-LD; serialise with serializeJsonLd). */
export function storeJsonLd(s: { name: string; url: string; description?: string; logo?: string | null; image?: string | null; telephone?: string | null; city?: string | null; sameAs?: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.name,
    url: s.url,
    ...(s.description ? { description: s.description } : {}),
    ...(s.logo ? { logo: s.logo } : {}),
    ...(s.image ? { image: s.image } : s.logo ? { image: s.logo } : {}),
    ...(s.telephone ? { telephone: `+${s.telephone.replace(/^\+/, "")}` } : {}),
    ...(s.city ? { address: { "@type": "PostalAddress", addressLocality: s.city, addressCountry: "IQ" } } : {}),
    ...(s.sameAs?.length ? { sameAs: s.sameAs } : {}),
  };
}

/** XML for one store's sitemap (home + active products). */
export function storeSitemapXml(base: string, slug: string, storeUpdated: Date, products: { id: string; updatedAt: Date }[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const url = (loc: string, d: Date, pr: string) => `<url><loc>${esc(loc)}</loc><lastmod>${d.toISOString()}</lastmod><priority>${pr}</priority></url>`;
  const b = base.replace(/\/$/, "");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    url(`${b}/s/${slug}`, storeUpdated, "1.0"),
    ...products.map((p) => url(`${b}/s/${slug}/p/${p.id}`, p.updatedAt, "0.8")),
    "</urlset>",
  ].join("");
}
