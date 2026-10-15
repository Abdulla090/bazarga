"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Icon, Menu, X } from "@/components/ui/icons";
import type { Locale } from "@/lib/i18n";

export type NavLink = { href: string; label: string };

/** Phones: the header shows logo + this button only; the sheet holds the nav links, Log in, the CTA and the language dropdown. */
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { html.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? labels.close : labels.menu}
        onClick={() => setOpen((o) => !o)}
        className="-me-2 ms-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.04] md:hidden"
        data-nav-menu-button
      >
        <Icon as={open ? X : Menu} size="1.35em" />
      </button>
      {open && (
        <div id={id} className="absolute inset-x-0 top-full h-[calc(100dvh-100%)] overflow-y-auto border-t border-ink/[0.08] bg-paper md:hidden">
          <nav className="container-page py-2">
            <ul className="divide-y divide-ink/[0.08]">
              {[...links, ...(login ? [login] : [])].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center text-lg font-medium text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            {cta && (
              <Link href={cta.href} onClick={() => setOpen(false)} data-menu-cta className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-ink px-5 text-base font-semibold text-paper transition-colors hover:bg-[#2563EB]">
                {cta.label}
              </Link>
            )}
            <p className="mt-6 mb-2 text-xs font-medium text-ink-50">{labels.language}</p>
            <LocaleSwitcher current={locale} locales={locales} label={labels.language} />
          </nav>
        </div>
      )}
    </>
  );
}
