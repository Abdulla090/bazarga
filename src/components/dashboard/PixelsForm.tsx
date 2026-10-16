"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { savePixelsAction } from "@/server/actions/dashboard";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";

/** Seller's own TikTok / Meta pixel IDs (S5). Both optional; empty turns the pixel off. */
export function PixelsForm({ initial }: { initial: { tiktokPixelId: string | null; metaPixelId: string | null } }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(savePixelsAction, {});
  const keep = useKeepValues(action);
  const fe = state.fieldErrors ?? {};
  const err = (k: string) => (fe[k] ? "invalid_pixel" : undefined);
  return (
    <form action={action} onSubmit={keep} className="card grid gap-4" data-testid="pixels-form">
      <div className="grid gap-1">
        <h2 className="text-lg font-bold">{t("pixelsTitle")}</h2>
        <p className="hint">{t("pixelsHint")}</p>
      </div>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      {state.ok && <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{tc("saved")}</p>}
      <Field label={t("tiktokPixel")} name="tiktokPixelId" ltr defaultValue={initial.tiktokPixelId ?? ""} placeholder="CABCDEF1234567890ABC" maxLength={32} autoComplete="off" error={err("tiktokPixelId")} />
      <Field label={t("metaPixel")} name="metaPixelId" ltr inputMode="numeric" defaultValue={initial.metaPixelId ?? ""} placeholder="123456789012345" maxLength={20} autoComplete="off" error={err("metaPixelId")} />
      <p className="hint">{t("pixelsPrivacy")}</p>
      <button className="btn-gold" disabled={pending}>{t("savePixels")}</button>
    </form>
  );
}
