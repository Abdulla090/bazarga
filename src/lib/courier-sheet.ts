import { formatIQD } from "./money";
import { normalizeIraqiMobile, phoneDisplay } from "./phone";
import type { Locale } from "./i18n";

export type CourierOrder = {
  number: number;
  customerName: string;
  customerPhone: string;
  cityName: string;
  areaName?: string | null;
  address: string;
  landmark?: string | null;
  notes?: string | null;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
};

const L: Record<Locale, Record<string, string>> = {
  ku: { order: "داواکاری", phone: "تەلەفۆن", to: "ناونیشان", landmark: "نیشانە", collect: "وەرگرتن لە کڕیار", paid: "پارەدراوە", note: "تێبینی" },
  ar: { order: "طلب", phone: "الهاتف", to: "العنوان", landmark: "علامة", collect: "المبلغ المطلوب", paid: "مدفوع", note: "ملاحظة" },
  en: { order: "Order", phone: "Phone", to: "Address", landmark: "Landmark", collect: "Collect", paid: "Paid", note: "Note" },
  kmr: { order: "Daxwaz", phone: "Telefon", to: "Navnîşan", landmark: "Nîşan", collect: "Bistîne", paid: "Hatiye dayîn", note: "Têbînî" },
};

/** Cash the courier must collect: only unpaid cash-on-delivery orders. */
export function codAmount(o: Pick<CourierOrder, "total" | "paymentMethod" | "paymentStatus">): number {
  return o.paymentMethod === "cod" && o.paymentStatus !== "paid" ? o.total : 0;
}

/** One order as a plain-text block for a courier. */
export function courierOrderText(o: CourierOrder, locale: Locale): string {
  const t = L[locale];
  const cod = codAmount(o);
  const place = [o.cityName, o.areaName, o.address].filter(Boolean).join("، ");
  return [
    `${t.order} #${o.number} — ${o.customerName}`,
    `${t.phone}: ${phoneDisplay(o.customerPhone)}`,
    `${t.to}: ${place}`,
    ...(o.landmark ? [`${t.landmark}: ${o.landmark}`] : []),
    ...(o.notes ? [`${t.note}: ${o.notes}`] : []),
    cod > 0 ? `${t.collect}: ${formatIQD(cod, locale)}` : t.paid,
  ].join("\n");
}

/** Several orders in one message, separated by a rule, with the cash total to collect. */
export function courierSheetText(orders: CourierOrder[], locale: Locale): string {
  const t = L[locale];
  const total = orders.reduce((n, o) => n + codAmount(o), 0);
  return [...orders.map((o) => courierOrderText(o, locale)), `${t.collect}: ${formatIQD(total, locale)}`].join("\n──────\n");
}

/** Courier's WhatsApp number as wa.me digits ("9647…"), or "" when blank/invalid (wa.me then lets the seller pick a contact). */
export function courierDigits(input: string | undefined): string {
  if (!input?.trim()) return "";
  const r = normalizeIraqiMobile(input);
  return r.ok ? r.e164.replace(/\D/g, "") : "";
}
