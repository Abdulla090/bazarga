import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/server/cache/storefront";

/** Store for a storefront route: cached across requests by slug (see src/server/cache), deduped per render. */
export const loadStore = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) notFound();
  const store = await getStorefrontStore(slug);
  if (!store) notFound();
  return store;
});
