import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
