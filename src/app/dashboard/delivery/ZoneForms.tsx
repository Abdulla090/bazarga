"use client";
import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addZoneAction, deleteZoneAction, updateZoneAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";

export function ZoneRow({ id, name, fee, isActive }: { id: string; name: string; fee: number; isActive: boolean }) {
  const t = useTranslations("delivery");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(updateZoneAction, {});
  const [delPending, start] = useTransition();
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 p-3">
      <input type="hidden" name="id" value={id} />
      <span className="min-w-28 flex-1 font-bold">{name}</span>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">{t("fee")}</span>
        <input name="fee" type="number" min={0} step={250} defaultValue={fee} className="input num w-32" dir="ltr" aria-label={t("fee")} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="h-5 w-5 accent-[#1F8A5B]" />
        {t("active")}
      </label>
      <button className="btn-gold btn-sm" disabled={pending}>{state.ok && !pending ? "✓" : tc("save")}</button>
      <button type="button" className="btn-ghost btn-sm" disabled={delPending} onClick={() => confirm(tc("confirmDelete")) && start(() => deleteZoneAction(id))} aria-label={tc("delete")}>
        🗑
      </button>
      {state.error && <div className="w-full"><FormError error={state.error} /></div>}
    </form>
  );
}

export function AddZoneForm() {
  const t = useTranslations("delivery");
  const [state, action, pending] = useActionState(addZoneAction, {});
  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-4 sm:items-end">
      <div>
        <label className="label" htmlFor="z-key">{t("cityKey")}</label>
        <input id="z-key" name="cityKey" required className="input num" dir="ltr" placeholder="ranya" pattern="[a-z0-9-]{2,40}" />
      </div>
      <div>
        <label className="label" htmlFor="z-ku">{t("city")} · کوردی</label>
        <input id="z-ku" name="name.ku" className="input" dir="rtl" />
      </div>
      <div>
        <label className="label" htmlFor="z-en">{t("city")} · English</label>
        <input id="z-en" name="name.en" className="input" dir="ltr" />
      </div>
      <div>
        <label className="label" htmlFor="z-fee">{t("fee")}</label>
        <input id="z-fee" name="fee" type="number" min={0} step={250} required className="input num" dir="ltr" />
      </div>
      <button className="btn-gold sm:col-span-4" disabled={pending}>+ {t("add")}</button>
      <div className="sm:col-span-4"><FormError error={state.fieldErrors?.name ? "name_required" : state.error} /></div>
    </form>
  );
}
