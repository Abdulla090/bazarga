"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/server/actions/locale";
import { UI_LOCALES, isLocale, switcherItems, type Locale } from "@/lib/i18n";
import { LanguageDropdown } from "@/components/LanguageDropdown";

/**
 * Site language control: one compact dropdown (globe + current language), same everywhere.
 * `current` comes from the server (no client i18n runtime needed, so storefronts can use it).
 * `compact` shows the short code on the trigger for tight bars (dashboard top bar, auth).
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
  return (
    <LanguageDropdown
      items={switcherItems(locales)}
      value={current}
      label={label}
      tone={tone}
      showCode={compact}
      disabled={pending}
      onSelect={(v) => {
        if (!isLocale(v)) return;
        start(async () => {
          await setLocaleAction(v);
          router.refresh();
        });
      }}
    />
  );
}
