"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type CSSProperties, type MouseEvent } from "react";
import { ChevronForward } from "@/components/ui/icons";
import { HTML_LANG, LOCALE_COOKIE, SWITCHER_LABEL, SWITCHER_ORDER, type Locale } from "@/lib/i18n";
import { setLocaleFormAction } from "@/server/actions/locale";
import "./mobile-menu.css";

export type NavLink = { href: string; label: string };

const REFRESH_FALLBACK_MS = 6000;
/** Same attributes setLocaleAction uses. Throws where cookies are blocked (then the form post takes over). */
function writeLocaleCookie(v: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Phones (<768px): the header shows logo + this button; the sheet holds the nav, the language control, "Start free"
 * and Log in. Oct 18 redesign: a white panel slides in from the inline-end side (right in LTR, left in RTL) under the
 * sticky bar on a dimmed, blurred scrim; rows stagger in blur-to-sharp; the hamburger morphs into an X.
 *
 * Nothing here is JS-fragile (works in Brave with Shields, and before hydration): the sheet is a native popover
 * (`popover="auto"` + `popovertarget`), so the browser opens/closes it, handles Esc and outside taps, and restores
 * focus to the button. The scrim is a native `popovertargetaction="hide"` button. The X morph, the body scroll lock
 * and every animation are CSS (`:popover-open`, `:has()`, @starting-style, transition-behavior: allow-discrete);
 * engines without those just open/close instantly. The language picks are submit buttons of a server-action form,
 * so they work with no JS. React only enhances: aria-expanded, a focus trap, closing on navigation, and a client-side
 * language switch without a full reload. Reduced motion: a plain fade.
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
  const [shown, setShown] = useState<Locale>(locale);
  const [, start] = useTransition();
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = () => {
    try {
      sheet.current?.hidePopover();
    } catch {
      /* already closed / no popover support */
    }
  };

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
    el.addEventListener("toggle", onToggle);
    try {
      setOpen(el.matches(":popover-open")); // opened before hydration
    } catch {
      /* :popover-open unsupported */
    }
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  // close on route change
  useEffect(() => {
    hide();
  }, [pathname]);

  useEffect(() => () => clearTimeout(fallback.current), []);

  useEffect(() => {
    if (!open) return;
    // Pin the sheet exactly under the sticky bar (CSS covers the usual 56px + 1px hairline + safe area).
    const bar = sheet.current?.closest("[data-site-top]")?.getBoundingClientRect();
    if (bar && sheet.current) sheet.current.style.setProperty("--mm-top", `${Math.max(0, Math.round(bar.bottom))}px`);
    // focus trap: Tab cycles the sheet's controls and the X button
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !sheet.current || !btn.current) return;
      const items = [btn.current, ...sheet.current.querySelectorAll<HTMLElement>(`.mm-panel ${FOCUSABLE}`)];
      const at = items.indexOf(document.activeElement as HTMLElement);
      const to = at < 0 ? 0 : (at + (e.shiftKey ? -1 : 1) + items.length) % items.length;
      e.preventDefault();
      items[to]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const pickLocale = (e: MouseEvent<HTMLButtonElement>, v: Locale) => {
    e.preventDefault();
    if (v === shown) return;
    setShown(v);
    try {
      writeLocaleCookie(v);
    } catch {
      /* cookies blocked: fall back to the form post */
      e.currentTarget.form?.requestSubmit(e.currentTarget);
      return;
    }
    clearTimeout(fallback.current);
    fallback.current = setTimeout(() => {
      if (document.documentElement.lang !== HTML_LANG[v]) location.reload();
    }, REFRESH_FALLBACK_MS);
    start(() => router.refresh());
    window.setTimeout(hide, 160);
  };

  const rows = links;
  const order = SWITCHER_ORDER.filter((l) => locales.includes(l));
  const isActive = (href: string) => !href.includes("#") && (pathname === href || (href !== "/" && pathname?.startsWith(href + "/")));
  let n = 0;
  const step = () => ({ "--mm-i": n++ }) as CSSProperties;

  return (
    <>
      <button
        ref={btn}
        type="button"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? labels.close : labels.menu}
        className="mm-burger -me-2 ms-auto md:hidden"
        data-nav-menu-button
      >
        <span className="mm-burger-box" aria-hidden="true">
          <span className="mm-line mm-line-a" />
          <span className="mm-line mm-line-b" />
        </span>
      </button>
      <div ref={sheet} id={id} popover="auto" data-mobile-sheet className="mm-sheet md:hidden">
        <button type="button" className="mm-scrim" popoverTarget={id} popoverTargetAction="hide" tabIndex={-1} aria-label={labels.close} data-mm-scrim />
        <div className="mm-panel" role="dialog" aria-modal="true" aria-label={labels.menu}>
          <nav className="mm-body" aria-label={labels.menu}>
            <ul className="mm-list">
              {rows.map((l) => (
                <li key={l.href} className="mm-item" style={step()}>
                  <Link href={l.href} onClick={hide} className="mm-row" data-active={isActive(l.href) || undefined} aria-current={isActive(l.href) ? "page" : undefined}>
                    <span className="mm-row-label">{l.label}</span>
                    <ChevronForward className="mm-chev" size="1.1em" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mm-item mm-lang" style={step()}>
              <p className="mm-label" id={`${id}-lang`}>{labels.language}</p>
              <form action={setLocaleFormAction} className="mm-seg" role="group" aria-labelledby={`${id}-lang`} data-menu-lang>
                {order.map((l) => (
                  <button
                    key={l}
                    type="submit"
                    name="locale"
                    value={l}
                    lang={HTML_LANG[l]}
                    dir={l === "ku" || l === "ar" ? "rtl" : "ltr"}
                    aria-pressed={shown === l}
                    className="mm-seg-btn"
                    data-locale={l}
                    onClick={(e) => pickLocale(e, l)}
                  >
                    {SWITCHER_LABEL[l]}
                  </button>
                ))}
              </form>
            </div>
          </nav>

          <div className="mm-foot">
            {cta && (
              <Link href={cta.href} onClick={hide} data-menu-cta className="mm-item mm-cta" style={step()}>
                {cta.label}
              </Link>
            )}
            {login && (
              <Link href={login.href} onClick={hide} data-menu-login className="mm-item mm-login" style={step()}>
                {login.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
