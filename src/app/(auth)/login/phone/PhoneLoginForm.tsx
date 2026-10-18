"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { sendLoginCodeAction, verifyLoginCodeAction } from "@/server/actions/phone-auth";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";
import type { ActionState } from "@/server/actions/util";

function PhoneStep({ action, state, pending }: { action: (fd: FormData) => void; state: ActionState; pending: boolean }) {
  const t = useTranslations("auth");
  const keep = useKeepValues(action);
  return (
    <form action={action} onSubmit={keep} className="grid gap-5" data-testid="otp-phone-form">
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <Field label={t("phoneLabel")} name="phone" type="tel" inputMode="tel" autoComplete="tel" required ltr placeholder="0750 123 4567" hint={t("phoneHint")} error={state.fieldErrors?.phone} />
      <button className="btn-gold w-full" disabled={pending} aria-busy={pending || undefined} data-testid="otp-send">{t("phoneSend")}</button>
    </form>
  );
}

function CodeStep({ phone, next, devCode, onBack, resend }: { phone: string; next?: string | null; devCode: string; onBack: () => void; resend: (fd: FormData) => void }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(verifyLoginCodeAction, {});
  const keep = useKeepValues(action);
  return (
    <div className="grid gap-4">
      <p role="status" className="rounded-xl bg-green/10 px-3 py-2 font-semibold text-green">{t("phoneSent", { phone: `+${phone}` })}</p>
      {devCode && <p className="hint" data-testid="otp-dev-code">{t("phoneDevCode")} <bdi dir="ltr" className="font-bold">{devCode}</bdi></p>}
      <form action={action} onSubmit={keep} className="grid gap-5" data-testid="otp-code-form">
        <input type="hidden" name="phone" value={phone} />
        {next && <input type="hidden" name="next" value={next} />}
        <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
        <Field label={t("phoneCode")} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9٠-٩۰-۹ ]{6,7}" maxLength={7} required ltr autoFocus hint={t("phoneCodeHint")} error={state.fieldErrors?.code} />
        <button className="btn-gold w-full" disabled={pending} aria-busy={pending || undefined} data-testid="otp-verify">{t("phoneVerify")}</button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-ink-70 underline">{t("phoneChange")}</button>
        <form action={resend}>
          <input type="hidden" name="phone" value={phone} />
          <button className="inline-flex min-h-11 items-center font-bold underline" data-testid="otp-resend">{t("phoneResend")}</button>
        </form>
      </div>
    </div>
  );
}

/** Sign in with WhatsApp (SF8): number → 6-digit code on WhatsApp → signed in. */
export function PhoneLoginForm({ next }: { next?: string | null }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(sendLoginCodeAction, {});
  // "Use another number" dismisses this result; a new send (or resend) is a new state object and shows the code step again.
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const sentPhone = state.ok && state !== dismissed && typeof state.data?.phone === "string" ? state.data.phone : "";
  return (
    <div className="grid gap-5 border-t border-[#E7E5E4] pt-8">
      <h1 className="t-headline">{t("phoneTitle")}</h1>
      <p className="hint">{t("phoneIntro")}</p>
      {sentPhone ? (
        <CodeStep key={sentPhone} phone={sentPhone} next={next} devCode={String(state.data?.devCode ?? "")} onBack={() => setDismissed(state)} resend={action} />
      ) : (
        <PhoneStep action={action} state={state} pending={pending} />
      )}
      <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="inline-flex min-h-11 items-center justify-center text-sm text-ink-70 underline">{t("phoneUseEmail")}</Link>
    </div>
  );
}
