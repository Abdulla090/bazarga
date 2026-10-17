"use client";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { LOCALE_COOKIE, UI_LOCALES, isLocale, switcherItems, type Locale } from "@/lib/i18n";
import { LanguageDropdown } from "@/components/LanguageDropdown";

/**
 * Site language control: one compact dropdown (globe + current language), same everywhere.
 * `current` comes from the server (no client i18n runtime needed, so storefronts can use it).
 * `compact` shows the short code on the trigger for tight bars (dashboard top bar, auth).
 * Snappy: the cookie is written here (same attributes setLocaleAction uses) and one router.refresh() re-renders in
 * the new language: one round trip instead of action + refresh. The trigger shows the picked language at once.
 */
export function LocaleSwitcher({ current, locales = UI_LOCALES, compact = false, label = "Language", tone = "light" }: {
  current: Locale;
  locales?: readonly Locale[];
  compact?: boolean;
  label?: string;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(current);
  return (
    <LanguageDropdown
      items={switcherItems(locales)}
      value={shown}
      label={label}
      tone={tone}
      showCode={compact}
      disabled={pending}
      onSelect={(v) => {
        if (!isLocale(v)) return;
        start(() => {
          setShown(v);
          document.cookie = `${LOCALE_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
          router.refresh();
        });
      }}
    />
  );
}
