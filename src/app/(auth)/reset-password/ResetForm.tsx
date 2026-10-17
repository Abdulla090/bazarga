"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPasswordAction } from "@/server/actions/auth";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  const keep = useKeepValues(action);
  return (
    <form action={action} onSubmit={keep} className="grid gap-5 border-t border-[#E7E5E4] pt-8">
      <h1 className="t-headline">{t("resetTitle")}</h1>
      {state.ok ? (
        <>
          <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{t("resetDone")}</p>
          <Link href="/login" className="btn-gold">{t("login")}</Link>
        </>
      ) : (
        <>
          <FormError error={state.fieldErrors?.token ? "invalid_or_expired_token" : state.error === "VALIDATION" ? undefined : state.error} />
          <input type="hidden" name="token" value={token} />
          <Field label={t("newPassword")} name="password" type="password" autoComplete="new-password" minLength={8} required ltr hint={t("passwordHint")} error={state.fieldErrors?.password} />
          <button className="btn-gold" disabled={pending} aria-busy={pending || undefined}>{t("resetCta")}</button>
        </>
      )}
    </form>
  );
}
