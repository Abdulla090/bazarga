import { formatIQD } from "./money";
import { waLink } from "./whatsapp";
import type { Locale } from "./i18n";

const T: Record<Locale, (s: string, n: number, total: string, url: string | null) => string> = {
  ku: (s, n, t, u) => `سڵاو 👋 داواکارییەکەت #${n} لە ${s} (${t}) هێشتا پارەدانی تەواو نەبووە.${u ? `\nبۆ پارەدان: ${u}` : ""}`,
  ar: (s, n, t, u) => `مرحباً 👋 طلبك #${n} من ${s} (${t}) لم يكتمل دفعه بعد.${u ? `\nللدفع: ${u}` : ""}`,
  en: (s, n, t, u) => `Hi 👋 your order #${n} from ${s} (${t}) is still unpaid.${u ? `\nPay here: ${u}` : ""}`,
  kmr: (s, n, t, u) => `Silav 👋 daxwaza te #${n} ji ${s} (${t}) hê nehatiye dayîn.${u ? `\nBo dayînê: ${u}` : ""}`,
};

/** WhatsApp "remind to pay" link for an unpaid online (FIB/ZainCash) order; null without a phone. */
export function payReminderLink(
  o: { storeName: string; orderNumber: number; total: number; customerPhone: string; payUrl?: string | null },
  locale: Locale,
): string | null {
  if (!o.customerPhone.replace(/\D/g, "")) return null;
  return waLink(o.customerPhone, T[locale](o.storeName, o.orderNumber, formatIQD(o.total, locale), o.payUrl ?? null));
}
