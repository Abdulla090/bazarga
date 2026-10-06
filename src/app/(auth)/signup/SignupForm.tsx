"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signUpAction } from "@/server/actions/auth";
import { Field, FormError } from "@/components/forms/Field";

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(signUpAction, {});
  return (
    <form action={action} className="card grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t("signupTitle")}</h1>
        <p className="text-ink-70">{t("signupSub")}</p>
      </div>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("name")} name="name" autoComplete="name" required error={state.fieldErrors?.name} />
      <Field label={t("email")} name="email" type="email" autoComplete="email" required ltr error={state.fieldErrors?.email} />
      <Field label={t("password")} name="password" type="password" autoComplete="new-password" minLength={8} required ltr hint={t("passwordHint")} error={state.fieldErrors?.password} />
      <button className="btn-gold" disabled={pending}>{t("signup")}</button>
      <p className="text-sm">{t("haveAccount")} <Link href="/login" className="font-bold underline">{t("login")}</Link></p>
    </form>
  );
}
