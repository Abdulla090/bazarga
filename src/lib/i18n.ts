export const LOCALES = ["ku", "ar", "en", "kmr"] as const;
export type Locale = (typeof LOCALES)[number];
/** Locales offered in the UI switcher. Kurmanji (kmr) has every UI string (needs native review); English still backs any key added later. */
export const UI_LOCALES: readonly Locale[] = ["ku", "ar", "en", "kmr"];
export const DEFAULT_LOCALE: Locale = "ku";
export const LOCALE_COOKIE = "mm_locale";

export const RTL_LOCALES: readonly Locale[] = ["ku", "ar"];
export const isRtl = (l: Locale) => RTL_LOCALES.includes(l);
export const dirOf = (l: Locale): "rtl" | "ltr" => (isRtl(l) ? "rtl" : "ltr");

/** BCP-47 tags for <html lang>. Sorani = ckb. */
export const HTML_LANG: Record<Locale, string> = { ku: "ckb", ar: "ar", en: "en", kmr: "kmr" };

export const LOCALE_LABEL: Record<Locale, string> = {
  ku: "کوردی",
  ar: "العربية",
  en: "English",
  kmr: "Kurmancî",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Order used when a translation is missing for the requested locale. */
export const FALLBACKS: Record<Locale, Locale[]> = {
  ku: ["ku", "kmr", "ar", "en"],
  kmr: ["kmr", "ku", "en", "ar"],
  ar: ["ar", "ku", "en", "kmr"],
  en: ["en", "ku", "ar", "kmr"],
};

export type LocalizedText = Partial<Record<Locale, string>>;

/** Pick the best available translation for a locale. */
export function pickText(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  for (const l of FALLBACKS[locale]) {
    const v = text[l];
    if (v && v.trim()) return v;
  }
  return "";
}
