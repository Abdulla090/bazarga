"use client";
import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, Plus, Sparkles, X } from "@/components/ui/icons";
import type { ProductImageInput } from "@/lib/validation";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";
import { compressForUpload } from "@/lib/client-image-compress";
import type { StudioInfo } from "./ProductStudio";

const ProductStudio = lazy(() => import("./ProductStudio").then((m) => ({ default: m.ProductStudio })));

/**
 * Uploads to /api/uploads (resize → WebP renditions, EXIF/GPS stripped) and keeps each result as a hidden
 * `images` input holding the pipeline metadata as JSON. Photos are pre-compressed in the browser (compressForUpload). The first image is the product's cover.
 */
export function ImageUploader({ initial = [], maxMb, max = 8, studio = null }: { initial?: ProductImageInput[]; maxMb: number; max?: number; studio?: StudioInfo | null }) {
  const t = useTranslations("products");
  const te = useTranslations("errors");
  const [images, setImages] = useState<ProductImageInput[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Product Studio (SF9): which photo is open, and this month's edits left (updated after each save).
  const [editing, setEditing] = useState<number | null>(null);
  const [left, setLeft] = useState(studio?.remaining ?? 0);
  const ts = useTranslations("studio");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(undefined);
    try {
      for (const picked of Array.from(files).slice(0, max - images.length)) {
        // Downscale to ≤2048 px WebP in the browser first (mobile data + Vercel's body limit); server finishes it.
        const f = await compressForUpload(picked);
        if (f.size > maxMb * 1024 * 1024) {
          setError("file_too_large");
          continue;
        }
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const j = (await res.json()) as { url?: string; image?: ProductImageInput; error?: string };
        if (!res.ok || !j.image) setError(j.error ?? "generic");
        else setImages((list) => [...list, j.image!]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="label">{t("images")}</span>
      <ul className="mb-2 flex flex-wrap gap-2">
        {images.map((img, i) => (
          <li key={img.url} className="relative">
            <input type="hidden" name="images" value={JSON.stringify(img)} />
            <ResponsiveImage
              image={img}
              alt=""
              sizes={SIZES.thumb}
              index={i}
              aboveTheFold={0}
              className="h-20 w-20 rounded-xl border border-line object-cover"
            />
            <button
              type="button"
              aria-label={t("removeImage")}
              className="absolute -end-2 -top-2 grid h-11 w-11 place-items-center rounded-full bg-ink text-paper sm:h-7 sm:w-7"
              onClick={() => setImages((list) => list.filter((_, j) => j !== i))}
            >
              <Icon as={X} size={16} strokeWidth={2} />
            </button>
            {studio && studio.limit > 0 && (
              <button type="button" onClick={() => setEditing(i)} className="mt-1 inline-flex min-h-11 w-20 items-center justify-center gap-1 rounded-xl border border-line bg-white text-[13px] font-semibold" data-testid={`studio-open-${i}`}>
                <Icon as={Sparkles} size={14} /> {ts("open")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {images.length < max && (
        <label className="btn-ghost btn-sm cursor-pointer">
          {busy ? "…" : (
            <>
              <Icon as={Plus} size={16} /> {t("addImages")}
            </>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        </label>
      )}
      <p className="hint">{t("imagesHint", { mb: maxMb })}</p>
      {error && <p className="field-error">{te(error as "generic")}</p>}
      {studio && studio.limit === 0 && images.length > 0 && (
        <p className="hint" data-testid="studio-locked">{ts("locked")} <Link href="/dashboard/upgrade" className="inline-flex min-h-11 items-center font-semibold text-[#2563EB] underline">{ts("upgrade")}</Link></p>
      )}
      {studio && editing !== null && images[editing] && (
        <Suspense fallback={null}>
          <ProductStudio
            image={images[editing]!}
            info={{ ...studio, remaining: left }}
            maxMb={maxMb}
            onUsage={setLeft}
            onSaved={(img) => setImages((list) => list.map((x, j) => (j === editing ? img : x)))}
            onClose={() => setEditing(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
