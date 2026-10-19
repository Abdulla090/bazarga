import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { loadSitemapEntries } from "@/server/services/sitemap";
import { STATIC_PUBLIC_PATHS, siteUrl } from "@/lib/seo";

/** /sitemap.xml: marketing + legal pages, then every active store and its active products. Rendered per request. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = siteUrl();
  const now = new Date();
  const out: MetadataRoute.Sitemap = STATIC_PUBLIC_PATHS.map((p) => ({
    lastModified: now,
    url: `${base}${p === "/" ? "" : p}`,
    changeFrequency: p === "/" || p === "/pricing" ? "weekly" : "yearly",
    priority: p === "/" ? 1 : p === "/pricing" ? 0.8 : 0.3,
  }));
  try {
    const { stores, products } = await loadSitemapEntries(db());
    for (const s of stores) out.push({ url: `${base}/s/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "daily", priority: 0.7 });
    for (const p of products) out.push({ url: `${base}/s/${p.slug}/p/${p.id}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.6 });
  } catch (err) {
    // The static part is still a valid sitemap; never 500 a crawler.
    logger.error("sitemap.failed", { err });
  }
  return out;
}
