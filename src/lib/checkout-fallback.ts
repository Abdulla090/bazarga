import { formatIQD } from "./money";
import { waLink } from "./whatsapp";
import type { Locale } from "./i18n";

const T: Record<Locale, { hi: string; want: string; total: string; city: string }> = {
  ku: { hi: "سڵاو", want: "دەمەوێت ئەمانە داوا بکەم", total: "کۆی گشتی", city: "شار" },
  ar: { hi: "مرحباً", want: "أريد طلب التالي", total: "المجموع", city: "المدينة" },
  en: { hi: "Hi", want: "I'd like to order", total: "Total", city: "City" },
  kmr: { hi: "Silav", want: "Ez dixwazim vana sipariş bikim", total: "Giştî", city: "Bajar" },
};

export type FallbackLine = { name: string; variantTitle?: string | null; quantity: number; available?: boolean };

/**
 * Pre-filled WhatsApp message for shoppers whose checkout form keeps failing on a weak connection.
 * Null when the store has no WhatsApp number or nothing orderable is in the cart.
 */
export function checkoutFallbackLink(
  o: { whatsapp: string | null | undefined; storeName: string; lines: FallbackLine[]; total?: number | null; cityName?: string | null },
  locale: Locale,
): string | null {
  const digits = (o.whatsapp ?? "").replace(/\D/g, "");
  const lines = o.lines.filter((l) => l.available !== false && l.quantity > 0);
  if (!digits || !lines.length) return null;
  const t = T[locale];
  const body = [
    `${t.hi} ${o.storeName} 👋`,
    `${t.want}:`,
    ...lines.map((l) => `• ${l.name}${l.variantTitle ? ` (${l.variantTitle})` : ""} ×${l.quantity}`),
    ...(o.cityName ? [`${t.city}: ${o.cityName}`] : []),
    ...(o.total ? [`${t.total}: ${formatIQD(o.total, locale)}`] : []),
  ];
  return waLink(digits, body.join("\n"));
}
