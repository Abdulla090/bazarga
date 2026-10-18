"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { adminPaletteSearchAction } from "@/server/actions/admin";
import { AdminToaster, ConfirmHost } from "./kit";

export const ADMIN_SECTIONS = [
  { href: "/admin", key: "overview", icon: "M3 12h4v8H3zM10 4h4v16h-4zM17 9h4v11h-4z", g: "o" },
  { href: "/admin/users", key: "users", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", g: "u" },
  { href: "/admin/stores", key: "stores", icon: "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6", g: "s" },
  { href: "/admin/catalog", key: "catalog", icon: "M4 4h16v4H4zM4 12h16v8H4zM9 16h6", g: "m" },
  { href: "/admin/plans", key: "plans", icon: "M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z", g: "p" },
  { href: "/admin/site", key: "site", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z", g: "c" },
  { href: "/admin/growth", key: "growth", icon: "M3 17l6-6 4 4 8-8M14 7h7v7", g: "w" },
  { href: "/admin/payments", key: "payments", icon: "M2 6h20v12H2zM2 10h20M6 15h4", g: "y" },
  { href: "/admin/audit", key: "audit", icon: "M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01", g: "a" },
  { href: "/admin/settings", key: "settings", icon: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z", g: "t" },
] as const;

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AdminShell({ children, admin }: { children: ReactNode; admin: { email: string; role: string } }) {
  const t = useTranslations("admin");
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const [palette, setPalette] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); return; }
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      // "g" then a letter jumps to a section (g u = users, g s = stores …).
      if (e.key === "g") { armed = Date.now(); return; }
      if (armed && Date.now() - armed < 1200) {
        armed = 0;
        const s = ADMIN_SECTIONS.find((x) => x.g === e.key.toLowerCase());
        if (s) router.push(s.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <AdminToaster>
      <ConfirmHost>
        <div className="min-h-dvh bg-[#F6F7F9] text-ink" data-testid="admin-shell">
          <header className="sticky top-0 z-30 border-b border-line bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
            <div className="flex h-14 items-center gap-3 px-4 md:px-6">
              <Link href="/admin" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight">
                <span className="grid size-8 place-items-center rounded-lg bg-ink text-[13px] font-bold text-white">R</span>
                <span className="hidden sm:inline">{t("title")}</span>
              </Link>
              <span className="hidden rounded-full bg-[#EFF4FF] px-2.5 py-0.5 text-xs font-medium text-[#1D4ED8] sm:inline" data-testid="admin-role">{t(`u.role.${admin.role}`)}</span>
              <button
                type="button"
                onClick={() => setPalette(true)}
                data-testid="palette-open"
                className="ms-auto flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-white px-3 text-sm text-ink-50 hover:border-ink/30 sm:min-w-64"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span className="hidden sm:inline">{t("k.placeholder")}</span>
                <kbd className="ms-auto hidden rounded border border-line px-1.5 text-[11px] sm:inline" dir="ltr">{t("k.hint")}</kbd>
                <span className="sr-only sm:hidden">{t("k.open")}</span>
              </button>
              <Link href="/dashboard" className="hidden min-h-11 items-center rounded-full px-3 text-sm text-ink-70 hover:text-ink md:inline-flex">{t("backToApp")}</Link>
            </div>
            {/* Phones: horizontally scrolling section tabs. */}
            <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label={t("subtitle")}>
              {ADMIN_SECTIONS.map((s) => (
                <Link key={s.href} href={s.href} aria-current={active(s.href) ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-sm ${active(s.href) ? "bg-ink text-white" : "text-ink-70"}`}>
                  {t(`nav.${s.key}`)}
                </Link>
              ))}
            </nav>
          </header>
          <div className="mx-auto flex max-w-[1400px]">
            <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-e border-line bg-white px-3 py-4 md:flex" aria-label={t("subtitle")}>
              {ADMIN_SECTIONS.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={active(s.href) ? "page" : undefined}
                  className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active(s.href) ? "bg-[#EFF4FF] font-medium text-[#1D4ED8]" : "text-ink-70 hover:bg-[#F6F7F9] hover:text-ink"}`}
                >
                  <Ico d={s.icon} />
                  {t(`nav.${s.key}`)}
                  <kbd className="ms-auto text-[10px] text-ink-50 opacity-0 transition group-hover:opacity-100" dir="ltr">g {s.g}</kbd>
                </Link>
              ))}
              <p className="mt-auto truncate px-3 pt-4 text-xs text-ink-50" dir="ltr">{admin.email}</p>
            </aside>
            <main className="min-w-0 flex-1 px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8">{children}</main>
          </div>
          {palette && <Palette onClose={() => setPalette(false)} />}
        </div>
      </ConfirmHost>
    </AdminToaster>
  );
}

type Hit = { href: string; label: string; sub?: string | null; kind: string };

function Palette({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [remote, setRemote] = useState<Hit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let live = true;
    const id = setTimeout(async () => {
      const rows = await adminPaletteSearchAction(term);
      if (live) setRemote(rows.map((r) => ({ href: r.kind === "user" ? `/admin/users/${r.id}` : `/admin/stores/${r.id}`, label: r.label, sub: r.sub, kind: r.kind === "user" ? t("nav.users") : t("nav.stores") })));
    }, 180);
    return () => { live = false; clearTimeout(id); };
  }, [q, t]);
  const sections: Hit[] = useMemo(
    () => ADMIN_SECTIONS.map((s) => ({ href: s.href, label: t(`nav.${s.key}`), kind: "g " + s.g })).filter((s) => !q || s.label.toLowerCase().includes(q.toLowerCase())),
    [q, t],
  );
  const items = [...(q.trim().length >= 2 ? remote : []), ...sections];
  const go = (h: Hit) => { onClose(); router.push(h.href); };
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/40 px-4 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("k.open")} data-testid="admin-palette" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && items[idx]) { e.preventDefault(); go(items[idx]!); }
          }}
          placeholder={t("k.placeholder")}
          aria-label={t("k.placeholder")}
          data-testid="palette-input"
          className="h-14 w-full border-b border-line px-4 text-[15px] outline-none"
        />
        <ul className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-50">{t("k.empty")}</li>}
          {items.map((h, i) => (
            <li key={h.href + i} role="option" aria-selected={i === idx}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm ${i === idx ? "bg-[#EFF4FF] text-[#1D4ED8]" : "text-ink"}`}>
                <span className="min-w-0 flex-1 truncate">{h.label}{h.sub ? <span className="text-ink-50"> · {h.sub}</span> : null}</span>
                <span className="shrink-0 text-xs text-ink-50">{h.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
