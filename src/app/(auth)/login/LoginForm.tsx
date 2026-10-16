"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { logInAction } from "@/server/actions/auth";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(logInAction, {});
  const keep = useKeepValues(action);
  return (
    <form action={action} onSubmit={keep} className="grid gap-5 border-t border-[#E7E5E4] pt-8">
      <h1 className="t-headline">{t("loginTitle")}</h1>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <Field label={t("email")} name="email" type="email" autoComplete="email" required ltr error={state.fieldErrors?.email} />
      <Field label={t("password")} name="password" type="password" autoComplete="current-password" required ltr error={state.fieldErrors?.password} />
      <button className="btn-gold w-full" disabled={pending}>{t("login")}</button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-ink-70 underline">{t("forgot")}</Link>
        <span>{t("noAccount")} <Link href="/signup" className="inline-flex min-h-11 items-center font-bold underline">{t("signup")}</Link></span>
      </div>
      <p className="hint text-center">{t("phoneSoon")}</p>
    </form>
  );
}
