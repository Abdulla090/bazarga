"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Check, ChevronDown, Globe, Icon } from "@/components/ui/icons";

const noSubscribe = () => () => {};

export type DropdownItem = { value: string; label: string; lang?: string; dir?: "rtl" | "ltr" };

/**
 * One compact language dropdown used everywhere (header, mobile sheet, auth, dashboard, storefront, landing demo).
 * Trigger: globe + current language name + chevron. Menu: role=menu with menuitemradio items, check on the current one.
 *
 * Direction-aware: the menu anchors to the trigger's inline-start edge, so in RTL (ku, ar) it opens toward the left and
 * in LTR (en, kmr) toward the right. If that would leave the viewport it flips to the inline-end edge, and its width is
 * capped at 100vw - 16px, so it never overflows at 360px. Keyboard: Enter/Space/ArrowDown open, arrows/Home/End move,
 * Esc closes and returns focus to the trigger, Tab closes (no focus trap). Outside click closes. 44px tap targets.
 * The open animation lives under motion-safe, so reduced motion gets an instant menu.
 *
 * Works before hydration (a phone on a slow network can show the page seconds before its JS runs; taps used to do
 * nothing then): the wrapper is a native <details>, so the summary opens the menu with no JS, and with `formAction`
 * each item is a submit button of a server-action form, so a pick also works with no JS. Once hydrated, React owns
 * the open state (summary clicks are intercepted) and picks go through `onSelect` without submitting.
 */
export function LanguageDropdown({
  items,
  value,
  onSelect,
  label,
  tone = "light",
  disabled = false,
  showCode = false,
  className = "",
  formAction,
  formField = "locale",
}: {
  items: readonly DropdownItem[];
  value: string;
  onSelect: (value: string) => void;
  /** Accessible name prefix, e.g. "Language". */
  label: string;
  tone?: "light" | "dark";
  disabled?: boolean;
  /** Show the short code (KU, EN) instead of the full name on the trigger (tight bars). */
  showCode?: boolean;
  className?: string;
  /** Server action the items submit to before hydration (no-JS path). */
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Form field name carrying the picked value. */
  formField?: string;
}) {
  const [open, setOpen] = useState(false);
  // false on the server and the first client render (so hydration matches): the menu markup ships in the HTML,
  // closed inside <details>, for taps that land before JS. After hydration it is only mounted while open.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [align, setAlign] = useState<"start" | "end">("start");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDetailsElement>(null);
  const btn = useRef<HTMLElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = items.find((i) => i.value === value) ?? items[0];

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  }, []);

  const openMenu = (at?: number) => {
    const idx = Math.max(0, items.findIndex((i) => i.value === value));
    setActive(at ?? idx);
    setAlign("start");
    setOpen(true);
  };

  useEffect(() => {
    // Opened natively before hydration: keep it open and take over.
    const raf = requestAnimationFrame(() => { if (box.current?.open) openMenu(); });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick the side before paint: inline-start unless that would overflow the viewport.
  useLayoutEffect(() => {
    if (!open || !box.current || !menu.current) return;
    const t = box.current.getBoundingClientRect();
    const w = menu.current.offsetWidth;
    const rtl = getComputedStyle(box.current).direction === "rtl";
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const pad = 8;
    const startFits = rtl ? t.right - w >= pad : t.left + w <= vw - pad;
    const endFits = rtl ? t.left + w <= vw - pad : t.right - w >= pad;
    setAlign(startFits || !endFits ? "start" : "end");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]")[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) close(false);
      else openMenu();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowUp" ? items.length - 1 : undefined);
    }
  };
  const onMenuKey = (e: React.KeyboardEvent) => {
    const n = items.length;
    // stopPropagation: Esc closes only this menu, not a sheet/dialog it sits in (e.g. the mobile nav sheet)
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
  };

  const dark = tone === "dark";
  const trigger = dark
    ? "border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1] focus-visible:ring-white/60"
    : "border-ink/10 bg-white text-ink hover:border-ink/20 focus-visible:ring-[#2563EB]/60";
  const panel = dark
    ? "border-white/12 bg-[#16171b] text-white shadow-[0_16px_40px_-16px_rgb(0_0_0/0.7)]"
    : "border-line bg-white text-ink shadow-[0_12px_32px_-16px_rgb(10_10_11/0.35)]";
  const item = dark ? "hover:bg-white/[0.07] focus:bg-white/[0.09]" : "hover:bg-ink/[0.04] focus:bg-[#2563EB]/[0.07]";

  const list = (
        <ul
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          data-align={align}
          className={`absolute top-full z-50 mt-2 w-max min-w-44 max-w-[calc(100vw-1rem)] rounded-xl border p-1 motion-safe:animate-[ld-in_140ms_ease-out] ${
            align === "start" ? "start-0" : "end-0"
          } ${panel}`}
        >
          {items.map((it, i) => {
            const on = it.value === value;
            return (
              <li key={it.value} role="none">
                <button
                  type={formAction ? "submit" : "button"}
                  name={formAction ? formField : undefined}
                  value={formAction ? it.value : undefined}
                  role="menuitemradio"
                  aria-checked={on}
                  tabIndex={i === active ? 0 : -1}
                  lang={it.lang}
                  onClick={(e) => { e.preventDefault(); close(); if (!on) onSelect(it.value); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-11 w-full items-center justify-between gap-6 rounded-lg px-3 text-start text-sm outline-none transition-colors ${item} ${on ? "font-semibold" : ""}`}
                >
                  <span dir={it.dir}>{it.label}</span>
                  <Icon as={Check} size="1em" className={on ? (dark ? "text-[#7aa2f7]" : "text-[#2563EB]") : "invisible"} />
                </button>
              </li>
            );
          })}
        </ul>
  );

  return (
    <details
      ref={box}
      open={open}
      className={`relative inline-block ${className}`}
      data-lang-dropdown
      data-open={open || undefined}
    >
      <summary
        ref={btn}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        // The visible code (EN/KU…) must be part of the accessible name (WCAG 2.5.3 label-in-name), as plain text:
        // axe rejects it inside parentheses, so "Language: English, EN", never "Language: English (en)".
        aria-label={showCode ? `${label}: ${current?.label ?? ""}, ${(current?.value ?? "").toUpperCase()}` : `${label}: ${current?.label ?? ""}`}
        onClick={(e: MouseEvent) => {
          e.preventDefault(); // React owns the open state once hydrated
          if (disabled) return;
          if (open) close(false);
          else openMenu();
        }}
        onKeyDown={onTriggerKey}
        className={`inline-flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 aria-disabled:opacity-60 md:min-h-9 ${trigger}`}
        data-lang-trigger
      >
        <Icon as={Globe} size="1.05em" className={dark ? "text-white/70" : "text-ink-50"} />
        {showCode ? (
          <span className="font-latin text-xs font-semibold uppercase tracking-wide" dir="ltr">{current?.value}</span>
        ) : (
          <span lang={current?.lang} dir={current?.dir}>{current?.label}</span>
        )}
        <Icon as={ChevronDown} size="0.9em" className={`opacity-60 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} />
      </summary>
      {(open || !hydrated) && (formAction ? <form action={formAction} className="contents">{list}</form> : list)}
    </details>
  );
}
