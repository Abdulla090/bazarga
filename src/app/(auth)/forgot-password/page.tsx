"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { forgotPasswordAction } from "@/server/actions/auth";
import { Field, FormError } from "@/components/forms/Field";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  return (
    <form action={action} className="card grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t("forgotTitle")}</h1>
        <p className="text-ink-70">{t("forgotSub")}</p>
      </div>
      {state.ok ? (
        <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{t("forgotSent")}</p>
      ) : (
        <>
          <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
          <Field label={t("email")} name="email" type="email" autoComplete="email" required ltr error={state.fieldErrors?.email} />
          <button className="btn-gold" disabled={pending}>{t("sendLink")}</button>
        </>
      )}
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm underline">{t("login")}</Link>
    </form>
  );
}
