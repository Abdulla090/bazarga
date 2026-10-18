"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export type ActionResult = { ok?: boolean; error?: string; data?: Record<string, string | number | boolean> };

// ---------------------------------------------------------------- toasts
type Toast = { id: number; text: string; tone: "ok" | "err" };
let toastSeq = 0;
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function AdminToaster({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = ++toastSeq;
    setList((l) => [...l.slice(-3), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} role="status" data-testid="admin-toast" className={`pointer-events-auto rounded-full px-5 py-3 text-sm font-medium shadow-lg ${t.tone === "ok" ? "bg-ink text-white" : "bg-[#B42318] text-white"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Run a server action with a toast, then refresh the server data. Returns the result for optimistic rollbacks. */
export function useAdminAction() {
  const t = useTranslations("admin");
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    async (fn: () => Promise<ActionResult>, okText?: string): Promise<ActionResult> => {
      let res: ActionResult;
      try {
        res = await fn();
      } catch {
        res = { ok: false, error: "generic" };
      }
      if (res.ok) {
        toast(okText ?? t("c.saved"));
        start(() => router.refresh());
      } else {
        const key = `err.${res.error ?? "generic"}`;
        toast(t.has(key) ? t(key) : t("c.failed"), "err");
      }
      return res;
    },
    [router, t, toast],
  );
  return { run, pending };
}

// ---------------------------------------------------------------- buttons, badges, fields
const BTN = {
  primary: "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
  ink: "bg-ink text-white hover:bg-ink/85",
  ghost: "border border-line bg-white text-ink hover:border-ink/30",
  danger: "border border-[#B42318]/30 bg-white text-[#B42318] hover:bg-[#FEF3F2]",
} as const;

export function Btn({ tone = "ghost", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof BTN }) {
  return <button type="button" {...p} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${BTN[tone]} ${className}`} />;
}

const BADGE = {
  blue: "bg-[#EFF4FF] text-[#1D4ED8]",
  green: "bg-[#ECFDF3] text-[#067647]",
  amber: "bg-[#FFFAEB] text-[#B54708]",
  red: "bg-[#FEF3F2] text-[#B42318]",
  gray: "bg-[#F2F4F7] text-ink-70",
  ink: "bg-ink text-white",
} as const;
export function Badge({ tone = "gray", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}

export const inputCls = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-50">{hint}</span>}
    </label>
  );
}

export function Switch({ on, onChange, label, testId, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="group inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50"
    >
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-[#2563EB]" : "bg-[#D0D5DD]"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "start-[1.375rem]" : "start-0.5"}`} />
      </span>
    </button>
  );
}

export function Card({ title, action, children, className = "", testId }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={`rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- step-up confirmation dialog
export type ConfirmSpec = { title: string; body?: string; expected?: string | null; confirmLabel: string; tone?: "danger" | "primary"; onConfirm: (proof: { confirm?: string; password?: string }) => Promise<ActionResult | void> };
const ConfirmCtx = createContext<(spec: ConfirmSpec) => void>(() => {});
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmHost({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const [spec, setSpec] = useState<ConfirmSpec | null>(null);
  const [typed, setTyped] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (spec) setTimeout(() => ref.current?.focus(), 30);
  }, [spec]);
  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setSpec(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spec, busy]);
  const open = useCallback((s: ConfirmSpec) => { setTyped(""); setPw(""); setSpec(s); }, []);
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const ready = !spec?.expected || norm(typed) === norm(spec.expected) || pw.length > 0;
  return (
    <ConfirmCtx.Provider value={open}>
      {children}
      {spec && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={() => !busy && setSpec(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label={spec.title}
            data-testid="confirm-dialog"
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ready) return;
              setBusy(true);
              const res = await spec.onConfirm({ confirm: typed || undefined, password: pw || undefined });
              setBusy(false);
              if (!res || res.ok) setSpec(null);
            }}
          >
            <h2 className="text-lg font-semibold tracking-tight text-ink">{spec.title}</h2>
            {spec.body && <p className="mt-1 text-sm text-ink-70">{spec.body}</p>}
            {spec.expected && (
              <div className="mt-4 space-y-3">
                <Field label={t("confirm.type", { value: spec.expected })}>
                  <input ref={ref} data-testid="confirm-input" className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} dir="ltr" />
                </Field>
                <Field label={t("confirm.orPassword")}>
                  <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder={t("confirm.password")} />
                </Field>
                <p className="text-xs text-ink-50">{t("confirm.irreversible")}</p>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Btn onClick={() => setSpec(null)} disabled={busy}>{t("c.cancel")}</Btn>
              <Btn type="submit" tone={spec.tone === "primary" ? "primary" : "danger"} disabled={!ready || busy} data-testid="confirm-submit" className={spec.tone === "primary" ? "" : "!bg-[#B42318] !text-white"}>
                {spec.confirmLabel}
              </Btn>
            </div>
          </form>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

// ---------------------------------------------------------------- KPI card + pager
export function Kpi({ label, value, sub, children, testId }: { label: string; value: string; sub?: string; children?: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-70">{sub}</p>}
      {children}
    </div>
  );
}

export function Pager({ page, total, size, hrefFor }: { page: number; total: number; size: number; hrefFor: (p: number) => string }) {
  const t = useTranslations("admin");
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="mt-3 text-xs text-ink-50">{t("c.results", { n: total })}</p>;
  return (
    <nav className="mt-3 flex items-center justify-between gap-2 text-sm" aria-label="pagination">
      <span className="text-ink-50">{t("c.page", { page, pages })} · {t("c.results", { n: total })}</span>
      <span className="flex gap-2">
        <a aria-disabled={page <= 1} href={page > 1 ? hrefFor(page - 1) : undefined} className={`inline-flex min-h-11 items-center rounded-full border border-line px-4 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-ink/30"}`}>{t("c.prev")}</a>
        <a aria-disabled={page >= pages} href={page < pages ? hrefFor(page + 1) : undefined} className={`inline-flex min-h-11 items-center rounded-full border border-line px-4 ${page >= pages ? "pointer-events-none opacity-40" : "hover:border-ink/30"}`}>{t("c.next")}</a>
      </span>
    </nav>
  );
}

/** GET search/filter bar: plain form so it works before hydration; `/` focuses the search box. */
export function FilterBar({ q, placeholder, children, exportHref }: { q?: string; placeholder: string; children?: ReactNode; exportHref?: string }) {
  const t = useTranslations("admin");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && !(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
      <input ref={ref} name="q" defaultValue={q} placeholder={placeholder} aria-label={t("c.search")} data-testid="admin-search" className={`${inputCls} min-w-0 flex-1 basis-56`} />
      {children}
      <Btn type="submit" tone="ink">{t("c.filter")}</Btn>
      {exportHref && <a href={exportHref} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium hover:border-ink/30" data-testid="admin-export">{t("c.export")}</a>}
    </form>
  );
}

export const selectCls = "min-h-11 rounded-xl border border-line bg-white px-3 text-sm";

export function fmtDate(d: string | Date | null | undefined, withTime = false): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return withTime ? x.toISOString().slice(0, 16).replace("T", " ") : x.toISOString().slice(0, 10);
}
export const fmtN = (n: number) => n.toLocaleString("en-US");

// ---------------------------------------------------------------- page header + empty state
/** One header for every admin page: title, the real row count beside it, an optional line and actions. */
export function PageHeader({ title, count, sub, actions, testId }: { title: string; count?: number | null; sub?: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6" data-testid={testId ?? "admin-page-header"}>
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-baseline gap-x-2.5 text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
          <span className="min-w-0">{title}</span>
          {typeof count === "number" && <span className="text-base font-medium tabular-nums text-ink-50" data-testid="admin-page-count" dir="ltr">{fmtN(count)}</span>}
        </h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-70">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Empty({ children, testId }: { children: ReactNode; testId?: string }) {
  return <p data-testid={testId ?? "admin-empty"} className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-50">{children}</p>;
}
