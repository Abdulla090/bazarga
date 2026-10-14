import type { Locale } from "./i18n";

/** Small, bundle-safe part of the legal pages: labels, dates and the signup/footer agreement line (src/lib/legal.ts has the text). */
export const LEGAL_DOCS = ["terms", "privacy", "refund"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const LEGAL_PATH: Record<LegalDoc, string> = { terms: "/terms", privacy: "/privacy", refund: "/refund" };
export type LegalUi = { updated: string; date: string; contents: string; contact: string; nav: Record<LegalDoc, string>; agree: string };

export const LEGAL_UPDATED_ISO = "2026-10-14";
export const LEGAL_CONTACT = "founder@kurdistanai.app";

export const LEGAL_UI: Record<Locale, LegalUi> = {
  en: {
    updated: "Last updated",
    date: "14 October 2026",
    contents: "On this page",
    contact: "Questions? Write to us at",
    nav: { terms: "Terms", privacy: "Privacy", refund: "Refunds" },
    agree: "By creating a store you agree to the {terms} and the {privacy}.",
  },
  ku: {
    updated: "دوایین نوێکردنەوە",
    date: "١٤ی تشرینی یەکەمی ٢٠٢٦",
    contents: "لەم پەڕەیەدا",
    contact: "پرسیارت هەیە؟ بۆمان بنووسە:",
    nav: { terms: "مەرجەکان", privacy: "تایبەتمەندی", refund: "گەڕاندنەوەی پارە" },
    agree: "بە دروستکردنی فرۆشگا، ڕازی دەبیت بە {terms} و {privacy}.",
  },
  ar: {
    updated: "آخر تحديث",
    date: "14 تشرين الأول 2026",
    contents: "في هذه الصفحة",
    contact: "لديك سؤال؟ راسلنا على",
    nav: { terms: "الشروط", privacy: "الخصوصية", refund: "الاسترداد" },
    agree: "بإنشاء متجر فإنك توافق على {terms} و{privacy}.",
  },
  kmr: {
    updated: "Nûkirina dawî",
    date: "14 Cotmeh 2026",
    contents: "Di vê rûpelê de",
    contact: "Pirsek te heye? Ji me re binivîse:",
    nav: { terms: "Merc", privacy: "Nihênî", refund: "Vegerandina pere" },
    agree: "Bi avakirina firoşgehê tu bi {terms} û {privacy} razî dibî.",
  },
};

/** Link labels used inside `agree` (lower-case, sentence position). */
export const LEGAL_AGREE_LINKS: Record<Locale, { terms: string; privacy: string }> = {
  en: { terms: "Terms of Service", privacy: "Privacy Policy" },
  ku: { terms: "مەرجەکانی بەکارهێنان", privacy: "سیاسەتی تایبەتمەندی" },
  ar: { terms: "شروط الخدمة", privacy: "سياسة الخصوصية" },
  kmr: { terms: "Mercên Karûbarê", privacy: "Siyaseta Nihêniyê" },
};

/** Footer / signup copy for one locale: "{terms}" and "{privacy}" placeholders split into text and link parts. */
export function splitAgree(locale: Locale): { text: string; link?: "terms" | "privacy" }[] {
  const parts: { text: string; link?: "terms" | "privacy" }[] = [];
  const re = /\{(terms|privacy)\}/g;
  const s = LEGAL_UI[locale].agree;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) });
    const key = m[1] as "terms" | "privacy";
    parts.push({ text: LEGAL_AGREE_LINKS[locale][key], link: key });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last) });
  return parts;
}
