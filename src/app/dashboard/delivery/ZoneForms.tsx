"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addZoneAction, deleteAreaAction, deleteZoneAction, saveAreaAction, updateZoneAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";
import { Check, Icon, Trash2 } from "@/components/ui/icons";

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
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="h-5 w-5 accent-green" />
        {t("active")}
      </label>
      <button className="btn-gold btn-sm" disabled={pending}>{state.ok && !pending ? <Icon as={Check} label={tc("save")} /> : tc("save")}</button>
      <button type="button" className="btn-ghost btn-sm" disabled={delPending} onClick={() => confirm(tc("confirmDelete")) && start(() => deleteZoneAction(id))} aria-label={tc("delete")}>
        <Icon as={Trash2} />
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

export type AreaValues = { id: string; name: { ku?: string; ar?: string; en?: string }; fee: number | null };

/** One area of a city: rename (ku / ar / en) and an optional fee override; empty fee = the city's fee. */
export function AreaForm({ zoneId, cityFee, area }: { zoneId: string; cityFee: number; area?: AreaValues }) {
  const t = useTranslations("delivery");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveAreaAction, {});
  const [delPending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const p = area?.id ?? `new-${zoneId}`;
  useEffect(() => {
    if (state.ok && !area) formRef.current?.reset();
  }, [state, area]);
  return (
    <form ref={formRef} action={action} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_1fr_1fr_8rem_auto] sm:items-end" data-testid={area ? "area-row" : "area-add"}>
      <input type="hidden" name={area ? "id" : "zoneId"} value={area?.id ?? zoneId} />
      <div className="min-w-0">
        <label className="label text-xs" htmlFor={`${p}-ku`}>{t("areaName")} · کوردی</label>
        <input id={`${p}-ku`} name="name.ku" defaultValue={area?.name.ku} className="input" dir="rtl" />
      </div>
      <div className="min-w-0">
        <label className="label text-xs" htmlFor={`${p}-ar`}>{t("areaName")} · عربي</label>
        <input id={`${p}-ar`} name="name.ar" defaultValue={area?.name.ar} className="input" dir="rtl" />
      </div>
      <div className="min-w-0">
        <label className="label text-xs" htmlFor={`${p}-en`}>{t("areaName")} · English</label>
        <input id={`${p}-en`} name="name.en" defaultValue={area?.name.en} className="input" dir="ltr" />
      </div>
      <div className="min-w-0">
        <label className="label text-xs" htmlFor={`${p}-fee`}>{t("areaFee")}</label>
        <input id={`${p}-fee`} name="fee" type="number" inputMode="numeric" min={0} step={250} defaultValue={area?.fee ?? ""} placeholder={String(cityFee)} className="input num" dir="ltr" />
      </div>
      <div className="flex gap-2">
        <button className={`${area ? "btn-ink" : "btn-gold"} btn-sm flex-1`} disabled={pending}>
          {state.ok && !pending && area ? <Icon as={Check} label={tc("saved")} /> : area ? tc("save") : `+ ${t("addArea")}`}
        </button>
        {area && (
          <button type="button" className="btn-ghost btn-sm" disabled={delPending} onClick={() => confirm(tc("confirmDelete")) && start(() => deleteAreaAction(area.id))} aria-label={tc("delete")}>
            <Icon as={Trash2} />
          </button>
        )}
      </div>
      {state.error && <div className="sm:col-span-5"><FormError error={state.fieldErrors?.name ? "name_required" : state.error} /></div>}
    </form>
  );
}
