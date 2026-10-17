"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { joinWaitlistAction } from "@/server/actions/marketing";
import type { ActionState } from "@/server/actions/util";
import { WaitlistSpot } from "@/components/marketing/WaitlistSpot";
import { useKeepValues } from "@/lib/use-keep-values";

export function WaitlistForm({ cities, refCode = "" }: { cities: { key: string; name: string }[]; refCode?: string }) {
  const t = useTranslations("landing");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(joinWaitlistAction, {});
  const keep = useKeepValues(action);
  if (state.ok && state.data) {
    const d = state.data;
    return (
      <WaitlistSpot
        name={state.message ?? ""}
        code={String(d.code)}
        position={Number(d.position)}
        total={Number(d.total)}
        referrals={Number(d.referrals)}
        returning={d.existing === true}
      />
    );
  }
  const err = (f: string) => state.fieldErrors?.[f] && <p className="field-error">{te(state.fieldErrors[f] as "generic")}</p>;
  return (
    <form action={action} onSubmit={keep} className="card grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="ref" value={refCode} />
      {refCode && <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm font-medium text-ink sm:col-span-2" data-testid="waitlist-invited">{t("wlInvited")}</p>}
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
        <select id="w-sells" name="sells" required className="select" defaultValue="">
          <option value="" disabled>{t("choose")}</option>
          {(["c1", "c2", "c3", "c4", "c5", "other"] as const).map((k) => (
            <option key={k} value={k}>{t(k)}</option>
          ))}
        </select>
        {err("sells")}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="w-city">{t("fCity")}</label>
        <select id="w-city" name="city" required className="select" defaultValue="">
          <option value="" disabled>{t("choose")}</option>
          {cities.map((c) => (
            <option key={c.key} value={c.key}>{c.name}</option>
          ))}
          <option value="other">{t("other")}</option>
        </select>
        {err("city")}
      </div>
      {state.error && <p className="field-error sm:col-span-2" role="alert">{state.error === "VALIDATION" ? t("formError") : te(state.error as "generic")}</p>}
      <button className="btn-gold sm:col-span-2" disabled={pending} aria-busy={pending || undefined}>{t("submit")}</button>
    </form>
  );
}
