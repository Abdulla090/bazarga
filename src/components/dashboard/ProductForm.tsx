"use client";
import { Suspense, lazy, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveProductAction, deleteProductAction } from "@/server/actions/dashboard";
import { Field, FormError } from "@/components/forms/Field";
import { LOCALE_LABEL, type Locale } from "@/lib/i18n";
import type { ProductImageInput } from "@/lib/validation";
import { Check, Icon } from "@/components/ui/icons";
import { SpecsEditor, type SpecRow } from "./SpecsEditor";

// Upload/preview editor: its own chunk, fetched in parallel with hydration instead of in the first-load bundle.
const ImageUploader = lazy(() => import("./ImageUploader").then((m) => ({ default: m.ImageUploader })));

type Values = {
  id?: string;
  name: Partial<Record<Locale, string>>;
  description: Partial<Record<Locale, string>>;
  price: number | "";
  compareAtPrice: number | null;
  stock: number | null;
  sku: string | null;
  specs: SpecRow[];
  categoryId: string | null;
  badge?: "new" | "featured" | null;
  isActive: boolean;
  images: ProductImageInput[];
};

const LANGS: Locale[] = ["ku", "ar", "en", "kmr"];

export function ProductForm({ initial, categories, maxMb, defaultLang }: { initial: Values; categories: { id: string; name: string }[]; maxMb: number; defaultLang: Locale }) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(saveProductAction, {});
  const [lang, setLang] = useState<Locale>(defaultLang);
  const fe = state.fieldErrors ?? {};
  const nameError = Object.keys(fe).find((k) => k.startsWith("name")) ? "name_required" : undefined;
  const specsKey = Object.keys(fe).find((k) => k.startsWith("specs"));
  const specsError = specsKey ? fe[specsKey] : undefined;

  return (
    <form action={action} className="grid gap-4">
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <fieldset className="card grid gap-3">
        <legend className="sr-only">{t("translations")}</legend>
        <p className="font-bold">{t("translations")}</p>
        <p className="hint -mt-2">{t("translationsHint")}</p>
        <div role="tablist" className="flex flex-wrap gap-1">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={`inline-flex min-h-11 items-center rounded-full px-3 py-1 text-sm font-semibold sm:min-h-9 ${lang === l ? "bg-ink text-paper" : "border border-line"}`}
            >
              {LOCALE_LABEL[l]}
              {initial.name[l] ? <Icon as={Check} className="ms-1" /> : null}
            </button>
          ))}
        </div>
        {LANGS.map((l) => (
          <div key={l} hidden={lang !== l} className="grid gap-3" dir={l === "en" || l === "kmr" ? "ltr" : "rtl"}>
            <div>
              <label className="label" htmlFor={`name-${l}`}>{t("name")} · {LOCALE_LABEL[l]}</label>
              <input id={`name-${l}`} name={`name.${l}`} className="input" defaultValue={initial.name[l] ?? ""} maxLength={200} />
            </div>
            <div>
              <label className="label" htmlFor={`desc-${l}`}>{t("description")} · {LOCALE_LABEL[l]}</label>
              <textarea id={`desc-${l}`} name={`description.${l}`} className="input min-h-24" defaultValue={initial.description[l] ?? ""} maxLength={2000} />
            </div>
          </div>
        ))}
        {nameError && <p className="field-error">{te("name_required")}</p>}
      </fieldset>

      <div className="card grid gap-4 sm:grid-cols-2">
        <Field label={t("price")} name="price" type="number" inputMode="numeric" min={0} step={250} required ltr defaultValue={initial.price} error={fe.price} />
        <Field label={t("compareAt")} name="compareAtPrice" type="number" inputMode="numeric" min={0} step={250} ltr defaultValue={initial.compareAtPrice ?? ""} hint={t("compareAtHint")} error={fe.compareAtPrice ? "VALIDATION" : undefined} />
        <Field label={t("stock")} name="stock" type="number" inputMode="numeric" min={0} ltr defaultValue={initial.stock ?? ""} hint={t("stockHint")} error={fe.stock} />
        <Field label={t("sku")} name="sku" ltr maxLength={64} autoComplete="off" defaultValue={initial.sku ?? ""} hint={t("skuHint")} error={fe.sku} />
        <div>
          <label className="label" htmlFor="f-cat">{t("category")}</label>
          <select id="f-cat" name="categoryId" className="select" defaultValue={initial.categoryId ?? ""}>
            <option value="">{t("noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-badge">{t("badge")}</label>
          <select id="f-badge" name="badge" className="select" defaultValue={initial.badge ?? ""} aria-describedby="f-badge-hint">
            <option value="">{t("badgeNone")}</option>
            <option value="new">{t("badgeNew")}</option>
            <option value="featured">{t("badgeFeatured")}</option>
          </select>
          <p id="f-badge-hint" className="hint">{t("badgeHint")}</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 font-semibold sm:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="h-5 w-5 accent-green" />
          {t("active")}
        </label>
      </div>

      <div className="card">
        <SpecsEditor initial={initial.specs} lang={lang} error={specsError} />
      </div>

      <div className="card">
        <Suspense fallback={<div className="min-h-28 animate-pulse rounded-xl border border-line" aria-hidden />}>
          <ImageUploader initial={initial.images} maxMb={maxMb} />
        </Suspense>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-gold" disabled={pending}>{tc("save")}</button>
        {initial.id && (
          <button
            type="button"
            className="btn-danger"
            onClick={async () => {
              if (confirm(tc("confirmDelete"))) await deleteProductAction(initial.id!);
            }}
          >
            {tc("delete")}
          </button>
        )}
      </div>
    </form>
  );
}
