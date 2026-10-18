"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { acceptInviteAction } from "@/server/actions/team";
import { FormError } from "@/components/forms/Field";

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations("team");
  const [state, action, pending] = useActionState(acceptInviteAction, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <FormError error={state.error === "VALIDATION" ? undefined : state.error} />
      <button className="btn-gold min-h-11" disabled={pending} aria-busy={pending || undefined} data-testid="invite-accept">{t("accept")}</button>
    </form>
  );
}
