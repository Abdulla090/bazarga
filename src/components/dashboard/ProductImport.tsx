"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importProductsCsvAction } from "@/server/actions/dashboard";
import { importTemplateCsv, parseProductsCsv } from "@/lib/products-csv-import";

export type ImportLabels = {
  pick: string; paste: string; preview: string; ready: string; skipped: string; room: string; start: string; working: string;
  done: string; template: string; viewProducts: string; rowError: string; limit: string; failed: string; empty: string;
  fatal: Record<string, string>;
};

/** Upload or paste a CSV, see a validated preview (counts + first problems), then create the valid rows. */
export function ProductImport({ labels, room }: { labels: ImportLabels; room: number }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number; overLimit: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const parsed = useMemo(() => (text.trim() ? parseProductsCsv(text) : null), [text]);
  const valid = parsed?.rows.filter((r) => r.input).length ?? 0;
  const bad = parsed?.rows.filter((r) => r.error) ?? [];
  const willCreate = Math.min(valid, room);

  const templateHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(importTemplateCsv())}`, []);

  function onFile(f: File | undefined) {
    if (!f) return;
    setResult(null); setErr(null);
    void f.text().then(setText);
  }
  function run() {
    setErr(null);
    start(async () => {
      const r = await importProductsCsvAction(text);
      if (r.ok && r.data) { setResult(r.data as { created: number; skipped: number; overLimit: number }); setText(""); router.refresh(); }
      else setErr(r.error === "plan_limit_products" || r.error === "plan_feature" ? labels.limit : labels.failed);
    });
  }

  return (
    <div className="grid max-w-2xl gap-5" data-testid="products-import">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost min-h-11" onClick={() => file.current?.click()} data-testid="import-pick">{labels.pick}</button>
        <input ref={file} type="file" accept=".csv,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-file" />
        <a href={templateHref} download="products-template.csv" className="btn-ghost min-h-11 inline-flex items-center" data-testid="import-template">{labels.template}</a>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-medium">{labels.paste}</span>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); setErr(null); }} rows={6} dir="auto" spellCheck={false} className="input w-full font-mono text-sm" data-testid="import-text" />
      </label>
      {parsed?.fatal && <p role="alert" className="text-sm text-danger" data-testid="import-fatal">{labels.fatal[parsed.fatal] ?? labels.failed}</p>}
      {parsed && !parsed.fatal && (
        <div className="grid gap-2 rounded-xl border border-line p-4" data-testid="import-preview" aria-live="polite">
          <p className="font-medium">{labels.preview}</p>
          <p className="num text-sm" data-testid="import-ready">{labels.ready.replace("{n}", String(valid))}</p>
          {bad.length > 0 && <p className="num text-sm text-ink-70" data-testid="import-skipped">{labels.skipped.replace("{n}", String(bad.length))}</p>}
          {valid > room && <p className="num text-sm text-ink-70" data-testid="import-room">{labels.room.replace("{n}", String(room))}</p>}
          {bad.slice(0, 5).map((b) => (
            <p key={b.line} className="num text-xs text-ink-70">{labels.rowError.replace("{line}", String(b.line)).replace("{why}", "\u2066" + (b.error ?? "") + "\u2069")}</p>
          ))}
        </div>
      )}
      {err && <p role="alert" className="text-sm text-danger" data-testid="import-error">{err}</p>}
      {result && (
        <div role="status" className="grid gap-2 rounded-xl border border-line bg-white p-4" data-testid="import-done">
          <p className="num font-medium">{labels.done.replace("{n}", String(result.created))}</p>
          <Link href="/dashboard/products" className="btn-gold min-h-11 inline-flex w-fit items-center">{labels.viewProducts}</Link>
        </div>
      )}
      <div>
        <button type="button" className="btn-gold min-h-11" disabled={pending || !parsed || !!parsed.fatal || willCreate === 0} onClick={run} data-testid="import-start">
          {pending ? labels.working : labels.start.replace("{n}", String(willCreate))}
        </button>
      </div>
    </div>
  );
}
