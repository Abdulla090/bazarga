"use client";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { HTML_LANG, LOCALE_COOKIE, UI_LOCALES, isLocale, switcherItems, type Locale } from "@/lib/i18n";
import { LanguageDropdown } from "@/components/LanguageDropdown";
import { setLocaleFormAction } from "@/server/actions/locale";

/** How long a router.refresh may take to bring the page into the picked language before we fall back to a reload. */
const REFRESH_FALLBACK_MS = 6000;

/**
 * Site language control: one compact dropdown (globe + current language), same everywhere.
 * `current` comes from the server (no client i18n runtime needed, so storefronts can use it).
 * `compact` shows the short code on the trigger for tight bars (dashboard top bar, auth).
 * Snappy: the cookie is written here (same attributes setLocaleAction uses) and one router.refresh() re-renders in
 * the new language: one round trip instead of action + refresh. The trigger shows the picked language at once.
 * Robust on phones: the trigger stays tappable while a switch is in flight (a later pick wins), a refresh that has
 * not changed <html lang> after a few seconds becomes a full reload, and before hydration the dropdown falls back
 * to a native <details> + server-action form (see LanguageDropdown).
 */
export function LocaleSwitcher({ current, locales = UI_LOCALES, compact = false, label = "Language", tone = "light" }: {
  current: Locale;
  locales?: readonly Locale[];
  compact?: boolean;
  label?: string;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [shown, setShown] = useOptimistic(current);
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fallback.current), []);
  return (
    <LanguageDropdown
      items={switcherItems(locales)}
      value={shown}
      label={label}
      tone={tone}
      showCode={compact}
      formAction={setLocaleFormAction}
      onSelect={(v) => {
        if (!isLocale(v)) return;
        document.cookie = `${LOCALE_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
        clearTimeout(fallback.current);
        fallback.current = setTimeout(() => {
          if (document.documentElement.lang !== HTML_LANG[v]) location.reload();
        }, REFRESH_FALLBACK_MS);
        start(() => {
          setShown(v);
          router.refresh();
        });
      }}
    />
  );
}
