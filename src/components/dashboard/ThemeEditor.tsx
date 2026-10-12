"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveThemeDraftAction, publishThemeAction } from "@/server/actions/theme";
import { themeToCssVars } from "@/lib/theme-studio/css";
import type { StoreTheme } from "@/lib/theme-studio/schema";

type Preset = { id: string; theme: StoreTheme; vars: Record<string, string> };
type Labels = {
  title: string; presets: string; publish: string; published: string; unpublished: string; desktop: string; phone: string;
  saving: string; saved: string; preview: string; names: Record<string, string>;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Theme Studio editor shell: preset gallery (left), live iframe preview (right) fed by postMessage, autosaved draft, publish. */
export function ThemeEditor({ slug, presets, initial, published, labels }: { slug: string; presets: Preset[]; initial: StoreTheme; published: StoreTheme | null; labels: Labels }) {
  const [theme, setTheme] = useState<StoreTheme>(initial);
  const [pub, setPub] = useState<StoreTheme | null>(published);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, start] = useTransition();
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const first = useRef(true);

  const push = (t: StoreTheme) => {
    const v = themeToCssVars(t).vars;
    const vars = { ...v, "--st-bg": v["--t-bg"]!, "--st-surface": v["--t-surface"]!, "--st-fg": v["--t-fg"]!, "--st-muted": v["--t-muted"]!, "--st-border": v["--t-border"]!, "--st-accent": v["--t-accent"]!, "--st-on-accent": v["--t-on-accent"]!, "--st-radius": v["--t-radius-card"]! };
    frame.current?.contentWindow?.postMessage({ type: "bazarga-theme", vars }, window.location.origin);
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string })?.type === "bazarga-preview-ready") { ready.current = true; push(theme); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [theme]);

  useEffect(() => {
    if (ready.current) push(theme);
    if (first.current) { first.current = false; return; }
    setStatus("saving");
    const id = setTimeout(() => { void saveThemeDraftAction(theme).then(() => setStatus("saved")); }, 600);
    return () => clearTimeout(id);
  }, [theme]);

  const dirty = !same(theme, pub);
  const doPublish = () => start(async () => { const r = await publishThemeAction(theme); if (r.ok) { setPub(theme); setStatus("saved"); } });

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-8rem)] flex-col md:mx-0 md:my-0 md:h-[calc(100dvh-7rem)] md:flex-row" data-testid="theme-editor">
      <aside className="flex w-full shrink-0 flex-col border-b border-line md:w-80 md:border-b-0 md:border-e">
        <div className="flex items-center gap-3 px-4 py-4">
          <h1 className="t-headline me-auto">{labels.title}</h1>
          <span className="text-xs text-ink/50" aria-live="polite">{status === "saving" ? labels.saving : status === "saved" ? labels.saved : ""}</span>
          <button type="button" onClick={doPublish} disabled={pending || !dirty} className="btn-ink btn-sm relative" data-testid="theme-publish">
            {labels.publish}
            {dirty && <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-paper" aria-label={labels.unpublished} data-testid="theme-dirty" />}
          </button>
        </div>
        <p className="t-label px-4 pb-2 text-ink/60">{labels.presets}</p>
        <ul className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pb-6">
          {presets.map((p) => {
            const sel = theme.preset === p.id;
            const r = p.vars["--t-radius-btn"];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setTheme(p.theme)}
                  aria-pressed={sel}
                  data-testid={`preset-${p.id}`}
                  className={`group grid min-h-11 w-full gap-2 rounded-xl border p-2 text-start transition-colors duration-150 ${sel ? "border-blue-600 ring-1 ring-blue-600" : "border-line hover:border-ink/30"}`}
                >
                  <span className="grid h-20 content-between rounded-lg p-2" style={{ background: p.vars["--t-bg"], border: `1px solid ${p.vars["--t-border"]}` }}>
                    <span className="h-1.5 w-8 rounded-full" style={{ background: p.vars["--t-fg"] }} />
                    <span className="flex items-end justify-between">
                      <span className="h-6 w-10" style={{ background: p.vars["--t-surface"], borderRadius: p.vars["--t-radius-card"], border: `1px solid ${p.vars["--t-border"]}` }} />
                      <span className="h-5 w-9" style={{ background: p.vars["--t-accent"], borderRadius: r }} />
                    </span>
                  </span>
                  <span className="px-0.5 text-[13px] font-medium">{labels.names[p.id] ?? p.id}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="flex min-h-[28rem] min-w-0 flex-1 flex-col bg-ink/[0.03]" aria-label={labels.preview}>
        <div className="flex items-center justify-center gap-1 border-b border-line py-2" role="group">
          {(["desktop", "phone"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`min-h-11 rounded-full px-4 text-[13px] transition-colors duration-150 ${device === d ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"}`}>
              {labels[d]}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-0 md:p-4">
          <iframe
            ref={frame}
            title={labels.preview}
            src={`/s/${slug}`}
            onLoad={() => { ready.current = true; push(theme); }}
            className={`h-full min-h-[28rem] border border-line bg-white transition-[width] duration-300 motion-reduce:transition-none ${device === "phone" ? "w-[390px] max-w-full rounded-[28px]" : "w-full rounded-lg"}`}
            data-testid="theme-preview"
          />
        </div>
      </section>
    </div>
  );
}
