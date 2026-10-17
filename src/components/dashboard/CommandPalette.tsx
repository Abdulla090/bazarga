"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PALETTE_ITEMS, filterPalette, goShortcutTarget } from "@/lib/dash-nav-items";

export function CommandPalette() {
  const t = useTranslations("dash");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => filterPalette(PALETTE_ITEMS.map((i) => ({ href: i.href, label: t(i.key) })), q), [q, t]);

  useEffect(() => {
    let armed = 0;
    const onGo = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key.toLowerCase() === "g") { armed = Date.now(); return; }
      if (armed && Date.now() - armed < 1200) {
        const to = goShortcutTarget(e.key);
        armed = 0;
        if (to) router.push(to);
      }
    };
    window.addEventListener("keydown", onGo);
    return () => window.removeEventListener("keydown", onGo);
  }, [router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setIdx(0);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!open) return null;
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/40 px-4 pt-[15vh] print:hidden" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label={t("cmdkTitle")} data-testid="command-palette" className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper shadow-xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && items[idx]) go(items[idx].href);
          }}
          placeholder={t("cmdkPlaceholder")}
          aria-label={t("cmdkPlaceholder")}
          className="min-h-12 w-full border-b border-line bg-transparent px-4 text-[15px] leading-relaxed text-ink outline-none"
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-4 text-sm leading-relaxed text-ink/60">{t("cmdkEmpty")}</li>}
          {items.map((i, n) => (
            <li key={i.href}>
              <button type="button" onClick={() => go(i.href)} onMouseEnter={() => setIdx(n)} className={`flex min-h-11 w-full items-center rounded-lg px-3 text-start text-[14px] leading-relaxed text-ink ${n === idx ? "bg-ink/[0.06]" : ""}`}>
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
