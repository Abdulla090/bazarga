"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signUpAction } from "@/server/actions/auth";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";

export function SignupForm({ legal, next }: { legal?: React.ReactNode; next?: string | null }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(signUpAction, {});
  const keep = useKeepValues(action);
  return (
    <form action={action} onSubmit={keep} className="grid gap-5 border-t border-[#E7E5E4] pt-8">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <h1 className="t-headline">{t("signupTitle")}</h1>
        <p className="text-ink-70">{t("signupSub")}</p>
      </div>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("name")} name="name" autoComplete="name" required error={state.fieldErrors?.name} />
      <Field label={t("email")} name="email" type="email" autoComplete="email" required ltr error={state.fieldErrors?.email} />
      <Field label={t("password")} name="password" type="password" autoComplete="new-password" minLength={8} required ltr hint={t("passwordHint")} error={state.fieldErrors?.password} />
      <button className="btn-gold w-full" disabled={pending} aria-busy={pending || undefined}>{t("signup")}</button>
      {legal}
      <p className="text-sm">{t("haveAccount")} <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="inline-flex min-h-11 items-center font-bold underline">{t("login")}</Link></p>
    </form>
  );
}
