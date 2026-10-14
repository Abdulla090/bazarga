/**
 * Strings for client error boundaries. Error boundaries ship on every route (storefronts included), so they carry
 * these few strings inline instead of pulling the i18n runtime into the shared bundle. Keyed by <html lang>
 * (the root layout writes ckb | ar | en | kmr). Must stay in sync across the 4 locales (tests/error-pages.test.ts).
 */
export type ErrorText = { eyebrow: string; title: string; body: string; retry: string; home: string; dashboard: string; dashBody: string; help: string; ref: string };

export const ERROR_TEXT: Record<"ckb" | "ar" | "en" | "kmr", ErrorText> = {
  ckb: {
    eyebrow: "هەڵەی ٥٠٠",
    title: "شتێک بە هەڵەدا چوو",
    body: "کێشەکە لای ئێمەیە، نەک تۆ. تکایە دووبارە هەوڵ بدەرەوە.",
    retry: "دووبارە هەوڵ بدەرەوە",
    home: "پەڕەی سەرەکی",
    dashboard: "داشبۆرد",
    dashBody: "ئەم بەشە بار نەبوو. داتاکانت سەلامەتن.",
    help: "هێشتا کێشەکە ماوە؟",
    ref: "ژمارەی سەرچاوە",
  },
  ar: {
    eyebrow: "خطأ 500",
    title: "حدث خطأ ما",
    body: "المشكلة من جهتنا وليست منك. يرجى المحاولة مرة أخرى.",
    retry: "حاول مرة أخرى",
    home: "الصفحة الرئيسية",
    dashboard: "لوحة التحكم",
    dashBody: "تعذر تحميل هذا القسم. بياناتك بأمان.",
    help: "المشكلة مستمرة؟",
    ref: "رقم المرجع",
  },
  en: {
    eyebrow: "Error 500",
    title: "Something went wrong",
    body: "The problem is on our side, not yours. Please try again.",
    retry: "Try again",
    home: "Homepage",
    dashboard: "Dashboard",
    dashBody: "This section didn’t load. Your data is safe.",
    help: "Still stuck?",
    ref: "Reference",
  },
  kmr: {
    eyebrow: "Çewtiya 500",
    title: "Tiştek xelet çû",
    body: "Pirsgirêk li aliyê me ye, ne li aliyê te. Ji kerema xwe dîsa biceribîne.",
    retry: "Dîsa biceribîne",
    home: "Rûpela sereke",
    dashboard: "Dashboard",
    dashBody: "Ev beş nehat barkirin. Daneyên te ewle ne.",
    help: "Hê jî pirsgirêk heye?",
    ref: "Referans",
  },
};

export function errorText(lang: string | undefined): ErrorText {
  return ERROR_TEXT[(lang ?? "ckb") as keyof typeof ERROR_TEXT] ?? ERROR_TEXT.ckb;
}
