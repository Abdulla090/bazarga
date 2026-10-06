import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";
import { loadMessages } from "./messages";

export const STORE_SLUG_HEADER = "x-mm-store-slug";

/**
 * Locale resolution (no locale in URLs — storefront links stay short for Instagram bios):
 *   1. explicit locale (getTranslations({ locale }))
 *   2. the visitor's choice (cookie)
 *   3. on a storefront: the seller's store language
 *   4. Kurdish (Sorani)
 */
const resolveLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const slug = (await headers()).get(STORE_SLUG_HEADER);
  if (slug) {
    const { storeDefaultLocale } = await import("./store-locale");
    const l = await storeDefaultLocale(slug);
    if (l) return l;
  }
  return DEFAULT_LOCALE;
});

export default getRequestConfig(async ({ locale }) => {
  const resolved: Locale = isLocale(locale) ? locale : await resolveLocale();
  return {
    locale: resolved,
    messages: await loadMessages(resolved),
    timeZone: "Asia/Baghdad",
  };
});
