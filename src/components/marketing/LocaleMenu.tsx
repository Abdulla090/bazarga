"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { setLocaleAction } from "@/server/actions/locale";
import { HTML_LANG, LOCALE_LABEL, type Locale } from "@/lib/i18n";
import { Check, ChevronDown, Globe, Icon } from "@/components/ui/icons";

/**
 * Marketing header language control: one compact button (globe + code) that opens a small list.
 * Closes on outside click, Escape, or a pick. Server action + refresh, same as LocaleSwitcher.
 */
export function LocaleMenu({ current, locales, label }: { current: Locale; locales: readonly Locale[]; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={box} className="relative" data-locale-menu>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${LOCALE_LABEL[current]}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-70 transition-colors hover:bg-ink/[0.04] hover:text-ink"
      >
        <Icon as={Globe} size="1.05em" />
        <span className="font-latin text-xs font-semibold uppercase tracking-wide" dir="ltr">{current}</span>
        <Icon as={ChevronDown} size="0.9em" className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul id={id} className="absolute end-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-line bg-white p-1 shadow-[0_12px_32px_-16px_rgb(10_10_11/0.35)]">
          {locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                lang={HTML_LANG[l]}
                aria-current={current === l ? "true" : undefined}
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  if (l === current) return;
                  start(async () => {
                    await setLocaleAction(l);
                    router.refresh();
                  });
                }}
                className="flex h-9 w-full items-center justify-between gap-4 rounded-lg px-3 text-start text-sm text-ink transition-colors hover:bg-ink/[0.04]"
              >
                {LOCALE_LABEL[l]}
                {current === l && <Icon as={Check} size="1em" className="text-[#2563EB]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
