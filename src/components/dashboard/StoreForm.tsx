"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormError } from "@/components/forms/Field";
import { slugify } from "@/lib/slug";
import { LOCALE_LABEL, UI_LOCALES } from "@/lib/i18n";
import type { ActionState } from "@/server/actions/util";

type StoreValues = {
  name: string;
  slug: string;
  defaultLocale: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  logoUrl?: string | null;
  tagline?: Record<string, string>;
};

export function StoreForm({
  action,
  initial,
  cities,
  mode,
  rootDomain,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: StoreValues;
  cities: { key: string; name: string }[];
  mode: "create" | "edit";
  rootDomain: string;
}) {
  const t = useTranslations("onboarding");
  const ts = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, {});
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card grid min-w-0 grid-cols-1 gap-4">
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      {state.ok && <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{tc("saved")}</p>}
      <Field
        label={t("storeName")}
        name="name"
        required
        defaultValue={initial?.name}
        error={fe.name}
        onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
      />
      <div className="min-w-0">
        <label className="label" htmlFor="f-slug">{t("slug")}</label>
        {/* The host can be long (preview tunnels, long custom domains): the prefix is capped, never sets the field's
            min-content width, and truncates from its start so the "…/s/" end stays visible next to the slug. The
            full resulting link is shown on its own wrapping line below. */}
        <div className="flex w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-line bg-white focus-within:border-ink" dir="ltr">
          <span className="num flex min-w-0 max-w-[55%] shrink items-center bg-paper ps-3 pe-1 text-sm text-ink-50" title={`${rootDomain}/s/`} aria-hidden="true">
            <span dir="rtl" className="block min-w-0 truncate">{"\u2066"}{rootDomain}/s/{"\u2069"}</span>
          </span>
          <input
            id="f-slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="num min-h-11 w-0 min-w-[8ch] flex-1 px-2 text-base outline-none"
            pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
            aria-invalid={!!fe.slug || undefined}
          />
        </div>
        <p className="hint min-w-0 break-all"><bdi dir="ltr" className="num">{rootDomain}/s/{slug || "…"}</bdi></p>
        {fe.slug ? <SlugError code={fe.slug} /> : <p className="hint">{t("slugHint")}</p>}
        {mode === "edit" && <p className="hint">{ts("danger")}</p>}
      </div>
      <div>
        <label className="label" htmlFor="f-locale">{t("defaultLanguage")}</label>
        <select id="f-locale" name="defaultLocale" className="input" defaultValue={initial?.defaultLocale ?? "ku"}>
          {UI_LOCALES.map((l) => (
            <option key={l} value={l}>{LOCALE_LABEL[l]}</option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("whatsapp")} name="whatsapp" inputMode="tel" ltr placeholder="0750 123 4567" defaultValue={initial?.whatsapp ?? ""} hint={t("whatsappHint")} error={fe.whatsapp} />
        <Field label={t("phone")} name="phone" inputMode="tel" ltr placeholder="0750 123 4567" defaultValue={initial?.phone ?? ""} error={fe.phone} />
        <Field label={t("instagram")} name="instagram" ltr placeholder="@yourshop" defaultValue={initial?.instagram ?? ""} error={fe.instagram} />
        <div>
          <label className="label" htmlFor="f-city">{t("city")}</label>
          <select id="f-city" name="city" className="input" defaultValue={initial?.city ?? "erbil"}>
            {cities.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      {mode === "edit" && (
        <>
          <fieldset className="grid gap-3">
            <legend className="label">{ts("tagline")}</legend>
            {(["ku", "ar", "en"] as const).map((l) => (
              <input key={l} name={`tagline.${l}`} className="input" dir={l === "en" ? "ltr" : "rtl"} placeholder={LOCALE_LABEL[l]} defaultValue={initial?.tagline?.[l] ?? ""} maxLength={200} />
            ))}
          </fieldset>
          <div>
            <label className="label" htmlFor="f-logo">{ts("logo")}</label>
            {initial?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.logoUrl} alt="" className="mb-2 h-16 w-16 rounded-xl object-cover" />
            )}
            <input id="f-logo" type="file" name="logo" accept="image/jpeg,image/png,image/webp" className="block min-h-11 w-full max-w-full text-base file:me-3 file:min-h-11 file:rounded-full file:border file:border-line file:bg-white file:px-4 file:font-semibold" />
          </div>
        </>
      )}
      <button className="btn-gold" disabled={pending}>{mode === "create" ? t("create") : tc("save")}</button>
    </form>
  );
}

function SlugError({ code }: { code: string }) {
  const te = useTranslations("errors");
  return <p className="field-error">{te((code === "VALIDATION" ? "invalid_slug" : code) as "generic")}</p>;
}
