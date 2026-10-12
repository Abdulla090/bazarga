"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveThemeDraftAction, publishThemeAction } from "@/server/actions/theme";
import { themeToCssVars } from "@/lib/theme-studio/css";
import { contrast } from "@/lib/theme-studio/contrast";
import type { StoreTheme } from "@/lib/theme-studio/schema";

type Preset = { id: string; theme: StoreTheme; vars: Record<string, string> };
type Labels = {
  title: string; presets: string; publish: string; published: string; unpublished: string; desktop: string; phone: string;
  undo: string; redo: string; surprise: string; saving: string; saved: string; preview: string; colors: string; type: string; buttons: string; cards: string; cardsRadius: string; cardsStyle: string; cardsRatio: string; bgKind: string; opt: Record<string, string>; shape: string; btnStyle: string; shapes: Record<string, string>; styles: Record<string, string>; accent: string; bg: string; surface: string; text: string; custom: string; lowContrast: string; sizeLabel: string; sizes: Record<string, string>; names: Record<string, string>;
};

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
function randomTheme(bases: StoreTheme[]): StoreTheme {
  const base = pick(bases);
  return { ...base, preset: "custom", buttons: { ...base.buttons, shape: pick(["square", "rounded", "pill"] as const), style: pick(["solid", "outline", "soft"] as const) }, cards: { ...base.cards, radius: pick(["none", "sm", "md", "lg"] as const), style: pick(["flat", "hairline", "shadow"] as const), ratio: pick(["square", "portrait", "landscape"] as const) }, background: { kind: pick(["solid", "gradient", "pattern"] as const) } };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Theme Studio editor shell: preset gallery (left), live iframe preview (right) fed by postMessage, autosaved draft, publish. */
export function ThemeEditor({ slug, presets, initial, published, labels }: { slug: string; presets: Preset[]; initial: StoreTheme; published: StoreTheme | null; labels: Labels }) {
  const [theme, setTheme] = useState<StoreTheme>(initial);
  const [pub, setPub] = useState<StoreTheme | null>(published);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [tab, setTab] = useState<"presets" | "colors" | "type" | "buttons" | "cards">("presets");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, start] = useTransition();
  const [hist, setHist] = useState<{ past: StoreTheme[]; future: StoreTheme[] }>({ past: [], future: [] });
  const commit = (n: StoreTheme | ((t: StoreTheme) => StoreTheme)) => { setHist((h) => ({ past: [...h.past.slice(-49), theme], future: [] })); setTheme(typeof n === "function" ? n(theme) : n); };
  const undo = () => { const p = hist.past[hist.past.length - 1]; if (!p) return; setHist({ past: hist.past.slice(0, -1), future: [...hist.future, theme] }); setTheme(p); };
  const redo = () => { const n = hist.future[hist.future.length - 1]; if (!n) return; setHist({ past: [...hist.past, theme], future: hist.future.slice(0, -1) }); setTheme(n); };
  const surprise = () => commit(randomTheme(presets.map((p) => p.theme)));
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

  const setColor = (k: "accent" | "bg" | "surface" | "text", v: string) => commit((t) => ({ ...t, preset: "custom", colors: { ...t.colors, [k]: v.toUpperCase() } }));
  const low = contrast(theme.colors.text, theme.colors.bg) < 4.5;
  const SWATCHES: Record<string, string[]> = {
    accent: ["#2563EB", "#0A0A0B", "#16A34A", "#DC2626", "#7C3AED", "#0891B2", "#DB2777", "#B45309"],
    bg: ["#FAFAF7", "#FFFFFF", "#F4F1EA", "#EEF2F7", "#0B0B0D", "#14171C"],
    surface: ["#FFFFFF", "#F5F5F2", "#ECEFF4", "#1A1D23", "#22262E"],
    text: ["#0A0A0B", "#1F2937", "#111827", "#F5F5F4", "#FFFFFF"],
  };
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
        <div className="flex gap-2 px-4 pb-3">
          <button type="button" onClick={undo} disabled={!hist.past.length} data-testid="theme-undo" className="min-h-11 flex-1 rounded-full border border-line text-[13px] disabled:opacity-40">{labels.undo}</button>
          <button type="button" onClick={redo} disabled={!hist.future.length} data-testid="theme-redo" className="min-h-11 flex-1 rounded-full border border-line text-[13px] disabled:opacity-40">{labels.redo}</button>
          <button type="button" onClick={surprise} data-testid="theme-surprise" className="min-h-11 flex-[1.4] rounded-full border border-line text-[13px] hover:border-ink/30">{labels.surprise}</button>
        </div>
        <div className="flex flex-wrap gap-1 px-4 pb-3" role="tablist">
          {(["presets", "colors", "type", "buttons", "cards"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`} className={`min-h-11 rounded-full px-4 text-[13px] transition-colors duration-150 ${tab === k ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"}`}>
              {labels[k]}
            </button>
          ))}
        </div>
        {tab === "colors" && (
          <div className="grid gap-5 overflow-y-auto px-4 pb-6" data-testid="theme-colors">
            {(["accent", "bg", "surface", "text"] as const).map((k) => (
              <fieldset key={k} className="grid gap-2">
                <legend className="t-label text-ink/60">{labels[k]}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES[k]!.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(k, c)} aria-label={c} aria-pressed={theme.colors[k].toUpperCase() === c} className={`h-11 w-11 rounded-full border transition-shadow duration-150 ${theme.colors[k].toUpperCase() === c ? "border-blue-600 ring-2 ring-blue-600 ring-offset-2" : "border-line"}`} style={{ background: c }} />
                  ))}
                  <label className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-line text-[11px] text-ink/60" title={labels.custom}>
                    <input type="color" value={theme.colors[k]} onChange={(e) => setColor(k, e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={labels.custom} data-testid={`color-${k}`} />
                    <span className="h-6 w-6 rounded-full" style={{ background: theme.colors[k] }} />
                  </label>
                </div>
              </fieldset>
            ))}
            {low && <p className="text-[13px] text-red-700" role="status">{labels.lowContrast}</p>}
          </div>
        )}
        {tab === "type" && (
          <div className="grid gap-3 px-4 pb-6" data-testid="theme-type">
            <p className="t-label text-ink/60">{labels.sizeLabel}</p>
            <div className="flex gap-2">
              {(["s", "m", "l"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={theme.type.scale === k} onClick={() => commit((t) => ({ ...t, preset: "custom", type: { ...t.type, scale: k } }))} data-testid={`scale-${k}`} className={`min-h-11 flex-1 rounded-full border text-[13px] transition-colors duration-150 ${theme.type.scale === k ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}>
                  {labels.sizes[k]}
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "cards" && (
          <div className="grid gap-5 px-4 pb-6" data-testid="theme-cards">
            {([["radius", labels.cardsRadius, ["none", "sm", "md", "lg"]], ["style", labels.cardsStyle, ["flat", "hairline", "shadow"]], ["ratio", labels.cardsRatio, ["square", "portrait", "landscape"]]] as const).map(([key, title, opts]) => (
              <fieldset key={key} className="grid gap-2">
                <legend className="t-label text-ink/60">{title}</legend>
                <div className="flex flex-wrap gap-2">
                  {opts.map((o) => (
                    <button key={o} type="button" aria-pressed={theme.cards[key] === o} onClick={() => commit((t) => ({ ...t, preset: "custom", cards: { ...t.cards, [key]: o } }))} data-testid={`card-${key}-${o}`} className={`min-h-11 min-w-20 flex-1 rounded-full border px-3 text-[13px] transition-colors duration-150 ${theme.cards[key] === o ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}>
                      {labels.opt[o]}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset className="grid gap-2">
              <legend className="t-label text-ink/60">{labels.bgKind}</legend>
              <div className="flex gap-2">
                {(["solid", "gradient", "pattern"] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={theme.background.kind === o} onClick={() => commit((t) => ({ ...t, preset: "custom", background: { ...t.background, kind: o } }))} data-testid={`bg-${o}`} className={`min-h-11 flex-1 rounded-full border px-3 text-[13px] transition-colors duration-150 ${theme.background.kind === o ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}>
                    {labels.opt[o]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        {tab === "buttons" && (
          <div className="grid gap-5 px-4 pb-6" data-testid="theme-buttons">
            {([["shape", labels.shape, labels.shapes, ["square", "rounded", "pill"]], ["style", labels.btnStyle, labels.styles, ["solid", "outline", "soft"]], ["size", labels.sizeLabel, labels.sizes, ["s", "m", "l"]]] as const).map(([key, title, names, opts]) => (
              <fieldset key={key} className="grid gap-2">
                <legend className="t-label text-ink/60">{title}</legend>
                <div className="flex gap-2">
                  {opts.map((o) => (
                    <button key={o} type="button" aria-pressed={theme.buttons[key] === o} onClick={() => commit((t) => ({ ...t, preset: "custom", buttons: { ...t.buttons, [key]: o } }))} data-testid={`btn-${key}-${o}`} className={`min-h-11 flex-1 rounded-full border text-[13px] transition-colors duration-150 ${theme.buttons[key] === o ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}>
                      {names[o]}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
        {tab === "presets" && <ul className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pb-6">
          {presets.map((p) => {
            const sel = theme.preset === p.id;
            const r = p.vars["--t-radius-btn"];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => commit(p.theme)}
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
        </ul>}
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
