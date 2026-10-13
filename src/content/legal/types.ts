import type { Locale } from "@/lib/i18n";

export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };
export type LegalByLocale = Record<Locale, LegalDoc>;
