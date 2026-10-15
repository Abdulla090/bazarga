"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resendVerificationAction } from "@/server/actions/auth";

/** Thin, non-blocking notice shown until the seller confirms their email. */
export function VerifyEmailBanner() {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(resendVerificationAction, {});
  return (
    <form
      action={action}
      data-testid="verify-banner"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-4 py-3 text-[14px] text-ink/80 print:hidden"
    >
      <p className="min-w-0 flex-1 basis-56">
        {state.ok ? <span role="status">{t("verifySent")}</span> : state.error ? <span role="alert">{te(state.error as "generic")}</span> : t("verifyBanner")}
      </p>
      {!state.ok && (
        <button disabled={pending} className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-[#2563EB] hover:bg-[#2563EB]/[0.06]">
          {t("verifyResend")}
        </button>
      )}
    </form>
  );
}
