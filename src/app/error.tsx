"use client";
import { useSyncExternalStore } from "react";
import { Icon, RotateCcw } from "@/components/ui/icons";

// The root error boundary ships on every route, storefronts included, so it carries its few strings inline
// instead of pulling the i18n runtime into the shared bundle. Keyed by <html lang> (set by the root layout).
const TEXT: Record<string, { msg: string; retry: string }> = {
  ckb: { msg: "هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.", retry: "دووبارە هەوڵ بدەرەوە" },
  ar: { msg: "حدث خطأ ما. يرجى المحاولة مرة أخرى.", retry: "حاول مرة أخرى" },
  en: { msg: "Something went wrong. Please try again.", retry: "Try again" },
  kmr: { msg: "Tiştek xelet çû. Ji kerema xwe dîsa biceribîne.", retry: "Dîsa biceribîne" },
};

const subscribe = () => () => {};

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useSyncExternalStore(subscribe, () => document.documentElement.lang, () => "ckb");
  const t = TEXT[lang] ?? TEXT.ckb!;
  return (
    <main className="container-page flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-semibold">{t.msg}</p>
      <button className="btn-gold" onClick={reset}>
        <Icon as={RotateCcw} /> {t.retry}
      </button>
    </main>
  );
}
