"use client";
import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { saveShowcaseAction } from "@/server/actions/dashboard";
import { FormError } from "@/components/forms/Field";

/** Opt in or out of the public /showcase (docs/DEMAND.md D4). One button flips the current state. */
export function ShowcaseToggle({ optedIn }: { optedIn: boolean }) {
  const t = useTranslations("showcase");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveShowcaseAction, {});
  return (
    <form action={action} className="card grid gap-3" data-testid="showcase-toggle" data-opted-in={optedIn}>
      <div className="grid gap-1">
        <h2 className="text-lg font-bold">{t("toggleTitle")}</h2>
        <p className="hint">{t("toggleHint")}</p>
      </div>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      {state.ok && <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{tc("saved")}</p>}
      <p className="font-semibold" aria-live="polite">{optedIn ? t("toggleOn") : t("toggleOff")}</p>
      <input type="hidden" name="optIn" value={optedIn ? "off" : "on"} />
      <div className="flex flex-wrap items-center gap-3">
        <button className={optedIn ? "btn-ghost" : "btn-gold"} disabled={pending}>{optedIn ? t("remove") : t("add")}</button>
        <Link href="/showcase" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#2563EB]">{t("view")}</Link>
      </div>
    </form>
  );
}
