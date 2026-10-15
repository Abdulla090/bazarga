import type { Locale } from "@/lib/i18n";

/** Transactional auth emails in the account's language (ku Sorani, kmr Kurmanji, ar, en). Plain text, link on its own line. */
type Copy = { subject: string; body: (link: string) => string };

const RESET: Record<Locale, Copy> = {
  en: {
    subject: "Reset your Bazarga password",
    body: (l) => `Reset your Bazarga password (valid for 1 hour):\n${l}\n\nIf you didn't ask for this, ignore this email.`,
  },
  ku: {
    subject: "وشەی نهێنی بازارگە نوێ بکەرەوە",
    body: (l) => `بۆ گۆڕینی وشەی نهێنی بازارگە ئەم لینکە بکەرەوە (یەک کاتژمێر کاردەکات):\n${l}\n\nئەگەر تۆ داوات نەکردووە، ئەم ئیمەیڵە فەرامۆش بکە.`,
  },
  kmr: {
    subject: "Şîfreya Bazargayê nû bike",
    body: (l) => `Ji bo guhertina şîfreya Bazargayê vê girêdanê veke (saetekê derbasdar e):\n${l}\n\nHeke te ev nexwestiye, vê e-nameyê bihêle.`,
  },
  ar: {
    subject: "إعادة تعيين كلمة مرور بازارگە",
    body: (l) => `افتح هذا الرابط لتغيير كلمة مرور بازارگە (صالح لمدة ساعة):\n${l}\n\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.`,
  },
};

const VERIFY: Record<Locale, Copy> = {
  en: {
    subject: "Confirm your email for Bazarga",
    body: (l) => `Welcome to Bazarga. Confirm your email (valid for 24 hours):\n${l}\n\nIf you didn't sign up, ignore this email.`,
  },
  ku: {
    subject: "ئیمەیڵەکەت بۆ بازارگە پشتڕاست بکەرەوە",
    body: (l) => `بەخێربێیت بۆ بازارگە. ئیمەیڵەکەت پشتڕاست بکەرەوە (٢٤ کاتژمێر کاردەکات):\n${l}\n\nئەگەر تۆ ئەکاونتت دروست نەکردووە، ئەم ئیمەیڵە فەرامۆش بکە.`,
  },
  kmr: {
    subject: "E-nameya xwe ji bo Bazargayê erê bike",
    body: (l) => `Bi xêr hatî Bazargayê. E-nameya xwe erê bike (24 saetan derbasdar e):\n${l}\n\nHeke te hesab çênekiriye, vê e-nameyê bihêle.`,
  },
  ar: {
    subject: "أكّد بريدك الإلكتروني في بازارگە",
    body: (l) => `أهلاً بك في بازارگە. أكّد بريدك الإلكتروني (صالح لمدة 24 ساعة):\n${l}\n\nإذا لم تنشئ حساباً، تجاهل هذه الرسالة.`,
  },
};

export function resetMail(locale: Locale, link: string) {
  const c = RESET[locale] ?? RESET.en;
  return { subject: c.subject, text: c.body(link) };
}
export function verifyMail(locale: Locale, link: string) {
  const c = VERIFY[locale] ?? VERIFY.en;
  return { subject: c.subject, text: c.body(link) };
}
