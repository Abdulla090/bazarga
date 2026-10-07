import { formatIQD } from "./money";
import type { Locale } from "./i18n";

export function waLink(phoneDigits: string, text: string): string {
  const digits = phoneDigits.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

type SummaryInput = {
  storeName: string;
  orderNumber: number;
  items: { name: string; variantTitle?: string | null; quantity: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerName: string;
  cityName: string;
  address: string;
  paymentLabel: string;
};

const L: Record<Locale, Record<string, string>> = {
  ku: { hi: "سڵاو", order: "داواکاری", items: "کاڵاکان", delivery: "گەیاندن", total: "کۆی گشتی", to: "بۆ", pay: "پارەدان" },
  ar: { hi: "مرحباً", order: "طلب", items: "المنتجات", delivery: "التوصيل", total: "المجموع", to: "إلى", pay: "الدفع" },
  en: { hi: "Hi", order: "Order", items: "Items", delivery: "Delivery", total: "Total", to: "To", pay: "Payment" },
  kmr: { hi: "Silav", order: "Daxwaz", items: "Berhem", delivery: "Gihandin", total: "Giştî", to: "Ji bo", pay: "Dayîn" },
};

/** Human, short order summary for the customer → seller WhatsApp message. */
export function orderSummaryText(o: SummaryInput, locale: Locale): string {
  const t = L[locale];
  const lines = o.items.map((i) => `• ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} ×${i.quantity} — ${formatIQD(i.lineTotal, locale)}`);
  return [
    `${t.hi} ${o.storeName} 👋`,
    `${t.order} #${o.orderNumber}`,
    ...lines,
    `${t.delivery}: ${formatIQD(o.deliveryFee, locale)}`,
    `${t.total}: ${formatIQD(o.total, locale)}`,
    `${t.pay}: ${o.paymentLabel}`,
    `${t.to}: ${o.customerName} — ${o.cityName}, ${o.address}`,
  ].join("\n");
}

/** One-line delivery address: area — landmark — street (Iraqi addresses are landmark-first). */
export function fullAddress(o: { areaName?: string | null; landmark?: string | null; address: string }): string {
  return [o.areaName, o.landmark, o.address].map((x) => x?.trim()).filter(Boolean).join(" — ");
}
