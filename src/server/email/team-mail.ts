import type { Locale } from "@/lib/i18n";

/** Team invite email in the store's language. Plain text, link on its own line. */
const INVITE: Record<Locale, { subject: (store: string) => string; body: (store: string, by: string, link: string) => string }> = {
  en: {
    subject: (s) => `Join ${s} on Reelcart`,
    body: (s, by, l) => `${by} invited you to help run ${s} on Reelcart (orders and products). Accept within 7 days:\n${l}\n\nSign in or create an account with this email address.`,
  },
  ku: {
    subject: (s) => `بەشداربە لە ${s} لە بازارگە`,
    body: (s, by, l) => `${by} بانگهێشتی کردوویت بۆ یارمەتیدان لە بەڕێوەبردنی ${s} لە بازارگە (داواکاری و کاڵاکان). لە ماوەی ٧ ڕۆژدا قبووڵی بکە:\n${l}\n\nبەم ئیمەیڵە بچۆ ژوورەوە یان ئەکاونت دروست بکە.`,
  },
  kmr: {
    subject: (s) => `Beşdarî ${s} li Reelcartê bibe`,
    body: (s, by, l) => `${by} tu vexwendî ku alîkariya birêvebirina ${s} li Reelcartê bikî (ferman û berhem). Di nav 7 rojan de qebûl bike:\n${l}\n\nBi vê e-nameyê têkeve an hesabekî çêke.`,
  },
  ar: {
    subject: (s) => `انضم إلى ${s} على بازارگە`,
    body: (s, by, l) => `دعاك ${by} للمساعدة في إدارة ${s} على بازارگە (الطلبات والمنتجات). اقبل الدعوة خلال 7 أيام:\n${l}\n\nسجّل الدخول أو أنشئ حساباً بهذا البريد الإلكتروني.`,
  },
};

export function inviteMail(locale: Locale, store: string, by: string, link: string) {
  const c = INVITE[locale] ?? INVITE.en;
  return { subject: c.subject(store).slice(0, 200), text: c.body(store, by, link) };
}
