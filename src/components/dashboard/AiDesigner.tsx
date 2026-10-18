"use client";
import { useState, useTransition } from "react";
import { Icon, Sparkles } from "@/components/ui/icons";
import { designStoreWithAiAction } from "@/server/actions/ai";
import type { StoreTheme } from "@/lib/theme-studio/schema";

export type AiDesignerMode = "on" | "locked" | "connect" | "hidden";
export type AiDesignerLabels = {
  title: string; intro: string; brief: string; briefPh: string; vibe: string; vibes: Record<string, string>; generate: string;
  generating: string; again: string; left: string; ready: string; discard: string; lockedNote: string; upgrade: string;
  connect: string; maxBadge: string; errors: Record<string, string>;
};
const VIBES = ["minimal", "bold", "luxury", "playful", "natural", "classic"] as const;

/**
 * AI Website Designer (SF10, Max): brief + optional vibe → the server writes a Theme Studio draft; the editor previews it
 * and the seller publishes (the normal Publish button) or discards (back to the theme they had before).
 */
export function AiDesigner({ mode, remaining, labels, onDesign, onDiscard, hasDraft }: {
  mode: AiDesignerMode; remaining: number; labels: AiDesignerLabels; hasDraft: boolean;
  onDesign: (t: StoreTheme) => void; onDiscard: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [vibe, setVibe] = useState<string>("");
  const [left, setLeft] = useState(remaining);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (mode === "hidden") return null;

  const run = () => start(async () => {
    setError("");
    const r = await designStoreWithAiAction({ brief, vibe: vibe || null });
    if (!r.ok || !r.theme) { setError(r.fieldErrors?.brief ?? r.error ?? "generic"); return; }
    if (typeof r.remaining === "number") setLeft(r.remaining);
    onDesign(r.theme);
  });
  const errorText = error ? (labels.errors[error] ?? labels.errors.generic) : "";

  return (
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
              <p className="text-[12px] leading-normal text-ink/60" data-testid="ai-designer-left">{labels.left.replace("{count}", String(left))}</p>
              {errorText && <p role="alert" className="text-[13px] leading-normal text-red-700" data-testid="ai-designer-error">{errorText}</p>}
              {hasDraft && (
                <div role="status" className="grid gap-2 rounded-xl border border-line bg-white p-3" data-testid="ai-designer-ready">
                  <p className="text-[13px] leading-relaxed">{labels.ready}</p>
                  <button type="button" onClick={onDiscard} className="min-h-11 rounded-full border border-line text-[13px] hover:border-ink/30" data-testid="ai-designer-discard">{labels.discard}</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
