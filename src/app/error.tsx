"use client";
import { useSyncExternalStore } from "react";
import { Icon, RotateCcw } from "@/components/ui/icons";

// The root error boundary ships on every route, storefronts included, so it carries its few strings inline
// instead of pulling the i18n runtime into the shared bundle. Keyed by <html lang> (set by the root layout).
const TEXT: Record<string, { msg: string; retry: string; home: string; help: string }> = {
  ckb: { msg: "هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.", retry: "دووبارە هەوڵ بدەرەوە", home: "پەڕەی سەرەکی", help: "هێشتا کێشەکە ماوە؟ پەیوەندیمان پێوە بکە" },
  ar: { msg: "حدث خطأ ما. يرجى المحاولة مرة أخرى.", retry: "حاول مرة أخرى", home: "الصفحة الرئيسية", help: "المشكلة مستمرة؟ تواصل معنا" },
  en: { msg: "Something went wrong. Please try again.", retry: "Try again", home: "Home", help: "Still stuck? Contact us" },
  kmr: { msg: "Tiştek xelet çû. Ji kerema xwe dîsa biceribîne.", retry: "Dîsa biceribîne", home: "Rûpela sereke", help: "Hê jî pirsgirêk heye? Têkilî bi me re bigire" },
};

const subscribe = () => () => {};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useSyncExternalStore(subscribe, () => document.documentElement.lang, () => "ckb");
  const t = TEXT[lang] ?? TEXT.ckb!;
  return (
    <main className="container-page flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center" data-testid="error-page">
      <p className="text-lg font-semibold">{t.msg}</p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button className="btn-gold min-h-11 px-6" onClick={reset}>
          <Icon as={RotateCcw} /> {t.retry}
        </button>
        <a href="/" className="btn-ghost min-h-11 px-6">{t.home}</a>
      </div>
      <a href="mailto:founder@kurdistanai.app" className="text-sm underline" dir="ltr">{t.help}: founder@kurdistanai.app</a>
      {error.digest ? <p className="num text-xs opacity-60" dir="ltr">ref {error.digest}</p> : null}
    </main>
  );
}
