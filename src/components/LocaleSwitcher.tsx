"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/server/actions/locale";
import { HTML_LANG, LOCALE_LABEL, UI_LOCALES, type Locale } from "@/lib/i18n";

/** Language buttons. `current` comes from the server (no client i18n runtime needed, so storefronts can use it). */
export function LocaleSwitcher({ current, locales = UI_LOCALES, compact = false }: { current: Locale; locales?: readonly Locale[]; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label="Language" className="flex flex-wrap items-center gap-1">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={HTML_LANG[l]}
          aria-pressed={current === l}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocaleAction(l);
              router.refresh();
            })
          }
          className={`min-h-9 rounded-full px-2.5 py-1 text-sm font-semibold transition ${
            current === l ? "bg-ink text-paper" : "text-ink-70 hover:bg-ink/5"
          }`}
        >
          {compact ? l.toUpperCase() : LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
