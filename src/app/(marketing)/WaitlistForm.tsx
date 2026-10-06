"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { joinWaitlistAction } from "@/server/actions/marketing";
import type { ActionState } from "@/server/actions/util";

export function WaitlistForm({ cities }: { cities: { key: string; name: string }[] }) {
  const t = useTranslations("landing");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(joinWaitlistAction, {});
  if (state.ok) {
    return (
      <div className="card text-center" role="status">
        <p className="text-2xl font-bold">{t("thanksTitle", { name: state.message ?? "" })}</p>
        <p className="mt-2 text-ink-70">{t("thanksBody")}</p>
      </div>
    );
  }
  const err = (f: string) => state.fieldErrors?.[f] && <p className="field-error">{te(state.fieldErrors[f] as "generic")}</p>;
  return (
    <form action={action} className="card grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label className="label" htmlFor="w-name">{t("fName")}</label>
        <input id="w-name" name="name" required className="input" autoComplete="name" />
        {err("name")}
      </div>
      <div>
        <label className="label" htmlFor="w-wa">{t("fWhatsapp")}</label>
        <input id="w-wa" name="whatsapp" required className="input num" inputMode="tel" dir="ltr" placeholder="0750 123 4567" />
        {err("whatsapp")}
      </div>
      <div>
        <label className="label" htmlFor="w-ig">{t("fInstagram")}</label>
        <input id="w-ig" name="instagram" className="input" dir="ltr" placeholder="@" />
      </div>
      <div>
        <label className="label" htmlFor="w-sells">{t("fSells")}</label>
        <select id="w-sells" name="sells" required className="input" defaultValue="">
          <option value="" disabled>{t("choose")}</option>
          {(["c1", "c2", "c3", "c4", "c5", "other"] as const).map((k) => (
            <option key={k} value={k}>{t(k)}</option>
          ))}
        </select>
        {err("sells")}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="w-city">{t("fCity")}</label>
        <select id="w-city" name="city" required className="input" defaultValue="">
          <option value="" disabled>{t("choose")}</option>
          {cities.map((c) => (
            <option key={c.key} value={c.key}>{c.name}</option>
          ))}
          <option value="other">{t("other")}</option>
        </select>
        {err("city")}
      </div>
      {state.error && <p className="field-error sm:col-span-2" role="alert">{state.error === "VALIDATION" ? t("formError") : te(state.error as "generic")}</p>}
      <button className="btn-gold sm:col-span-2" disabled={pending}>{t("submit")}</button>
    </form>
  );
}
