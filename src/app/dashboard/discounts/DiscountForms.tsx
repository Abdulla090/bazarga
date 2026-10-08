"use client";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveDiscountAction, toggleDiscountAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";
import { Check, Icon } from "@/components/ui/icons";

export type DiscountFormValues = {
  id?: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  /** "YYYY-MM-DD" in Iraq time, "" = open. */
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  showOnStorefront: boolean;
};

/** Create (no `initial`) or edit a code. Field errors come back keyed by the zod path. */
export function DiscountForm({ initial }: { initial?: DiscountFormValues }) {
  const t = useTranslations("discounts");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(saveDiscountAction, {});
  const [type, setType] = useState<DiscountFormValues["type"]>(initial?.type ?? "percentage");
  const formRef = useRef<HTMLFormElement>(null);
  const p = initial?.id ?? "new";
  useEffect(() => {
    // Clear the "new code" form after a successful create (the reset event puts the type back too).
    if (state.ok && !initial) formRef.current?.reset();
  }, [state, initial]);
  const err = (k: string) => {
    const e = state.fieldErrors?.[k];
    return e ? <p id={`${p}-${k}-err`} className="field-error">{te(e as "generic")}</p> : null;
  };
  return (
    <form ref={formRef} action={action} onReset={() => setType(initial?.type ?? "percentage")} className="grid gap-3 sm:grid-cols-2" noValidate>
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="label" htmlFor={`${p}-code`}>{t("code")}</label>
        <input id={`${p}-code`} name="code" required defaultValue={initial?.code} className="input num uppercase" dir="ltr" autoCapitalize="characters" autoComplete="off" maxLength={32} placeholder="EID20" aria-invalid={!!state.fieldErrors?.code || undefined} />
        {err("code") ?? <p className="hint">{t("codeHint")}</p>}
      </div>
      <fieldset>
        <legend className="label">{t("type")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["percentage", "fixed"] as const).map((v) => (
            <label key={v} className={`chip min-h-11 cursor-pointer px-3 ${type === v ? "bg-ink text-paper" : "bg-ink/5 text-ink-70"}`}>
              <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
              {t(v)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor={`${p}-value`}>{type === "percentage" ? t("valuePercent") : t("valueFixed")}</label>
        <input id={`${p}-value`} name="value" type="number" inputMode="numeric" required min={1} max={type === "percentage" ? 90 : undefined} step={type === "percentage" ? 1 : 250} defaultValue={initial?.value} className="input num" dir="ltr" aria-invalid={!!state.fieldErrors?.value || undefined} />
        {err("value")}
      </div>
      <div>
        <label className="label" htmlFor={`${p}-min`}>{t("minSubtotal")}</label>
        <input id={`${p}-min`} name="minSubtotal" type="number" inputMode="numeric" min={0} step={1000} defaultValue={initial?.minSubtotal || ""} placeholder="0" className="input num" dir="ltr" />
        {err("minSubtotal")}
      </div>
      <div>
        <label className="label" htmlFor={`${p}-max`}>{t("maxUses")} <span className="hint">· {tc("optional")}</span></label>
        <input id={`${p}-max`} name="maxUses" type="number" inputMode="numeric" min={1} defaultValue={initial?.maxUses ?? ""} placeholder={t("unlimited")} className="input num" dir="ltr" />
        {err("maxUses")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="label" htmlFor={`${p}-start`}>{t("startsOn")}</label>
          <input id={`${p}-start`} name="startsOn" type="date" defaultValue={initial?.startsOn} className="input num w-full min-w-0" dir="ltr" />
          {err("startsOn")}
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${p}-end`}>{t("endsOn")}</label>
          <input id={`${p}-end`} name="endsOn" type="date" defaultValue={initial?.endsOn} className="input num w-full min-w-0" dir="ltr" />
          {err("endsOn")}
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-5 w-5 accent-green" />
        {t("active")}
      </label>
      <label className="flex min-h-11 items-start gap-2 sm:col-span-2">
        <input type="checkbox" name="showOnStorefront" defaultChecked={initial?.showOnStorefront ?? false} className="mt-0.5 h-5 w-5 shrink-0 accent-green" aria-describedby={`${p}-banner-hint`} />
        <span className="min-w-0">
          <span className="font-semibold">{t("showOnStorefront")}</span>
          <span id={`${p}-banner-hint`} className="hint block">{t("showOnStorefrontHint")}</span>
        </span>
      </label>
      <button className="btn-gold sm:col-span-2" disabled={pending}>
        {state.ok && !pending ? <><Icon as={Check} /> {tc("saved")}</> : initial ? tc("save") : `+ ${tc("create")}`}
      </button>
      {state.error && state.error !== "VALIDATION" && <div className="sm:col-span-2"><FormError error={state.error} /></div>}
    </form>
  );
}

/** Active / off switch with an optimistic flip (rolled back by the server state on failure). */
export function DiscountToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useTranslations("discounts");
  const [on, setOn] = useOptimistic(isActive);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? t("deactivate") : t("activate")}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          await toggleDiscountAction(id, !on);
        })
      }
      className={`chip min-h-11 shrink-0 px-4 ${on ? "bg-green text-white" : "bg-ink/10 text-ink-70"}`}
    >
      {on ? t("active") : t("inactive")}
    </button>
  );
}
