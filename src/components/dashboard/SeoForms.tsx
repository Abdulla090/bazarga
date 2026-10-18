"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveProductSeoAction, saveStoreSeoAction } from "@/server/actions/seo";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from "@/lib/seo";

function Saved({ ok }: { ok?: boolean }) {
  const tc = useTranslations("common");
  return ok ? <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{tc("saved")}</p> : null;
}

function Description({ name, defaultValue, label, hint }: { name: string; defaultValue: string; label: string; hint: string }) {
  return (
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <textarea id={`f-${name}`} name={name} defaultValue={defaultValue} maxLength={SEO_DESCRIPTION_MAX} rows={3} dir="auto" className="input w-full" />
      <p className="hint">{hint}</p>
    </div>
  );
}

/** Store-level SEO + white-label switch (Max). */
export function StoreSeoForm({ initial, placeholderTitle }: { initial: { title: string; description: string; ogImageUrl: string; whiteLabel: boolean }; placeholderTitle: string }) {
  const t = useTranslations("seo");
  const [state, action, pending] = useActionState(saveStoreSeoAction, {});
  const keep = useKeepValues(action);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={keep} className="card grid gap-4" data-testid="store-seo-form">
      <div className="grid gap-1">
        <h2 className="text-lg font-bold">{t("storeTitle")}</h2>
        <p className="hint">{t("storeHint")}</p>
      </div>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <Saved ok={state.ok} />
      <Field label={t("metaTitle")} name="title" dir="auto" defaultValue={initial.title} placeholder={placeholderTitle} maxLength={SEO_TITLE_MAX} hint={t("metaTitleHint", { n: SEO_TITLE_MAX })} error={fe.title ? "VALIDATION" : undefined} />
      <Description name="description" label={t("metaDescription")} defaultValue={initial.description} hint={t("metaDescriptionHint", { n: SEO_DESCRIPTION_MAX })} />
      <Field label={t("ogImage")} name="ogImageUrl" ltr type="url" inputMode="url" defaultValue={initial.ogImageUrl} placeholder="https://…" hint={t("ogImageHint")} error={fe.ogImageUrl ? "invalid_image_url" : undefined} />
      <label className="flex min-h-11 items-start gap-3 rounded-xl border border-line p-3" data-testid="white-label">
        <input type="checkbox" name="whiteLabel" defaultChecked={initial.whiteLabel} className="mt-1 h-5 w-5 shrink-0 accent-[#2563EB]" />
        <span className="grid gap-0.5">
          <span className="font-semibold">{t("whiteLabel")}</span>
          <span className="hint">{t("whiteLabelHint")}</span>
        </span>
      </label>
      <button className="btn-gold" disabled={pending} aria-busy={pending || undefined}>{t("save")}</button>
    </form>
  );
}

/** Product-level meta (Max), under the product editor. */
export function ProductSeoForm({ productId, initial, placeholderTitle }: { productId: string; initial: { title: string; description: string }; placeholderTitle: string }) {
  const t = useTranslations("seo");
  const [state, action, pending] = useActionState(saveProductSeoAction, {});
  const keep = useKeepValues(action);
  return (
    <details className="card" data-testid="product-seo">
      <summary className="min-h-11 cursor-pointer content-center font-bold">{t("productTitle")}</summary>
      <form action={action} onSubmit={keep} className="mt-3 grid gap-4">
        <input type="hidden" name="productId" value={productId} />
        <p className="hint">{t("productHint")}</p>
        <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
        <Saved ok={state.ok} />
        <Field label={t("metaTitle")} name="title" dir="auto" defaultValue={initial.title} placeholder={placeholderTitle} maxLength={SEO_TITLE_MAX} hint={t("metaTitleHint", { n: SEO_TITLE_MAX })} />
        <Description name="description" label={t("metaDescription")} defaultValue={initial.description} hint={t("metaDescriptionHint", { n: SEO_DESCRIPTION_MAX })} />
        <button className="btn-gold" disabled={pending} aria-busy={pending || undefined}>{t("save")}</button>
      </form>
    </details>
  );
}
