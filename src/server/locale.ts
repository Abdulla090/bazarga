import "server-only";
import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

export async function currentLocale(): Promise<Locale> {
  const l = await getLocale();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}
