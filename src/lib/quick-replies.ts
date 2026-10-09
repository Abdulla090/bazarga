import { formatIQD } from "./money";
import { waLink } from "./whatsapp";
import type { Locale } from "./i18n";

export type QuickReplyKind = "confirmed" | "onTheWay" | "needLandmark";
export const QUICK_REPLY_KINDS: QuickReplyKind[] = ["confirmed", "onTheWay", "needLandmark"];

type Args = [store: string, n: number, total: string];
const T: Record<Locale, Record<QuickReplyKind, (...a: Args) => string>> = {
  ku: {
    confirmed: (s, n, t) => `سڵاو 👋 داواکارییەکەت #${n} لە ${s} پشتڕاستکرایەوە (${t}). سوپاس!`,
    onTheWay: (s, n) => `داواکارییەکەت #${n} لە ${s} لە ڕێگایە 🚚 تکایە ئامادە بە بۆ وەرگرتنی.`,
    needLandmark: (s, n) => `سڵاو 👋 بۆ گەیاندنی داواکاری #${n} لە ${s}، تکایە نزیکترین نیشانەی ناونیشانەکەت بنێرە (مزگەوت، بازاڕ، دووکان…).`,
  },
  ar: {
    confirmed: (s, n, t) => `مرحباً 👋 تم تأكيد طلبك #${n} من ${s} (${t}). شكراً لك!`,
    onTheWay: (s, n) => `طلبك #${n} من ${s} في الطريق إليك 🚚 يرجى التواجد للاستلام.`,
    needLandmark: (s, n) => `مرحباً 👋 لتوصيل طلبك #${n} من ${s}، أرسل لنا أقرب معلم لعنوانك (جامع، سوق، محل…).`,
  },
  en: {
    confirmed: (s, n, t) => `Hi 👋 your order #${n} from ${s} is confirmed (${t}). Thank you!`,
    onTheWay: (s, n) => `Your order #${n} from ${s} is on its way 🚚 Please be ready to receive it.`,
    needLandmark: (s, n) => `Hi 👋 to deliver order #${n} from ${s}, please send the nearest landmark to your address (mosque, market, shop…).`,
  },
  kmr: {
    confirmed: (s, n, t) => `Silav 👋 daxwaza te #${n} ji ${s} hate pejirandin (${t}). Spas!`,
    onTheWay: (s, n) => `Daxwaza te #${n} ji ${s} di rê de ye 🚚 Ji kerema xwe amade be ku wergirî.`,
    needLandmark: (s, n) => `Silav 👋 ji bo gihandina daxwaza #${n} ji ${s}, ji kerema xwe nîşana herî nêzîk a navnîşana xwe bişîne (mizgeft, bazar, dikan…).`,
  },
};

/** WhatsApp quick-reply link to the shopper in their language; null without a phone. */
export function quickReplyLink(
  kind: QuickReplyKind,
  o: { storeName: string; orderNumber: number; total: number; customerPhone: string },
  locale: Locale,
): string | null {
  if (!o.customerPhone.replace(/\D/g, "")) return null;
  return waLink(o.customerPhone, T[locale][kind](o.storeName, o.orderNumber, formatIQD(o.total, locale)));
}
