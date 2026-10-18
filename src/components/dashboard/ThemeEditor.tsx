"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveThemeDraftAction, publishThemeAction } from "@/server/actions/theme";
import { themeToCssVars } from "@/lib/theme-studio/css";
import { contrast } from "@/lib/theme-studio/contrast";
import type { StoreTheme } from "@/lib/theme-studio/schema";
import { AiDesigner, type AiDesignerLabels, type AiDesignerMode } from "./AiDesigner";
import { CARD_VARIANTS, DENSITIES, FOOTER_VARIANTS, GRID_VARIANTS, HEADER_VARIANTS, HERO_VARIANTS, HOME_SECTIONS, MOTIONS, PREMIUM_VARIANTS, PRODUCT_LAYOUTS, SURFACES, TYPE_PAIRS, composeDesign, encodeComposition, usesPremium, type HomeSection } from "@/lib/theme-studio/designs";
import { ThemeThumb } from "./ThemeThumb";

export type FlagshipCard = { id: string; group: string; premium: boolean; theme: StoreTheme };
type V2Labels = {
  themesTab: string; layoutTab: string; themesIntro: string; layoutIntro: string; apply: string; inUse: string; morePalettes: string;
  moveUp: string; moveDown: string; showSection: string; hideSection: string;
  group: Record<string, string>; axis: Record<string, string>; vopt: Record<string, string>; flagship: Record<string, { name: string; desc: string }>;
};
const PAIR_SAMPLE: Record<string, string> = {
  "sans-clean": "var(--font-inter), var(--font-vazirmatn)", "serif-editorial": "var(--font-fraunces), var(--font-naskh)", "luxe-serif": "var(--font-playfair), var(--font-naskh)",
  "rounded-soft": "var(--font-nunito), var(--font-vazirmatn)", playful: "var(--font-nunito), var(--font-kufi)", "mono-bold": "var(--font-jetbrains), var(--font-plex-arabic)",
  "tech-mono": "var(--font-grotesk), var(--font-plex-arabic)", grotesk: "var(--font-grotesk), var(--font-plex-arabic)", condensed: "var(--font-oswald), var(--font-kufi)",
};
const LAYOUT_AXES = [["hero", HERO_VARIANTS], ["grid", GRID_VARIANTS], ["card", CARD_VARIANTS], ["product", PRODUCT_LAYOUTS], ["footer", FOOTER_VARIANTS], ["density", DENSITIES], ["surface", SURFACES], ["motion", MOTIONS]] as const;

type Preset = { id: string; theme: StoreTheme; vars: Record<string, string>; premium?: boolean };
type Labels = {
  title: string; presets: string; publish: string; published: string; unpublished: string; desktop: string; phone: string;
  undo: string; redo: string; surprise: string; saving: string; saved: string; preview: string; colors: string; type: string; buttons: string; cards: string; header: string; headerLayout: string; announce: string; announcePh: string; cardsRadius: string; cardsStyle: string; cardsRatio: string; bgKind: string; opt: Record<string, string>; shape: string; btnStyle: string; shapes: Record<string, string>; styles: Record<string, string>; accent: string; bg: string; surface: string; text: string; custom: string; lowContrast: string; sizeLabel: string; sizes: Record<string, string>; names: Record<string, string>;
  premiumBadge: string; premiumNote: string; premiumCta: string;
  v2: V2Labels;
};

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
function randomTheme(bases: StoreTheme[]): StoreTheme {
  const base = pick(bases);
  return { ...base, preset: "custom", buttons: { ...base.buttons, shape: pick(["square", "rounded", "pill"] as const), style: pick(["solid", "outline", "soft"] as const) }, cards: { ...base.cards, radius: pick(["none", "sm", "md", "lg"] as const), style: pick(["flat", "hairline", "shadow"] as const), ratio: pick(["square", "portrait", "landscape"] as const) }, background: { kind: pick(["solid", "gradient", "pattern"] as const) } };
}
const setPreviewCookie = (slug: string, d: string) => { document.cookie = `bz_pv_${slug}=${d}; path=/s/${slug}; max-age=3600; samesite=lax`; };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Theme Studio editor shell: preset gallery (left), live iframe preview (right) fed by postMessage, autosaved draft, publish. */
export function ThemeEditor({ slug, presets, flagships, initial, published, labels, premiumLocked = false, ai }: { slug: string; presets: Preset[]; flagships: FlagshipCard[]; initial: StoreTheme; published: StoreTheme | null; labels: Labels; premiumLocked?: boolean; ai?: { mode: AiDesignerMode; remaining: number; labels: AiDesignerLabels } }) {
  const [theme, setTheme] = useState<StoreTheme>(initial);
  // AI Website Designer: the theme the seller had before the AI draft, so Discard can bring it back.
  const [aiBase, setAiBase] = useState<StoreTheme | null>(null);
  const [pub, setPub] = useState<StoreTheme | null>(published);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [tab, setTab] = useState<"themes" | "layout" | "colors" | "type" | "buttons" | "cards" | "header">("themes");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, start] = useTransition();
  const [hist, setHist] = useState<{ past: StoreTheme[]; future: StoreTheme[] }>({ past: [], future: [] });
  const commit = (n: StoreTheme | ((t: StoreTheme) => StoreTheme)) => { setHist((h) => ({ past: [...h.past.slice(-49), theme], future: [] })); setTheme(typeof n === "function" ? n(theme) : n); };
  const undo = () => { const p = hist.past[hist.past.length - 1]; if (!p) return; setHist({ past: hist.past.slice(0, -1), future: [...hist.future, theme] }); setTheme(p); };
  const redo = () => { const n = hist.future[hist.future.length - 1]; if (!n) return; setHist({ past: [...hist.past, theme], future: hist.future.slice(0, -1) }); setTheme(n); };
  // Surprise me: a random flagship with a few of its parts swapped (never a premium part on a plan without it).
  const surprise = () => {
    const pool = flagships.filter((f) => !f.premium || !premiumLocked);
    if (!pool.length) return commit(randomTheme(presets.filter((p) => !p.premium || !premiumLocked).map((p) => p.theme)));
    const base = pick(pool).theme;
    const free = <T extends string>(axis: string, list: readonly T[]) => list.filter((v) => !premiumLocked || !isPremiumOpt(axis, v));
    commit({ ...base, preset: "custom", layout: { ...base.layout, hero: pick(free("hero", HERO_VARIANTS.filter((h) => h !== "spotlight"))), card: pick(free("card", CARD_VARIANTS)), surface: pick(SURFACES) } });
  };
  const lockedPreview = premiumLocked && usesPremium(theme);
  const spec = composeDesign(theme);
  const composition = encodeComposition(spec);
  const v2 = labels.v2;
  const setLayout = (k: string, v: unknown) => commit((t) => ({ ...t, preset: "custom", layout: { ...t.layout, [k]: v } }));
  const applyFlagship = (f: FlagshipCard) => commit({ ...f.theme, header: { ...f.theme.header, ...(theme.header.announce ? { announce: theme.header.announce } : {}) }, ...(theme.copy ? { copy: theme.copy } : {}) });
  const isPremiumOpt = (axis: string, v: string) => ((PREMIUM_VARIANTS as Record<string, readonly string[]>)[axis] ?? []).includes(v);
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const first = useRef(true);
  // The preview iframe renders the *draft* design server-side: the editor leaves the choice in a cookie the storefront
  // honours for iframe loads only. The iframe gets its src after the cookie is set, and reloads when the design changes.
  // Design system v2: the cookie carries the whole composition (design + per-section variants + type pair).
  const designRef = useRef(composition);
  useEffect(() => {
    setPreviewCookie(slug, designRef.current);
    if (frame.current && !frame.current.getAttribute("src")) frame.current.src = `/s/${slug}?pv=1`;
  }, [slug]);
  useEffect(() => {
    if (designRef.current === composition) return;
    designRef.current = composition;
    setPreviewCookie(slug, composition);
    ready.current = false;
    frame.current?.contentWindow?.location.reload();
  }, [composition, slug]);

  const push = (t: StoreTheme) => {
    const v = themeToCssVars(t).vars;
    const vars = { ...v, "--st-bg": v["--t-bg"]!, "--st-surface": v["--t-surface"]!, "--st-fg": v["--t-fg"]!, "--st-muted": v["--t-muted"]!, "--st-border": v["--t-border"]!, "--st-accent": v["--t-accent"]!, "--st-on-accent": v["--t-on-accent"]!, "--st-radius": v["--t-radius-card"]! };
    frame.current?.contentWindow?.postMessage({ type: "bazarga-theme", vars, header: { layout: t.header.layout, announce: t.header.announce ?? "" }, tagline: t.copy?.tagline ?? "" }, window.location.origin);
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
  const doPublish = () => start(async () => { const r = await publishThemeAction(theme); if (r.ok) { setPub(theme); setStatus("saved"); setAiBase(null); } });

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-8rem)] flex-col md:mx-0 md:my-0 md:h-[calc(100dvh-7rem)] md:flex-row" data-testid="theme-editor">
      <aside className="flex w-full shrink-0 flex-col border-b border-line md:w-80 md:border-b-0 md:border-e">
        <div className="flex items-center gap-3 px-4 py-4">
          <h1 className="t-headline me-auto">{labels.title}</h1>
          <span className="text-xs text-ink/50" aria-live="polite">{status === "saving" ? labels.saving : status === "saved" ? labels.saved : ""}</span>
          {lockedPreview ? (
            <a href="/dashboard/upgrade" className="inline-flex min-h-11 items-center rounded-full bg-[#2563EB] px-4 text-[13px] font-semibold text-white" data-testid="theme-premium-cta">{labels.premiumCta}</a>
          ) : (
            <button type="button" onClick={doPublish} disabled={pending || !dirty} className="btn-ink btn-sm relative" data-testid="theme-publish">
              {labels.publish}
              {dirty && <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-paper" aria-label={labels.unpublished} data-testid="theme-dirty" />}
            </button>
          )}
        </div>
        {lockedPreview && (
          <p role="status" className="mx-4 mb-3 rounded-xl border border-[#2563EB]/30 bg-[#2563EB]/5 p-3 text-[13px] leading-relaxed" data-testid="theme-premium-note">{labels.premiumNote}</p>
        )}
        {ai && (
          <AiDesigner
            mode={ai.mode}
            remaining={ai.remaining}
            labels={ai.labels}
            hasDraft={!!aiBase}
            slug={slug}
            names={Object.fromEntries(Object.entries(v2.flagship).map(([k, x]) => [k, x.name]))}
            vopt={v2.vopt}
            onDesign={(t) => { setAiBase((b) => b ?? theme); commit(t); }}
            onDiscard={() => { if (aiBase) commit(aiBase); setAiBase(null); }}
          />
        )}
        <div className="flex gap-2 px-4 pb-3">
          <button type="button" onClick={undo} disabled={!hist.past.length} data-testid="theme-undo" className="min-h-11 flex-1 rounded-full border border-line text-[13px] disabled:opacity-40">{labels.undo}</button>
          <button type="button" onClick={redo} disabled={!hist.future.length} data-testid="theme-redo" className="min-h-11 flex-1 rounded-full border border-line text-[13px] disabled:opacity-40">{labels.redo}</button>
          <button type="button" onClick={surprise} data-testid="theme-surprise" className="min-h-11 flex-[1.4] rounded-full border border-line text-[13px] hover:border-ink/30">{labels.surprise}</button>
        </div>
        <div className="flex flex-wrap gap-1 px-4 pb-3" role="tablist">
          {(["themes", "layout", "colors", "type", "buttons", "cards", "header"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`} className={`min-h-11 rounded-full px-4 text-[13px] transition-colors duration-150 ${tab === k ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"}`}>
              {k === "themes" ? v2.themesTab : k === "layout" ? v2.layoutTab : labels[k]}
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
            <p className="t-label text-ink/60">{v2.axis.pair}</p>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_PAIRS.map((k) => (
                <button key={k} type="button" aria-pressed={theme.type.pair === k} onClick={() => commit((t) => ({ ...t, preset: "custom", type: { ...t.type, pair: k } }))} data-testid={`pair-${k}`} className={`grid min-h-16 content-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-colors duration-150 ${theme.type.pair === k ? "border-blue-600 ring-1 ring-blue-600" : "border-line hover:border-ink/30"}`}>
                  <span className="text-[20px] leading-tight" style={{ fontFamily: PAIR_SAMPLE[k], fontWeight: k === "playful" || k === "condensed" ? 800 : 500 }} aria-hidden>Aa ئا</span>
                  <span className="text-[11px] leading-snug text-ink/70">{v2.vopt[k] ?? k}</span>
                </button>
              ))}
            </div>
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
        {tab === "header" && (
          <div className="grid gap-5 px-4 pb-6" data-testid="theme-header">
            <fieldset className="grid gap-2">
              <legend className="t-label text-ink/60">{labels.headerLayout}</legend>
              <div className="flex flex-wrap gap-2">
                {HEADER_VARIANTS.map((o) => (
                  <button key={o} type="button" aria-pressed={spec.header === o} onClick={() => commit((t) => ({ ...t, preset: "custom", header: { ...t.header, layout: o }, layout: { ...t.layout, header: o } }))} data-testid={`header-${o}`} className={`min-h-11 min-w-20 flex-1 rounded-full border px-3 text-[13px] transition-colors duration-150 ${spec.header === o ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}>
                    {labels.opt[o] ?? v2.vopt[o] ?? o}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-2">
              <span className="t-label text-ink/60">{labels.announce}</span>
              <input type="text" maxLength={80} value={theme.header.announce ?? ""} placeholder={labels.announcePh} onChange={(e) => commit((t) => ({ ...t, preset: "custom", header: { ...t.header, announce: e.target.value } }))} data-testid="header-announce" className="min-h-11 rounded-full border border-line bg-transparent px-4 text-[14px] outline-none focus:border-blue-600" />
            </label>
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
        {tab === "themes" && (
          <div className="grid gap-6 overflow-y-auto px-4 pb-6" data-testid="theme-gallery">
            <p className="text-[13px] leading-relaxed text-ink/70">{v2.themesIntro}</p>
            {Object.keys(v2.group).map((g) => {
              const items = flagships.filter((f) => f.group === g);
              if (!items.length) return null;
              return (
                <section key={g} className="grid gap-2" aria-label={v2.group[g]}>
                  <h2 className="t-label text-ink/60">{v2.group[g]}</h2>
                  <ul className="grid grid-cols-2 gap-3">
                    {items.map((f) => {
                      const sel = theme.preset === f.id;
                      return (
                        <li key={f.id}>
                          <button type="button" onClick={() => applyFlagship(f)} aria-pressed={sel} data-testid={`flagship-${f.id}`} className={`group grid w-full gap-1.5 rounded-xl border p-1.5 text-start transition-colors duration-150 ${sel ? "border-blue-600 ring-1 ring-blue-600" : "border-line hover:border-ink/30"}`}>
                            <ThemeThumb src={`/s/${slug}?pv=1&pvt=${f.id}`} title={v2.flagship[f.id]?.name ?? f.id} bg={f.theme.colors.bg} />
                            <span className="flex items-center justify-between gap-1 px-0.5 text-[13px] font-semibold leading-snug">
                              {v2.flagship[f.id]?.name ?? f.id}
                              {f.premium && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold leading-normal text-white" data-testid={`flagship-premium-${f.id}`}>{labels.premiumBadge}</span>}
                            </span>
                            <span className="px-0.5 text-[12px] leading-snug text-ink/60">{v2.flagship[f.id]?.desc}</span>
                            <span className="px-0.5 pb-0.5 text-[12px] font-medium text-blue-700">{sel ? v2.inUse : v2.apply}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            <details className="group rounded-xl border border-line px-3 py-1" data-testid="legacy-palettes">
              <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-medium">{v2.morePalettes}</summary>
            <ul className="grid grid-cols-2 gap-3 pt-3">
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
                  <span className="flex items-center justify-between gap-1 px-0.5 text-[13px] font-medium">
                    {labels.names[p.id] ?? p.id}
                    {p.premium && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold leading-normal text-white" data-testid={`preset-premium-${p.id}`}>{labels.premiumBadge}</span>}
                  </span>
                </button>
              </li>
            );
          })}
            </ul>
            </details>
          </div>
        )}
        {tab === "layout" && (
          <div className="grid gap-4 overflow-y-auto px-4 pb-6" data-testid="theme-layout">
            <p className="text-[13px] leading-relaxed text-ink/70">{v2.layoutIntro}</p>
            {LAYOUT_AXES.map(([axis, opts]) => (
              <label key={axis} className="grid gap-1.5">
                <span className="t-label text-ink/60">{v2.axis[axis]}</span>
                <select value={spec[axis]} onChange={(e) => setLayout(axis, e.target.value)} data-testid={`layout-${axis}`} className="min-h-11 rounded-xl border border-line bg-transparent px-3 text-[14px] outline-none focus:border-blue-600">
                  {opts.map((o) => (
                    <option key={o} value={o}>{(v2.vopt[o] ?? o) + (premiumLocked && isPremiumOpt(axis, o) ? ` · ${labels.premiumBadge}` : "")}</option>
                  ))}
                </select>
              </label>
            ))}
            <fieldset className="grid gap-2" data-testid="layout-sections">
              <legend className="t-label mb-1.5 text-ink/60">{v2.axis.sections}</legend>
              <ol className="grid gap-1.5">
                {spec.sections.map((sec, i) => (
                  <li key={sec} className="flex min-h-11 items-center gap-1 rounded-xl border border-line ps-3 text-[14px]">
                    <span className="me-auto">{v2.vopt[sec] ?? sec}</span>
                    <button type="button" disabled={i === 0} onClick={() => { const a = [...spec.sections]; [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; setLayout("sections", a); }} aria-label={`${v2.moveUp}: ${v2.vopt[sec] ?? sec}`} className="h-11 w-11 rounded-full text-ink/70 hover:bg-ink/5 disabled:opacity-30">↑</button>
                    <button type="button" disabled={i === spec.sections.length - 1} onClick={() => { const a = [...spec.sections]; [a[i + 1], a[i]] = [a[i]!, a[i + 1]!]; setLayout("sections", a); }} aria-label={`${v2.moveDown}: ${v2.vopt[sec] ?? sec}`} className="h-11 w-11 rounded-full text-ink/70 hover:bg-ink/5 disabled:opacity-30">↓</button>
                    <button type="button" disabled={spec.sections.length <= 1} onClick={() => setLayout("sections", spec.sections.filter((x) => x !== sec))} className="min-h-11 rounded-full px-3 text-[12px] text-ink/70 hover:bg-ink/5 disabled:opacity-30" data-testid={`section-hide-${sec}`}>{v2.hideSection}</button>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                {HOME_SECTIONS.filter((x): x is Exclude<HomeSection, "rail"> => x !== "rail" && !spec.sections.includes(x)).map((sec) => (
                  <button key={sec} type="button" onClick={() => setLayout("sections", [...spec.sections, sec])} className="min-h-11 rounded-full border border-dashed border-line px-3 text-[13px] text-ink/70 hover:border-ink/30" data-testid={`section-show-${sec}`}>+ {v2.vopt[sec] ?? sec}</button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </aside>
      <section className="flex min-h-[28rem] min-w-0 flex-1 flex-col bg-ink/[0.03]" aria-label={labels.preview}>
        <div className="flex items-center justify-center gap-1 border-b border-line py-2" role="group">
          {(["desktop", "phone"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`min-h-11 rounded-full px-4 text-[13px] transition-colors duration-150 ${device === d ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"}`}>
              {labels[d]}
            </button>
          ))}
        </div>
        <div id="ai-options-slot" className="empty:hidden" data-testid="ai-options-slot" />
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-0 md:p-4">
          <iframe
            ref={frame}
            title={labels.preview}
            onLoad={() => { ready.current = true; push(theme); }}
            className={`h-full min-h-[28rem] border border-line bg-white transition-[width] duration-300 motion-reduce:transition-none ${device === "phone" ? "w-[390px] max-w-full rounded-[28px]" : "w-full rounded-lg"}`}
            data-testid="theme-preview"
          />
        </div>
      </section>
    </div>
  );
}
