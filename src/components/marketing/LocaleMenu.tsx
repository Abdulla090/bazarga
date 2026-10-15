"use client";
import type { Locale } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

/** Marketing header language control (desktop): the shared language dropdown. */
export function LocaleMenu({ current, locales, label }: { current: Locale; locales: readonly Locale[]; label: string }) {
  return (
    <div data-locale-menu>
      <LocaleSwitcher current={current} locales={locales} label={label} />
    </div>
  );
}
