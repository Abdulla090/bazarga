"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveStorefrontAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";
import { Icon, Plus, X } from "@/components/ui/icons";

type Values = { coverImageUrl: string | null; coverImagePlaceholder: string | null; freeDeliveryThreshold: number | null };
type Uploaded = { url?: string; image?: { url: string; placeholder?: string | null }; error?: string };

/**
 * Cover photo + free-delivery threshold. The photo goes to /api/uploads first (resize, WebP, EXIF strip); the
 * form then saves only the resulting URL + tiny placeholder, so the server action never handles file bytes.
 */
export function StorefrontForm({ initial, maxMb }: { initial: Values; maxMb: number }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(saveStorefrontAction, {});
  const [cover, setCover] = useState<{ url: string; placeholder: string | null } | null>(
    initial.coverImageUrl ? { url: initial.coverImageUrl, placeholder: initial.coverImagePlaceholder } : null,
  );
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const fe = state.fieldErrors ?? {};

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(undefined);
    if (file.size > maxMb * 1024 * 1024) return setUploadError("file_too_large");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as Uploaded;
      const url = j.image?.url ?? j.url;
      if (!res.ok || !url) setUploadError(j.error ?? "generic");
      else setCover({ url, placeholder: j.image?.placeholder ?? null });
    } catch {
      setUploadError("generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} className="card grid gap-4">
      <h2 className="text-lg font-bold">{t("storefrontTitle")}</h2>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      {state.ok && <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{tc("saved")}</p>}

      <div>
        <span className="label">{t("cover")}</span>
        <input type="hidden" name="coverImageUrl" value={cover?.url ?? ""} />
        <input type="hidden" name="coverImagePlaceholder" value={cover?.placeholder ?? ""} />
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            className="mb-2 aspect-[16/6] w-full rounded-xl border border-line bg-ink/10 object-cover"
            style={cover.placeholder ? { backgroundImage: `url("${cover.placeholder}")`, backgroundSize: "cover" } : undefined}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-ghost btn-sm cursor-pointer" aria-busy={busy || undefined}>
            {busy ? t("uploading") : (
              <>
                <Icon as={Plus} /> {cover ? t("changeCover") : t("uploadCover")}
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {cover && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setCover(null)}>
              <Icon as={X} /> {t("removeCover")}
            </button>
          )}
        </div>
        <p className="hint">{t("coverHint")}</p>
        {(uploadError || fe.coverImageUrl) && <p className="field-error">{te((uploadError ?? fe.coverImageUrl) as "generic")}</p>}
      </div>

      <div>
        <label className="label" htmlFor="f-free-threshold">{t("freeDeliveryThreshold")}</label>
        <input
          id="f-free-threshold"
          name="freeDeliveryThreshold"
          inputMode="numeric"
          dir="ltr"
          className="input num max-w-48"
          defaultValue={initial.freeDeliveryThreshold ?? ""}
          placeholder="50000"
          maxLength={14}
          aria-invalid={!!fe.freeDeliveryThreshold || undefined}
        />
        {fe.freeDeliveryThreshold ? (
          <p className="field-error">{te(fe.freeDeliveryThreshold === "VALIDATION" ? "invalid_threshold" : (fe.freeDeliveryThreshold as "invalid_threshold"))}</p>
        ) : (
          <p className="hint">{t("freeDeliveryHint")}</p>
        )}
      </div>

      <button className="btn-gold" disabled={pending || busy}>{t("saveStorefront")}</button>
    </form>
  );
}
