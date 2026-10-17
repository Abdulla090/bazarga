"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Icon, Menu, X } from "@/components/ui/icons";
import type { Locale } from "@/lib/i18n";

export type NavLink = { href: string; label: string };

/**
 * Phones: the header shows logo + this button only; the sheet holds the nav links, Log in, the CTA and the language dropdown.
 * The sheet is a native popover (`popover` + `popovertarget`), so the button opens it even before the page has
 * hydrated (a phone on a slow network shows the header seconds before JS runs; the old state-only button did nothing
 * then). The browser handles toggle, Esc and tap-outside; React mirrors the state for aria-expanded, the icon and the
 * scroll lock, and closes it on navigation. It sits in the top layer, pinned under the 56px bar.
 */
export function MobileMenu({ links, login, cta, locale, locales, labels }: {
  links: NavLink[];
  login?: NavLink;
  cta?: NavLink;
  locale: Locale;
  locales: readonly Locale[];
  labels: { menu: string; close: string; language: string };
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const sync = () => setOpen(el.matches(":popover-open"));
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
    el.addEventListener("toggle", onToggle);
    sync(); // opened before hydration
    return () => el.removeEventListener("toggle", onToggle);
  }, []);
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    // Pin the sheet exactly under the sticky bar (the CSS default covers the usual 56px + safe area).
    const bar = sheet.current?.closest("[data-site-top]")?.getBoundingClientRect();
    if (bar && sheet.current) sheet.current.style.top = `${Math.max(0, bar.bottom)}px`;
    return () => { html.style.overflow = prev; };
  }, [open]);
  const hide = () => { try { sheet.current?.hidePopover(); } catch { /* already closed */ } };
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? labels.close : labels.menu}
        className="-me-2 ms-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.04] md:hidden"
        data-nav-menu-button
      >
        <Icon as={open ? X : Menu} size="1.35em" />
      </button>
      <div
        ref={sheet}
        id={id}
        popover="auto"
        data-mobile-sheet
        className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-0 m-0 h-auto max-h-none w-full max-w-none overflow-y-auto border-0 border-t border-ink/[0.08] bg-paper p-0 text-ink md:hidden"
      >
        <nav className="container-page py-2">
          <ul className="divide-y divide-ink/[0.08]">
            {[...links, ...(login ? [login] : [])].map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={hide} className="flex min-h-14 items-center text-lg font-medium text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {cta && (
            <Link href={cta.href} onClick={hide} data-menu-cta className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-ink px-5 text-base font-semibold text-paper transition-colors hover:bg-[#2563EB]">
              {cta.label}
            </Link>
          )}
          <p className="mt-6 mb-2 text-xs font-medium text-ink-50">{labels.language}</p>
          <LocaleSwitcher current={locale} locales={locales} label={labels.language} />
        </nav>
      </div>
    </>
  );
}
