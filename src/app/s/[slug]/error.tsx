"use client";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

// Storefront error state (Layout v3 §6): one display-type statement and one action, inside the store's own chrome.
// Strings inline (keyed by <html lang>) so no i18n runtime ships to the browser.
const TEXT: Record<string, { msg: string; retry: string; home: string }> = {
  ckb: { msg: "شتێک بە هەڵەدا چوو.", retry: "دووبارە هەوڵ بدەرەوە", home: "گەڕانەوە بۆ دوکان" },
  ar: { msg: "حدث خطأ ما.", retry: "حاول مرة أخرى", home: "العودة إلى المتجر" },
  en: { msg: "Something went wrong.", retry: "Try again", home: "Back to the store" },
  kmr: { msg: "Tiştek xelet çû.", retry: "Dîsa biceribîne", home: "Vegere firoşgehê" },
};
const subscribe = () => () => {};

export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useSyncExternalStore(subscribe, () => document.documentElement.lang, () => "ckb");
  const t = TEXT[lang] ?? TEXT.ckb!;
  const home = usePathname().split("/").slice(0, 3).join("/");
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-8 py-16 text-center sm:py-24" data-testid="store-error">
      <p className="t-display">{t.msg}</p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button type="button" className="btn-gold min-h-12 px-8" onClick={reset}>{t.retry}</button>
        <a href={home} className="btn-ghost min-h-12 px-8">{t.home}</a>
      </div>
    </div>
  );
}
