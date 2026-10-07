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
  /** Code applied at checkout (as stored on the order) and the IQD it took off the subtotal. */
  discountCode?: string | null;
  discountAmount?: number;
  customerName: string;
  cityName: string;
  address: string;
  paymentLabel: string;
};

const L: Record<Locale, Record<string, string>> = {
  ku: { hi: "سڵاو", order: "داواکاری", items: "کاڵاکان", subtotal: "کۆی کاڵاکان", discount: "داشکاندن", freeDelivery: "گەیاندنی بێبەرامبەر", delivery: "گەیاندن", total: "کۆی گشتی", to: "بۆ", pay: "پارەدان" },
  ar: { hi: "مرحباً", order: "طلب", items: "المنتجات", subtotal: "مجموع المنتجات", discount: "خصم", freeDelivery: "توصيل مجاني", delivery: "التوصيل", total: "المجموع", to: "إلى", pay: "الدفع" },
  en: { hi: "Hi", order: "Order", items: "Items", subtotal: "Subtotal", discount: "Discount", freeDelivery: "free delivery", delivery: "Delivery", total: "Total", to: "To", pay: "Payment" },
  kmr: { hi: "Silav", order: "Daxwaz", items: "Berhem", subtotal: "Berhem bi tevahî", discount: "Daxistin", freeDelivery: "gihandina belaş", delivery: "Gihandin", total: "Giştî", to: "Ji bo", pay: "Dayîn" },
};

/** Human, short order summary for the customer → seller WhatsApp message. */
export function orderSummaryText(o: SummaryInput, locale: Locale): string {
  const t = L[locale];
  const lines = o.items.map((i) => `• ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} ×${i.quantity} — ${formatIQD(i.lineTotal, locale)}`);
  const amount = o.discountAmount ?? 0;
  const code = o.discountCode?.trim();
  // "Discount (EID20): -8,500 IQD". A free-delivery code takes nothing off the subtotal, so say what it gave.
  const discount: string[] = [];
  if (amount > 0) {
    discount.push(`${t.subtotal}: ${formatIQD(o.subtotal, locale)}`);
    discount.push(`${t.discount}${code ? ` (${code})` : ""}: -${formatIQD(amount, locale)}`);
  } else if (code && o.deliveryFee === 0) {
    discount.push(`${t.discount} (${code}): ${t.freeDelivery}`);
  }
  return [
    `${t.hi} ${o.storeName} 👋`,
    `${t.order} #${o.orderNumber}`,
    ...lines,
    ...discount,
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
