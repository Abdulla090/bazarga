import type { Locale } from "./i18n";

const CURRENCY_LABEL: Record<Locale, string> = { ku: "دینار", ar: "د.ع", en: "IQD", kmr: "IQD" };

/** IQD has no minor unit in practice: amounts are whole dinars stored as integers. */
export function formatIQD(amount: number, locale: Locale = "en"): string {
  const n = Math.round(amount).toLocaleString("en-US");
  return `${n} ${CURRENCY_LABEL[locale]}`;
}

export function assertWholeDinars(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Amount must be a non-negative whole number of dinars");
}
