import "server-only";
import { cache } from "react";
import { getStorefrontStore } from "@/server/cache/storefront";
import type { Locale } from "@/lib/i18n";

/** The store's default language for visitors without a language cookie (cached store lookup, no extra SQL). */
export const storeDefaultLocale = cache(async (slug: string): Promise<Locale | null> => {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  try {
    return (await getStorefrontStore(slug))?.defaultLocale ?? null;
  } catch {
    return null;
  }
});
