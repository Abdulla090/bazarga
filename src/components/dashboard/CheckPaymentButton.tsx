"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { checkOrderPaymentAction } from "@/server/actions/payments";
import { FormError } from "@/components/forms/Field";

export function CheckPaymentButton({ orderId }: { orderId: string }) {
  const t = useTranslations("payStatus");
  const [state, action, pending] = useActionState(checkOrderPaymentAction, {});
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <button className="btn-ghost btn-sm w-fit" disabled={pending} data-testid="check-payment">{t("checkNow")}</button>
      <FormError error={state.error} />
    </form>
  );
}
