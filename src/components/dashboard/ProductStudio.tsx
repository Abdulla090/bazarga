"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, X } from "@/components/ui/icons";
import { claimStudioEditAction } from "@/server/actions/studio";
import { DEFAULT_STUDIO, runStudio, type Rgba, type StudioOptions } from "@/lib/studio/process";
import type { ProductImageInput } from "@/lib/validation";

export type StudioInfo = { limit: number; remaining: number; ai: boolean };

const MAX_SIDE = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("load"));
    img.src = src;
  });
}

function toRgba(src: CanvasImageSource, w: number, h: number): Rgba {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  return { data: d.data, width: w, height: h };
}

function draw(canvas: HTMLCanvasElement | null, img: Rgba | null) {
  if (!canvas || !img) return;
  canvas.width = img.width; canvas.height = img.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
}

/** Largest rendition (or the url itself) so the edit starts from the best pixels we have. */
const bestUrl = (img: ProductImageInput) => [...(img.renditions ?? [])].sort((a, b) => b.width - a.width)[0]?.url ?? img.url;

/**
 * Product Studio (SF9): whiten the background, auto-crop and enhance a product photo in the browser (free), or cut the
 * background out with AI when the platform has REMOVE_BG_API_KEY. Saving spends one monthly edit (server-checked) and
 * replaces the photo with the cleaned one.
 */
export function ProductStudio({ image, info, maxMb, onSaved, onClose, onUsage }: {
  image: ProductImageInput; info: StudioInfo; maxMb: number;
  onSaved: (img: ProductImageInput) => void; onClose: () => void; onUsage: (remaining: number) => void;
}) {
  const t = useTranslations("studio");
  const te = useTranslations("errors");
  const dialog = useRef<HTMLDialogElement>(null);
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<Rgba | null>(null);
  const [aiSrc, setAiSrc] = useState<Rgba | null>(null);
  const [opt, setOpt] = useState<StudioOptions>(DEFAULT_STUDIO);
  const [busy, setBusy] = useState<"" | "ai" | "save">("");
  const [error, setError] = useState("");

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    let alive = true;
    loadImage(bestUrl(image))
      .then((el) => {
        if (!alive) return;
        const k = Math.min(1, MAX_SIDE / Math.max(el.naturalWidth, el.naturalHeight));
        setSrc(toRgba(el, Math.round(el.naturalWidth * k), Math.round(el.naturalHeight * k)));
      })
      .catch(() => alive && setError("generic"));
    return () => { alive = false; };
  }, [image]);

  useEffect(() => { draw(before.current, src); }, [src]);
  const out = useMemo<Rgba | null>(() => {
    const base = aiSrc ?? src;
    if (!base) return null;
    // AI result already has a white background: keep crop + enhance, skip the local whitening.
    return runStudio(base, aiSrc ? { ...opt, whiten: false } : opt);
  }, [src, aiSrc, opt]);
  useEffect(() => { draw(after.current, out); }, [out]);

  const close = () => dialog.current?.close();
  const noneLeft = info.remaining <= 0;

  async function aiCut() {
    if (!after.current || !src) return;
    setBusy("ai"); setError("");
    try {
      const c = document.createElement("canvas");
      draw(c, src);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.92));
      if (!blob) throw new Error("blob");
      const fd = new FormData(); fd.append("file", blob, "photo.jpg");
      const res = await fetch("/api/studio/remove-bg", { method: "POST", body: fd });
      if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { error?: string }; setError(j.error ?? "studio_failed"); return; }
      const bmp = await createImageBitmap(await res.blob());
      setAiSrc(toRgba(bmp, bmp.width, bmp.height));
      onUsage(info.remaining - 1);
    } catch { setError("studio_failed"); } finally { setBusy(""); }
  }

  async function save() {
    if (!after.current || !out) return;
    setBusy("save"); setError("");
    try {
      const blob = await new Promise<Blob | null>((ok) => after.current!.toBlob(ok, "image/webp", 0.9));
      if (!blob) throw new Error("blob");
      if (blob.size > maxMb * 1024 * 1024) { setError("file_too_large"); return; }
      const fd = new FormData(); fd.append("file", new File([blob], "studio.webp", { type: "image/webp" }));
      const up = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = (await up.json()) as { image?: ProductImageInput; error?: string };
      if (!up.ok || !j.image) { setError(j.error ?? "generic"); return; }
      // The AI cut-out already paid for this edit; a local cleanup spends one now (server refuses over quota).
      if (!aiSrc) {
        const r = await claimStudioEditAction();
        if (!r.ok) { setError(r.error ?? "generic"); return; }
        onUsage(Number(r.data?.remaining ?? info.remaining - 1));
      }
      onSaved(j.image);
      close();
    } catch { setError("generic"); } finally { setBusy(""); }
  }

  const toggle = (k: "whiten" | "crop" | "enhance") => setOpt((o) => ({ ...o, [k]: !o[k] }));
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && close()}
      aria-labelledby="studio-title"
      className="m-auto w-[min(100vw-1rem,56rem)] max-w-none overflow-hidden rounded-[1.25rem] bg-paper p-0 text-ink shadow-[var(--shadow-e3)] backdrop:bg-ink/50 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none"
      data-testid="studio-dialog"
    >
      <div className="flex max-h-[min(92dvh,52rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="studio-title" className="text-lg font-bold">{t("title")}</h2>
            <p className="text-sm text-ink-70" data-testid="studio-left">{t("left", { n: Math.max(0, info.remaining), limit: info.limit })}</p>
          </div>
          <button type="button" onClick={close} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5" autoFocus>
            <Icon as={X} label={t("close")} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            {([["before", before], ["after", after]] as const).map(([k, ref]) => (
              <figure key={k} className="grid gap-1">
                <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-line bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                  <canvas ref={ref} className="h-full w-full object-contain" data-testid={`studio-${k}`} />
                </div>
                <figcaption className="text-center text-sm text-ink-70">{t(k)}</figcaption>
              </figure>
            ))}
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">{t("options")}</legend>
            {(["whiten", "crop", "enhance"] as const).map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 py-2">
                <input type="checkbox" checked={opt[k]} disabled={k === "whiten" && !!aiSrc} onChange={() => toggle(k)} className="h-5 w-5 shrink-0 accent-[#2563EB]" data-testid={`studio-opt-${k}`} />
                <span className="font-semibold">{t(k)}</span>
              </label>
            ))}
          </fieldset>
          {opt.enhance && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["brightness", "contrast"] as const).map((k) => (
                <label key={k} className="grid gap-1">
                  <span className="text-sm font-semibold">{t(k)}</span>
                  <input type="range" min={-30} max={30} value={opt[k]} onChange={(e) => setOpt((o) => ({ ...o, [k]: Number(e.target.value) }))} className="h-11 w-full accent-[#2563EB]" data-testid={`studio-${k}`} />
                </label>
              ))}
            </div>
          )}
          {info.ai && (
            <button type="button" onClick={aiCut} disabled={!!busy || noneLeft || !!aiSrc} aria-busy={busy === "ai" || undefined} className="btn-ghost min-h-11" data-testid="studio-ai">
              {busy === "ai" ? t("working") : aiSrc ? t("aiDone") : t("aiCut")}
            </button>
          )}
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" data-testid="studio-error">{te(error as "generic")}</p>}
          {noneLeft && !aiSrc && <p className="hint" data-testid="studio-none-left">{te("plan_limit_studio")}</p>}
          <p className="hint">{t("hint")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line bg-white px-4 py-3 sm:px-6">
          <button type="button" onClick={close} className="btn-ghost min-h-11">{t("cancel")}</button>
          <button type="button" onClick={save} disabled={!out || !!busy || (noneLeft && !aiSrc)} aria-busy={busy === "save" || undefined} className="btn-gold min-h-11" data-testid="studio-save">
            {busy === "save" ? t("working") : t("save")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
