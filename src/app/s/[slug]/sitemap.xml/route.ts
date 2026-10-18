import { connection } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { products, stores } from "@/server/db/schema";
import { hasFeature, normalizePlan } from "@/lib/plans";
import { siteUrl, storeSitemapXml } from "@/lib/seo";
import { SITEMAP_MAX_PRODUCTS } from "@/server/services/sitemap";

/** Per-store sitemap (Advanced SEO, Max): the store home and its active products. Other plans: 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection(); // per request: never prerendered (Cache Components would bake one placeholder slug)
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return new Response("Not found", { status: 404 });
  const [st] = await db()
    .select({ id: stores.id, plan: stores.plan, updatedAt: stores.updatedAt })
    .from(stores)
    .where(and(eq(stores.slug, slug), eq(stores.isActive, true)));
  if (!st || !hasFeature(normalizePlan(st.plan), "seoAdvanced")) return new Response("Not found", { status: 404 });
  const rows = await db()
    .select({ id: products.id, updatedAt: products.updatedAt })
    .from(products)
    .where(and(eq(products.storeId, st.id), eq(products.isActive, true)))
    .orderBy(desc(products.updatedAt))
    .limit(SITEMAP_MAX_PRODUCTS);
  return new Response(storeSitemapXml(siteUrl(), slug, st.updatedAt, rows), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
