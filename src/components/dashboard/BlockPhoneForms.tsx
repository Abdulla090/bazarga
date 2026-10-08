"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { blockPhoneAction, unblockPhoneAction } from "@/server/actions/blocklist";
import { FormError } from "@/components/forms/Field";

/** Order page: block / unblock the order's phone for this store. Blocking asks first. */
export function BlockToggle({ phone, phoneLabel, orderId, blocked }: { phone: string; phoneLabel: string; orderId: string; blocked: boolean }) {
  const t = useTranslations("risk");
  const [state, action, pending] = useActionState(blocked ? unblockPhoneAction : blockPhoneAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!blocked && !confirm(t("blockConfirm", { phone: phoneLabel }))) e.preventDefault();
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="orderId" value={orderId} />
      <button className={blocked ? "btn-ghost btn-sm w-fit" : "btn-ghost btn-sm w-fit text-danger"} disabled={pending} data-testid={blocked ? "unblock-phone" : "block-phone"}>
        {blocked ? t("unblock") : t("block")}
      </button>
      <FormError error={state.error} />
    </form>
  );
}

/** Customers page: add a number to the store's blocklist. */
export function AddBlockedPhoneForm() {
  const t = useTranslations("risk");
  const [state, action, pending] = useActionState(blockPhoneAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" data-testid="block-phone-form">
      <div>
        <label className="label" htmlFor="bp-phone">{t("phone")}</label>
        <input id="bp-phone" name="phone" type="tel" inputMode="tel" required className="input num" dir="ltr" placeholder="0750 123 4567" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="bp-note">{t("note")}</label>
        <input id="bp-note" name="note" maxLength={200} className="input" />
      </div>
      <button className="btn-ink" disabled={pending}>{t("add")}</button>
      <div className="sm:col-span-3"><FormError error={state.error} /></div>
    </form>
  );
}

export function UnblockButton({ phone }: { phone: string }) {
  const t = useTranslations("risk");
  const [state, action, pending] = useActionState(unblockPhoneAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="phone" value={phone} />
      <button className="btn-ghost btn-sm" disabled={pending}>{t("unblock")}</button>
      <FormError error={state.error} />
    </form>
  );
}
