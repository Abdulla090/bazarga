import "server-only";
import { cache } from "react";
import { getStoreBySlug } from "@/server/services/stores";
import { db } from "@/server/db";
import type { Locale } from "@/lib/i18n";

export const storeDefaultLocale = cache(async (slug: string): Promise<Locale | null> => {
  try {
    return (await getStoreBySlug(db(), slug))?.defaultLocale ?? null;
  } catch {
    return null;
  }
});
