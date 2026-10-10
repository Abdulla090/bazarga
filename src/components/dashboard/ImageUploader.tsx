"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, Plus, X } from "@/components/ui/icons";
import type { ProductImageInput } from "@/lib/validation";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SIZES } from "@/lib/responsive-image";

/**
 * Uploads to /api/uploads (resize → WebP renditions, EXIF/GPS stripped) and keeps each result as a hidden
 * `images` input holding the pipeline metadata as JSON. The first image is the product's cover.
 */
export function ImageUploader({ initial = [], maxMb, max = 8 }: { initial?: ProductImageInput[]; maxMb: number; max?: number }) {
  const t = useTranslations("products");
  const te = useTranslations("errors");
  const [images, setImages] = useState<ProductImageInput[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(undefined);
    try {
      for (const f of Array.from(files).slice(0, max - images.length)) {
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
    </div>
  );
}
