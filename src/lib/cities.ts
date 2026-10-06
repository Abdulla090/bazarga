import type { LocalizedText } from "./i18n";

export type CitySeed = { key: string; name: LocalizedText; fee: number };

/** Default delivery zones seeded for every new store (fees in IQD, editable per store). */
export const IRAQI_CITIES: CitySeed[] = [
  { key: "erbil", fee: 3000, name: { ku: "هەولێر", ar: "أربيل", en: "Erbil", kmr: "Hewlêr" } },
  { key: "sulaymaniyah", fee: 5000, name: { ku: "سلێمانی", ar: "السليمانية", en: "Sulaymaniyah", kmr: "Silêmanî" } },
  { key: "duhok", fee: 5000, name: { ku: "دهۆک", ar: "دهوك", en: "Duhok", kmr: "Duhok" } },
  { key: "kirkuk", fee: 5000, name: { ku: "کەرکووک", ar: "كركوك", en: "Kirkuk", kmr: "Kerkûk" } },
  { key: "baghdad", fee: 6000, name: { ku: "بەغدا", ar: "بغداد", en: "Baghdad", kmr: "Bexda" } },
  { key: "basra", fee: 7000, name: { ku: "بەسرە", ar: "البصرة", en: "Basra", kmr: "Besra" } },
  { key: "mosul", fee: 5000, name: { ku: "مووسڵ", ar: "الموصل", en: "Mosul", kmr: "Mûsil" } },
  { key: "halabja", fee: 5000, name: { ku: "هەڵەبجە", ar: "حلبجة", en: "Halabja", kmr: "Helebce" } },
  { key: "zakho", fee: 5000, name: { ku: "زاخۆ", ar: "زاخو", en: "Zakho", kmr: "Zaxo" } },
];
