import { formatIQD } from "./money";
import { normalizePhone } from "./phone";
import type { Locale } from "./i18n";

export type WaTemplateKind = "confirmed" | "shipped" | "delivered";
export const WA_TEMPLATE_KINDS: WaTemplateKind[] = ["confirmed", "shipped", "delivered"];

export type WaTemplateInput = {
  storeName: string;
  orderNumber: number;
  total: number;
  customerPhone: string;
  trackingNumber?: string | null;
  trackUrl?: string | null;
};

type A = { s: string; n: number; t: string; tn: string | null; url: string | null };
const tail = (url: string | null) => (url ? `\n${url}` : "");
const T: Record<Locale, Record<WaTemplateKind, (a: A) => string>> = {
  ku: {
    confirmed: (a) => `سڵاو 👋 داواکارییەکەت #${a.n} لە ${a.s} پشتڕاستکرایەوە (${a.t}). سوپاس!`,
    shipped: (a) => `داواکارییەکەت #${a.n} لە ${a.s} نێردرا 🚚${a.tn ? ` ژمارەی بەدواداچوون: ${a.tn}` : ""}${tail(a.url)}`,
    delivered: (a) => `داواکارییەکەت #${a.n} گەیشت ✅ سوپاس بۆ کڕین لە ${a.s}! ئەگەر کێشەیەک هەیە پێمان بڵێ.`,
  },
  ar: {
    confirmed: (a) => `مرحباً 👋 تم تأكيد طلبك #${a.n} من ${a.s} (${a.t}). شكراً لك!`,
    shipped: (a) => `تم شحن طلبك #${a.n} من ${a.s} 🚚${a.tn ? ` رقم التتبع: ${a.tn}` : ""}${tail(a.url)}`,
    delivered: (a) => `تم تسليم طلبك #${a.n} ✅ شكراً لتسوقك من ${a.s}! إن كانت لديك أي ملاحظة أخبرنا.`,
  },
  en: {
    confirmed: (a) => `Hi 👋 your order #${a.n} from ${a.s} is confirmed (${a.t}). Thank you!`,
    shipped: (a) => `Your order #${a.n} from ${a.s} has shipped 🚚${a.tn ? ` Tracking number: ${a.tn}` : ""}${tail(a.url)}`,
    delivered: (a) => `Your order #${a.n} was delivered ✅ Thank you for shopping at ${a.s}! Tell us if anything is off.`,
  },
  kmr: {
    confirmed: (a) => `Silav 👋 daxwaza te #${a.n} ji ${a.s} hate pejirandin (${a.t}). Spas!`,
    shipped: (a) => `Daxwaza te #${a.n} ji ${a.s} hate şandin 🚚${a.tn ? ` Hejmara şopandinê: ${a.tn}` : ""}${tail(a.url)}`,
    delivered: (a) => `Daxwaza te #${a.n} gihîşt ✅ Spas ji bo kirîna ji ${a.s}! Heke pirsgirêkek hebe ji me re bêje.`,
  },
};

/** Free wa.me deep link with a localized order message; null when the phone is not a usable number. */
export function waTemplateLink(kind: WaTemplateKind, o: WaTemplateInput, locale: Locale): string | null {
  const phone = normalizePhone(o.customerPhone);
  if (!phone) return null;
  const text = T[locale][kind]({ s: o.storeName, n: o.orderNumber, t: formatIQD(o.total, locale), tn: o.trackingNumber?.trim() || null, url: o.trackUrl ?? null });
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
