"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

/** Uploads to /api/uploads and keeps the resulting URLs as hidden `imageUrls` inputs. */
export function ImageUploader({ initial = [], maxMb, max = 8 }: { initial?: string[]; maxMb: number; max?: number }) {
  const t = useTranslations("products");
  const te = useTranslations("errors");
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(undefined);
    try {
      for (const f of Array.from(files).slice(0, max - urls.length)) {
        if (f.size > maxMb * 1024 * 1024) {
          setError("file_too_large");
          continue;
        }
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const j = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !j.url) setError(j.error ?? "generic");
        else setUrls((u) => [...u, j.url!]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="label">{t("images")}</span>
      <ul className="mb-2 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <li key={u} className="relative">
            <input type="hidden" name="imageUrls" value={u} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-20 w-20 rounded-xl border border-line object-cover" />
            <button
              type="button"
              aria-label={t("removeImage")}
              className="absolute -end-2 -top-2 h-7 w-7 rounded-full bg-ink text-sm text-paper"
              onClick={() => setUrls((list) => list.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {urls.length < max && (
        <label className="btn-ghost btn-sm cursor-pointer">
          {busy ? "…" : `+ ${t("addImages")}`}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        </label>
      )}
      <p className="hint">{t("imagesHint", { mb: maxMb })}</p>
      {error && <p className="field-error">{te(error as "generic")}</p>}
    </div>
  );
}
