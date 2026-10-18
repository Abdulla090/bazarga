"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { adminPaletteSearchAction } from "@/server/actions/admin";
import { AdminToaster, ConfirmHost } from "./kit";

/** Sidebar groups (docs/ADMIN.md). `owner` items are hidden from plain admins (their pages 404 for them too). */
export const ADMIN_GROUPS = [
  { key: "overview", items: [{ href: "/admin", key: "overview", g: "o" }] },
  { key: "people", items: [{ href: "/admin/users", key: "users", g: "u" }, { href: "/admin/settings", key: "settings", g: "t" }] },
  {
    key: "commerce",
    items: [
      { href: "/admin/stores", key: "stores", g: "s" },
      { href: "/admin/products", key: "products", g: "p" },
      { href: "/admin/orders", key: "orders", g: "r" },
      { href: "/admin/plans", key: "plans", g: "l" },
      { href: "/admin/payments", key: "payments", g: "y" },
    ],
  },
  { key: "growth", items: [{ href: "/admin/growth", key: "growth", g: "w" }] },
  {
    key: "system",
    items: [
      { href: "/admin/site", key: "site", g: "c" },
      { href: "/admin/database", key: "database", g: "d", owner: true },
      { href: "/admin/audit", key: "audit", g: "a" },
      { href: "/admin/health", key: "health", g: "h" },
    ],
  },
] as const satisfies readonly { key: string; items: readonly { href: string; key: string; g: string; owner?: boolean }[] }[];

type Section = { href: string; key: string; g: string; owner?: boolean };
export const ADMIN_SECTIONS: readonly Section[] = ADMIN_GROUPS.flatMap((g) => g.items as readonly Section[]);

const ICONS: Record<string, string> = {"overview": "M3 12h4v8H3zM10 4h4v16h-4zM17 9h4v11h-4z", "users": "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", "settings": "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z", "stores": "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6", "products": "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8", "orders": "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4", "plans": "M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z", "payments": "M2 6h20v12H2zM2 10h20M6 15h4", "growth": "M3 17l6-6 4 4 8-8M14 7h7v7", "site": "M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6", "database": "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3", "audit": "M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01", "health": "M22 12h-4l-3 9L9 3l-3 9H2"};

function Ico({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[k] ?? ""} />
    </svg>
  );
}

function NavList({ role, active, onPick }: { role: string; active: (href: string) => boolean; onPick?: () => void }) {
  const t = useTranslations("admin");
  return (
    <>
      {ADMIN_GROUPS.map((g) => {
        const items = (g.items as readonly Section[]).filter((s) => !s.owner || role === "owner");
        if (!items.length) return null;
        return (
          <div key={g.key} className="mb-3">
            {g.key !== "overview" && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-50">{t(`navGroup.${g.key}`)}</p>}
            {items.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                onClick={onPick}
                data-testid={`nav-${s.key}`}
                aria-current={active(s.href) ? "page" : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active(s.href) ? "bg-[#EFF4FF] font-medium text-[#1D4ED8]" : "text-ink-70 hover:bg-[#F6F7F9] hover:text-ink"}`}
              >
                <Ico k={s.key} />
                <span className="min-w-0 flex-1 truncate">{t(`nav.${s.key}`)}</span>
                <kbd className="hidden text-[10px] text-ink-50 opacity-0 transition group-hover:opacity-100 md:inline" dir="ltr">g {s.g}</kbd>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}

export function AdminShell({ children, admin }: { children: ReactNode; admin: { email: string; role: string } }) {
  const t = useTranslations("admin");
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); return; }
      if (e.key === "Escape") setDrawer(false);
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      // "g" then a letter jumps to a section (g u = users, g s = stores …).
      if (e.key === "g") { armed = Date.now(); return; }
      if (armed && Date.now() - armed < 1200) {
        armed = 0;
        const s = ADMIN_SECTIONS.find((x) => x.g === e.key.toLowerCase() && (!x.owner || admin.role === "owner"));
        if (s) router.push(s.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, admin.role]);

  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [drawer]);

  return (
    <AdminToaster>
      <ConfirmHost>
        <div className="min-h-dvh overflow-x-clip bg-[#F7F8FA] text-ink" data-testid="admin-shell">
          <header className="sticky top-0 z-30 border-b border-line bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
            <div className="flex h-14 items-center gap-2 px-3 md:gap-3 md:px-6">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                aria-label={t("nav.menu")}
                aria-expanded={drawer}
                data-testid="admin-menu"
                className="grid size-11 place-items-center rounded-xl text-ink-70 hover:bg-[#F6F7F9] md:hidden"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </button>
              <Link href="/admin" className="flex min-h-11 min-w-11 items-center gap-2 font-semibold tracking-tight">
                <span className="grid size-8 place-items-center rounded-lg bg-ink text-[13px] font-bold text-white">R</span>
                <span className="hidden sm:inline">{t("title")}</span>
              </Link>
              <span className="hidden rounded-full bg-[#EFF4FF] px-2.5 py-0.5 text-xs font-medium text-[#1D4ED8] sm:inline" data-testid="admin-role">{t(`u.role.${admin.role}`)}</span>
              <button
                type="button"
                onClick={() => setPalette(true)}
                data-testid="palette-open"
                className="ms-auto flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-3 text-sm text-ink-50 hover:border-ink/30 sm:min-w-64 sm:justify-start"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span className="hidden sm:inline">{t("k.placeholder")}</span>
                <kbd className="ms-auto hidden rounded border border-line px-1.5 text-[11px] sm:inline" dir="ltr">{t("k.hint")}</kbd>
                <span className="sr-only sm:hidden">{t("k.open")}</span>
              </button>
              <Link href="/dashboard" className="hidden min-h-11 items-center rounded-full px-3 text-sm text-ink-70 hover:text-ink lg:inline-flex">{t("backToApp")}</Link>
            </div>
          </header>
          <div className="mx-auto flex max-w-[1440px]">
            <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col overflow-y-auto border-e border-line bg-white px-3 py-4 md:flex" aria-label={t("subtitle")}>
              <nav aria-label={t("subtitle")}><NavList role={admin.role} active={active} /></nav>
              <p className="mt-auto truncate px-3 pt-4 text-xs text-ink-50" dir="ltr">{admin.email}</p>
            </aside>
            <main className="min-w-0 flex-1 px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:py-8">{children}</main>
          </div>
          {drawer && (
            <div className="fixed inset-0 z-[70] md:hidden" data-testid="admin-drawer">
              <button type="button" aria-label={t("c.close")} className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
              <div role="dialog" aria-modal="true" aria-label={t("subtitle")} className="absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col bg-white pt-[env(safe-area-inset-top)] shadow-2xl">
                <div className="flex h-14 items-center justify-between border-b border-line px-3">
                  <span className="flex items-center gap-2 px-1 font-semibold tracking-tight">
                    <span className="grid size-8 place-items-center rounded-lg bg-ink text-[13px] font-bold text-white">R</span>
                    {t("title")}
                  </span>
                  <button type="button" onClick={() => setDrawer(false)} aria-label={t("c.close")} className="grid size-11 place-items-center rounded-xl text-ink-70 hover:bg-[#F6F7F9]">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={t("subtitle")}><NavList role={admin.role} active={active} onPick={() => setDrawer(false)} /></nav>
                <div className="border-t border-line px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  <Link href="/dashboard" className="flex min-h-11 items-center rounded-xl px-3 text-sm text-ink-70 hover:bg-[#F6F7F9]">{t("backToApp")}</Link>
                  <p className="truncate px-3 text-xs text-ink-50" dir="ltr">{admin.email}</p>
                </div>
              </div>
            </div>
          )}
          {palette && <Palette onClose={() => setPalette(false)} role={admin.role} />}
        </div>
      </ConfirmHost>
    </AdminToaster>
  );
}

type Hit = { href: string; label: string; sub?: string | null; kind: string };

function Palette({ onClose, role }: { onClose: () => void; role: string }) {
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
    () => ADMIN_SECTIONS.filter((s) => !s.owner || role === "owner").map((s) => ({ href: s.href, label: t(`nav.${s.key}`), kind: "g " + s.g })).filter((s) => !q || s.label.toLowerCase().includes(q.toLowerCase())),
    [q, t, role],
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
