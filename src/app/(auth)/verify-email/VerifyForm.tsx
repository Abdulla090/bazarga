"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { verifyEmailAction } from "@/server/actions/auth";
import { FormError } from "@/components/forms/Field";

export function VerifyForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(verifyEmailAction, {});
  return (
    <form action={action} className="grid gap-5 border-t border-[#E7E5E4] pt-8">
      <div>
        <h1 className="t-headline">{t("verifyTitle")}</h1>
        <p className="text-ink-70">{t("verifySub")}</p>
      </div>
      {state.ok ? (
        <>
          <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{t("verifyDone")}</p>
          <Link href="/dashboard" className="btn-gold">{t("goDashboard")}</Link>
        </>
      ) : (
        <>
          <FormError error={state.fieldErrors?.token ? "invalid_or_expired_token" : state.error === "VALIDATION" ? "invalid_or_expired_token" : state.error} />
          <input type="hidden" name="token" value={token} />
          <button className="btn-gold" disabled={pending || !token}>{t("verifyCta")}</button>
        </>
      )}
    </form>
  );
}
