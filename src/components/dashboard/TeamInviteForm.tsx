"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { inviteMemberAction } from "@/server/actions/team";
import { Field, FormError } from "@/components/forms/Field";
import { useKeepValues } from "@/lib/use-keep-values";

/** Invite by email. With email configured the link is also sent; it is always shown so the owner can share it on WhatsApp. */
export function TeamInviteForm({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("team");
  const [state, action, pending] = useActionState(inviteMemberAction, {});
  const keep = useKeepValues(action);
  const [copied, setCopied] = useState(false);
  const link = typeof state.data?.link === "string" ? state.data.link : null;
  return (
    <form action={action} onSubmit={keep} className="card grid gap-4" data-testid="team-invite">
      <h2 className="text-lg font-bold">{t("inviteTitle")}</h2>
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <Field label={t("email")} name="email" type="email" ltr required autoComplete="off" disabled={disabled} error={state.fieldErrors?._ || state.fieldErrors?.email ? "VALIDATION" : undefined} />
      <button className="btn-gold" disabled={pending || disabled} aria-busy={pending || undefined}>{t("send")}</button>
      {state.ok && link && (
        <div role="status" className="grid gap-2 rounded-xl border border-line bg-paper p-3" data-testid="invite-result">
          <p className="font-semibold">{state.data?.emailed ? t("emailed", { email: String(state.data.email) }) : t("copyHint")}</p>
          <input readOnly value={link} dir="ltr" className="input num w-full text-sm" onFocus={(e) => e.currentTarget.select()} data-testid="invite-link" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost btn-sm min-h-11" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true))}>{copied ? t("copied") : t("copy")}</button>
            <a className="btn-ghost btn-sm inline-flex min-h-11 items-center" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(link)}`}>{t("whatsapp")}</a>
          </div>
        </div>
      )}
    </form>
  );
}
