"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Icon } from "@/components/ui/icons";

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
}) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"start" | "end">("start");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
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
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
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

  return (
    <div ref={box} className={`relative inline-block ${className}`} data-lang-dropdown data-open={open || undefined}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        // The visible code (EN/KU…) must be part of the accessible name (WCAG 2.5.3 label-in-name).
        aria-label={showCode ? `${label}: ${current?.label ?? ""} (${current?.value ?? ""})` : `${label}: ${current?.label ?? ""}`}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKey}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 disabled:opacity-60 md:min-h-9 ${trigger}`}
        data-lang-trigger
      >
        <Icon as={Globe} size="1.05em" className={dark ? "text-white/70" : "text-ink-50"} />
        {showCode ? (
          <span className="font-latin text-xs font-semibold uppercase tracking-wide" dir="ltr">{current?.value}</span>
        ) : (
          <span lang={current?.lang} dir={current?.dir}>{current?.label}</span>
        )}
        <Icon as={ChevronDown} size="0.9em" className={`opacity-60 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
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
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  tabIndex={i === active ? 0 : -1}
                  lang={it.lang}
                  onClick={() => { close(); if (!on) onSelect(it.value); }}
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
      )}
    </div>
  );
}
