"use client";
import { useSyncExternalStore } from "react";
import { Icon, RotateCcw } from "@/components/ui/icons";

// Dashboard error state: inside the dashboard chrome (the layout stays), strings inline keyed by <html lang>.
const TEXT: Record<string, { msg: string; retry: string; home: string }> = {
  ckb: { msg: "ئەم بەشە بار نەبوو. داتاکانت سەلامەتن.", retry: "دووبارە هەوڵ بدەرەوە", home: "داشبۆرد" },
  ar: { msg: "تعذر تحميل هذا القسم. بياناتك بأمان.", retry: "حاول مرة أخرى", home: "لوحة التحكم" },
  en: { msg: "This section didn't load. Your data is safe.", retry: "Try again", home: "Dashboard" },
  kmr: { msg: "Ev beş nehat barkirin. Daneyên te ewle ne.", retry: "Dîsa biceribîne", home: "Dashboard" },
};
const subscribe = () => () => {};

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useSyncExternalStore(subscribe, () => document.documentElement.lang, () => "ckb");
  const t = TEXT[lang] ?? TEXT.ckb!;
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-4 py-16 text-center" data-testid="dashboard-error">
      <p className="text-lg font-semibold">{t.msg}</p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button type="button" className="btn-gold min-h-11 px-6" onClick={reset}><Icon as={RotateCcw} /> {t.retry}</button>
        <a href="/dashboard" className="btn-ghost min-h-11 px-6">{t.home}</a>
      </div>
      {error.digest ? <p className="num text-xs opacity-60" dir="ltr">ref {error.digest}</p> : null}
    </div>
  );
}
