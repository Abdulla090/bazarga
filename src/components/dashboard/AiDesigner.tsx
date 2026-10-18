"use client";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon, Sparkles } from "@/components/ui/icons";
import { composeStoreDesignsAction } from "@/server/actions/ai";
import type { StoreTheme } from "@/lib/theme-studio/schema";
import type { DesignOption } from "@/server/ai/design-composer";
import { ThemeThumb } from "./ThemeThumb";

export type AiDesignerMode = "on" | "locked" | "connect" | "hidden";
export type AiDesignerLabels = {
  title: string; intro: string; brief: string; briefPh: string; vibe: string; vibes: Record<string, string>; generate: string;
  generating: string; again: string; left: string; ready: string; discard: string; lockedNote: string; upgrade: string;
  connect: string; maxBadge: string; errors: Record<string, string>;
  options: string; optionsNote: string; use: string; picked: string; optionName: string;
};
const VIBES = ["minimal", "bold", "luxury", "playful", "natural", "classic"] as const;

/**
 * AI Website Designer v2 (SF10, Max): brief + optional vibe → three complete designs composed from the store's real
 * catalogue, side by side as live thumbnails of the seller's own store. Picking one puts it in the draft (the editor's
 * preview shows it full size, autosave keeps it); the seller publishes (the normal Publish button) or discards (back to
 * the theme they had before). One generation of three costs one credit.
 */
export function AiDesigner({ mode, remaining, labels, onDesign, onDiscard, hasDraft, slug, names, vopt }: {
  mode: AiDesignerMode; remaining: number; labels: AiDesignerLabels; hasDraft: boolean; slug: string;
  /** Flagship display names (option names when the AI gave none) and variant labels (the option's detail line). */
  names: Record<string, string>; vopt: Record<string, string>;
  onDesign: (t: StoreTheme) => void; onDiscard: () => void;
}) {
  const [options, setOptions] = useState<DesignOption[]>([]);
  const [picked, setPicked] = useState<string>("");
  // From tablet up the three options sit above the big preview (room to compare them side by side); on phones inline.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setSlot(mq.matches ? document.getElementById("ai-options-slot") : null);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [vibe, setVibe] = useState<string>("");
  const [left, setLeft] = useState(remaining);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (mode === "hidden") return null;

  const run = () => start(async () => {
    setError("");
    const r = await composeStoreDesignsAction({ brief, vibe: vibe || null });
    if (!r.ok || !r.options?.length) { setError(r.fieldErrors?.brief ?? r.error ?? "generic"); return; }
    if (typeof r.remaining === "number") setLeft(r.remaining);
    setOptions(r.options);
    setPicked("");
  });
  const pick = (o: DesignOption) => { setPicked(o.id); onDesign(o.theme); };
  const discard = () => { setPicked(""); onDiscard(); };
  const nameOf = (o: DesignOption) => o.name || labels.optionName.replace("{name}", names[o.base] ?? o.base);
  const detailOf = (o: DesignOption) => [o.theme.layout?.hero, o.theme.layout?.grid, o.theme.type.pair].map((k) => (k ? (vopt[k] ?? k) : "")).filter(Boolean).join(" · ");
  const errorText = error ? (labels.errors[error] ?? labels.errors.generic) : "";

  const optionsUi = (
    <div className="grid gap-2" data-testid="ai-options">
      <p className="t-label text-ink/60">{labels.options}</p>
      <ul className="grid grid-cols-3 gap-2 md:gap-3">
        {options.map((o) => {
          const sel = picked === o.id;
          return (
            <li key={o.id} className={`grid content-start gap-1.5 rounded-xl border bg-white p-1.5 ${sel ? "border-blue-600 ring-1 ring-blue-600" : "border-line"}`} data-testid={`ai-option-${o.id}`} data-base={o.base} data-hero={o.theme.layout?.hero}>
              <ThemeThumb src={`/s/${slug}?pv=1&pvt=${o.preview}`} title={nameOf(o)} bg={o.theme.colors.bg} />
              <p className="line-clamp-2 text-[12px] font-semibold leading-snug md:text-[14px]">{nameOf(o)}</p>
              <p className="line-clamp-2 text-[11px] leading-snug text-ink/60 md:text-[12px]">{detailOf(o)}</p>
              <button type="button" onClick={() => pick(o)} aria-pressed={sel} className={`min-h-11 rounded-full px-2 text-[12px] font-semibold leading-tight transition-colors duration-150 ${sel ? "bg-ink text-white" : "border border-line hover:border-ink/30"}`} data-testid={`ai-option-use-${o.id}`}>
                {sel ? labels.picked : labels.use}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
    {options.length > 0 && slot && createPortal(<div className="mx-auto w-full max-w-[42rem] px-4 pt-3">{optionsUi}</div>, slot)}
    <div className="mx-4 mb-3 rounded-2xl border border-[#2563EB]/30 bg-[#2563EB]/[0.04]" data-testid="ai-designer">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-start text-[14px] font-semibold"
        data-testid="ai-designer-toggle"
      >
        <Icon as={Sparkles} className="text-[18px] text-[#2563EB]" />
        <span className="me-auto leading-normal">{labels.title}</span>
        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold leading-normal text-white">{labels.maxBadge}</span>
      </button>
      {open && (
        <div className="grid gap-3 px-3 pb-3">
          {mode === "connect" && <p className="text-[13px] leading-relaxed text-ink/70" data-testid="ai-designer-connect">{labels.connect}</p>}
          {mode === "locked" && (
            <>
              <p className="text-[13px] leading-relaxed text-ink/70" data-testid="ai-designer-locked">{labels.lockedNote}</p>
              <a href="/dashboard/upgrade" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#2563EB] px-4 text-[13px] font-semibold text-white" data-testid="ai-designer-upgrade">{labels.upgrade}</a>
            </>
          )}
          {mode === "on" && (
            <>
              <p className="text-[13px] leading-relaxed text-ink/70">{labels.intro}</p>
              <label className="grid gap-1.5">
                <span className="t-label text-ink/60">{labels.brief}</span>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder={labels.briefPh}
                  className="min-h-11 resize-none rounded-xl border border-line bg-white px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-blue-600"
                  data-testid="ai-designer-brief"
                />
              </label>
              <fieldset className="grid gap-1.5">
                <legend className="t-label text-ink/60">{labels.vibe}</legend>
                <div className="flex flex-wrap gap-2">
                  {VIBES.map((v) => (
                    <button key={v} type="button" aria-pressed={vibe === v} onClick={() => setVibe((c) => (c === v ? "" : v))} data-testid={`ai-vibe-${v}`} className={`min-h-11 rounded-full border px-3 text-[13px] leading-normal transition-colors duration-150 ${vibe === v ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}>
                      {labels.vibes[v]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button type="button" onClick={run} disabled={pending || brief.trim().length < 3 || left <= 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:opacity-50" data-testid="ai-designer-generate">
                <Icon as={Sparkles} className="text-[16px]" />
                {pending ? labels.generating : hasDraft ? labels.again : labels.generate}
              </button>
              <p className="text-[12px] leading-normal text-ink/60" data-testid="ai-designer-left">{labels.left.replace("{count}", String(left))} · {labels.optionsNote}</p>
              {errorText && <p role="alert" className="text-[13px] leading-normal text-red-700" data-testid="ai-designer-error">{errorText}</p>}
              {options.length > 0 && !slot && optionsUi}
              {hasDraft && (
                <div role="status" className="grid gap-2 rounded-xl border border-line bg-white p-3" data-testid="ai-designer-ready">
                  <p className="text-[13px] leading-relaxed">{labels.ready}</p>
                  <button type="button" onClick={discard} className="min-h-11 rounded-full border border-line text-[13px] hover:border-ink/30" data-testid="ai-designer-discard">{labels.discard}</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}
