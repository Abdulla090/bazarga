"use client";
import { useActionState, useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { savePayoutProfileAction, setOnlinePaymentsAction } from "@/server/actions/gateway-payments";
import { Field, FormError } from "@/components/forms/Field";

type Profile = { method: "fib" | "zaincash" | "bank"; accountName: string; accountIdentifier: string; status: "pending" | "verified" | "rejected" } | null;

/**
 * Settings › Payments › Online payments. Provider off → "coming soon" + the payout form (so sellers are ready).
 * Provider on → payout status + the storefront toggle, enabled only once an admin verified the payout details.
 */
export function OnlinePaymentsCard({ gatewayOn, profile, enabled, balance }: { gatewayOn: boolean; profile: Profile; enabled: boolean; balance: string | null }) {
  const t = useTranslations("gatewayPay");
  const tp = useTranslations("payments");
  const [state, action, saving] = useActionState(savePayoutProfileAction, {});
  const [on, setOn] = useOptimistic(enabled);
  const [toggling, start] = useTransition();
  const verified = profile?.status === "verified";
  const tone = profile?.status === "verified" ? "bg-green/10 text-green-deep" : profile?.status === "rejected" ? "bg-danger/10 text-danger" : "bg-gold/10 text-gold";
  return (
    <section className="card grid gap-5" aria-labelledby="online-pay-title" data-testid="online-payments-card">
      <div className="grid gap-1">
        <h2 id="online-pay-title" className="font-bold">{t("settingsTitle")}</h2>
        {!gatewayOn ? (
          <>
            <p className="text-sm font-medium" data-testid="online-coming-soon">{t("comingSoon")}</p>
            <p className="hint">{t("comingSoonHint")}</p>
          </>
        ) : (
          <p className="hint">{t("toggleHint")}</p>
        )}
      </div>

      {gatewayOn && (
        <div className="flex flex-wrap items-center gap-3 border-y border-line py-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("toggleLabel")}</p>
            {!verified && <p className="hint">{t("needVerified")}</p>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("toggleLabel")}
            disabled={toggling || (!verified && !on)}
            onClick={() =>
              start(async () => {
                setOn(!on);
                await setOnlinePaymentsAction(!on);
              })
            }
            className={`chip min-h-11 min-w-16 px-4 disabled:opacity-50 ${on ? "bg-gold text-white" : "bg-ink/10 text-ink-70"}`}
          >
            {on ? tp("on") : tp("off")}
          </button>
        </div>
      )}

      <form action={action} className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{t("payoutTitle")}</h3>
          {profile && <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`} data-testid="payout-status">{t(`status.${profile.status}`)}</span>}
        </div>
        <fieldset className="grid gap-2">
          <legend className="label">{t("payoutMethod")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["fib", "zaincash", "bank"] as const).map((m, i) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold/5 has-[:checked]:font-medium">
                <input type="radio" name="method" value={m} defaultChecked={profile ? profile.method === m : i === 0} className="accent-[#2563EB]" />
                {t(`method.${m}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t("accountName")} name="accountName" defaultValue={profile?.accountName ?? ""} required maxLength={80} autoComplete="name" error={state.fieldErrors?.accountName} />
        <Field label={t("accountId")} name="accountIdentifier" defaultValue={profile?.accountIdentifier ?? ""} required maxLength={40} ltr inputMode="text" error={state.fieldErrors?.accountIdentifier} />
        <FormError error={state.error} />
        {state.ok && <p className="text-sm text-green-deep" role="status">{t("saved")}</p>}
        <button disabled={saving} className="min-h-12 rounded-full bg-ink px-6 text-white disabled:opacity-60">{t("save")}</button>
      </form>

      {balance && (
        <p className="flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-ink-70">{t("balance")}</span>
          <span className="num font-bold" dir="ltr">{balance}</span>
        </p>
      )}
    </section>
  );
}
