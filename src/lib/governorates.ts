import type { LocalizedText } from "./i18n";

export type GovernorateRegion = "kurdistan" | "federal";
export type Governorate = {
  key: string;
  region: GovernorateRegion;
  name: LocalizedText;
  /** Suggested default delivery fee (IQD) from an Erbil-based seller; every store edits its own. */
  defaultFee: number;
};

/**
 * Iraq's governorates, Kurdistan Region first. 18 historic governorates plus Halabja (KRG governorate since 2014,
 * recognised by the Iraqi parliament in 2025) = 19 keys. Keys are stable identifiers stored in the DB
 * (`governorates.key`, `delivery_zones.governorate_key`, `orders.governorate_key`) — never rename one.
 * The same list is seeded into the `governorates` table by migration 0001.
 */
export const IRAQ_GOVERNORATES = [
  { key: "erbil", region: "kurdistan", defaultFee: 3000, name: { ku: "هەولێر", ar: "أربيل", en: "Erbil", kmr: "Hewlêr" } },
  { key: "sulaymaniyah", region: "kurdistan", defaultFee: 5000, name: { ku: "سلێمانی", ar: "السليمانية", en: "Sulaymaniyah", kmr: "Silêmanî" } },
  { key: "duhok", region: "kurdistan", defaultFee: 5000, name: { ku: "دهۆک", ar: "دهوك", en: "Duhok", kmr: "Duhok" } },
  { key: "halabja", region: "kurdistan", defaultFee: 5000, name: { ku: "هەڵەبجە", ar: "حلبجة", en: "Halabja", kmr: "Helebce" } },
  { key: "kirkuk", region: "federal", defaultFee: 5000, name: { ku: "کەرکووک", ar: "كركوك", en: "Kirkuk", kmr: "Kerkûk" } },
  { key: "ninawa", region: "federal", defaultFee: 5000, name: { ku: "نەینەوا", ar: "نينوى", en: "Nineveh", kmr: "Neynewa" } },
  { key: "baghdad", region: "federal", defaultFee: 6000, name: { ku: "بەغدا", ar: "بغداد", en: "Baghdad", kmr: "Bexda" } },
  { key: "salahaddin", region: "federal", defaultFee: 6000, name: { ku: "سەڵاحەدین", ar: "صلاح الدين", en: "Saladin", kmr: "Selahedîn" } },
  { key: "diyala", region: "federal", defaultFee: 6000, name: { ku: "دیالە", ar: "ديالى", en: "Diyala", kmr: "Diyala" } },
  { key: "anbar", region: "federal", defaultFee: 7000, name: { ku: "ئەنبار", ar: "الأنبار", en: "Anbar", kmr: "Enbar" } },
  { key: "babil", region: "federal", defaultFee: 6000, name: { ku: "بابل", ar: "بابل", en: "Babil", kmr: "Babil" } },
  { key: "karbala", region: "federal", defaultFee: 7000, name: { ku: "کەربەلا", ar: "كربلاء", en: "Karbala", kmr: "Kerbela" } },
  { key: "najaf", region: "federal", defaultFee: 7000, name: { ku: "نەجەف", ar: "النجف", en: "Najaf", kmr: "Necef" } },
  { key: "wasit", region: "federal", defaultFee: 7000, name: { ku: "واست", ar: "واسط", en: "Wasit", kmr: "Wasit" } },
  { key: "qadisiyyah", region: "federal", defaultFee: 7000, name: { ku: "قادسیە", ar: "القادسية", en: "Al-Qadisiyyah", kmr: "Qadisiye" } },
  { key: "maysan", region: "federal", defaultFee: 7000, name: { ku: "مەیسان", ar: "ميسان", en: "Maysan", kmr: "Meysan" } },
  { key: "dhiqar", region: "federal", defaultFee: 7000, name: { ku: "زیقار", ar: "ذي قار", en: "Dhi Qar", kmr: "Ziqar" } },
  { key: "muthanna", region: "federal", defaultFee: 7000, name: { ku: "موسەننا", ar: "المثنى", en: "Muthanna", kmr: "Musenna" } },
  { key: "basra", region: "federal", defaultFee: 7000, name: { ku: "بەسرە", ar: "البصرة", en: "Basra", kmr: "Besra" } },
] as const satisfies readonly Governorate[];

export type GovernorateKey = (typeof IRAQ_GOVERNORATES)[number]["key"];
export const GOVERNORATE_KEYS = IRAQ_GOVERNORATES.map((g) => g.key) as readonly GovernorateKey[];

export function isGovernorateKey(v: unknown): v is GovernorateKey {
  return typeof v === "string" && (GOVERNORATE_KEYS as readonly string[]).includes(v);
}

/**
 * v1 delivery-zone keys that were cities rather than governorates. Migration 0001 uses the same mapping to backfill
 * `delivery_zones.governorate_key` / `orders.governorate_key`; the zone rows themselves are kept (sellers may have
 * customised their fees), only linked to their governorate.
 */
export const LEGACY_CITY_TO_GOVERNORATE: Readonly<Record<string, GovernorateKey>> = {
  mosul: "ninawa",
  zakho: "duhok",
};

/** Governorate for a zone/city key, or null for seller-defined zones that aren't a governorate (e.g. "ranya"). */
export function governorateForCityKey(cityKey: string): GovernorateKey | null {
  if (isGovernorateKey(cityKey)) return cityKey;
  return LEGACY_CITY_TO_GOVERNORATE[cityKey] ?? null;
}
