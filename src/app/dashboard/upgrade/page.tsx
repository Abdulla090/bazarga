import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { pendingRequestFor } from "@/server/services/upgrades";
import { submitUpgradeForm } from "@/server/actions/upgrade";
import { payOnlineForm } from "@/server/actions/gateway-payments";
import { gateway } from "@/server/payments/gateway/registry";
import { quoteSubscription } from "@/server/payments/gateway/service";
import { formatIQD } from "@/lib/money";
import { currentLocale } from "@/server/locale";
import { PLANS, usd, normalizePlan, isPaidPlan } from "@/lib/plans";
import { PendingButton } from "@/components/ui/PendingButton";

export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ plan?: string; pay?: string }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("upgrade");
  const sp = await searchParams;
  const want = sp.plan && isPaidPlan(sp.plan) ? sp.plan : "pro";
  // The online gateway (src/server/payments/**, owned separately) only quotes Pro and Business; Max is paid manually for now.
  const wantOnline = want === "max" ? "business" : want;
  const pending = await pendingRequestFor(db(), store.id);
  const current = normalizePlan(store.plan);
  // Online checkout (Rasedi) only when PAYMENTS_PROVIDER is on; otherwise this page is exactly the manual flow.
  const online = gateway() !== null;
  const tg = await getTranslations("gatewayPay");
  const locale = await currentLocale();
  const quote = online ? await quoteSubscription(db(), store.id, wantOnline, 1) : null;
  const iqd = online
    ? Object.fromEntries(
        await Promise.all(
          (["pro", "business"] as const).map(async (p) => [p, [(await quoteSubscription(db(), store.id, p, 1)).iqd, (await quoteSubscription(db(), store.id, p, 12)).iqd]] as const),
        ),
      )
    : null;
  const opt = "flex min-h-11 cursor-pointer items-center gap-3 border-b border-line py-3 has-[:checked]:font-medium";
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="t-headline">{t("title")}</h1>
      <p className="text-ink-70">{t("lead")}</p>
      {pending && (
        <p className="border-y border-line py-4" role="status">
          {t("pending", { plan: pending.plan, method: t(`method.${pending.method}`) })}
        </p>
      )}
      <form action={submitUpgradeForm} className="grid gap-6">
        <fieldset>
          <legend className="mb-1 text-sm text-ink-70">{t("plan")}</legend>
          {PLANS.filter((p) => p.id !== "free").map((p) => (
            <label key={p.id} className={opt}>
              <input type="radio" name="plan" value={p.id} defaultChecked={p.id === want} />
              <span className="flex-1">{t(`name.${p.id}`)}</span>
              <span dir="ltr" className="text-end">
                {usd(p.monthly)}/mo · {usd(p.yearly)}/yr
                {iqd && p.id !== "max" && iqd[p.id] && <span className="block text-xs text-ink-70">{formatIQD(iqd[p.id]![0], locale)} · {formatIQD(iqd[p.id]![1], locale)}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm text-ink-70">{t("period")}</legend>
          <label className={opt}><input type="radio" name="months" value="1" defaultChecked /> {t("monthly")}</label>
          <label className={opt}><input type="radio" name="months" value="12" /> {t("yearly")}</label>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm text-ink-70">{t("methodLabel")}</legend>
          {(["fib", "zaincash", "cash"] as const).map((m, i) => (
            <label key={m} className={opt}><input type="radio" name="method" value={m} defaultChecked={i === 0} /> {t(`method.${m}`)}</label>
          ))}
        </fieldset>
        {online && quote && (
          <div className="grid gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-5" data-testid="pay-online">
            <p className="text-sm">
              {quote.promo && <span className="me-2 rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-white">{tg("promo")}</span>}
              {tg("payOnlineLead", { amount: formatIQD(quote.iqd, locale) })}
            </p>
            {sp.pay === "error" && <p className="text-sm text-danger" role="alert">{tg("error")}</p>}
            <PendingButton formAction={payOnlineForm} className="min-h-12 rounded-full bg-gold px-6 font-medium text-white">{tg("payOnline")}</PendingButton>
            <p className="text-xs text-ink-70">{tg("orManual")}</p>
          </div>
        )}
        <PendingButton className={online ? "min-h-12 rounded-full border border-ink px-6" : "min-h-12 rounded-full bg-ink px-6 text-white"}>{t("submit")}</PendingButton>
      </form>
      <p className="text-sm text-ink-70">{t("steps")}</p>
      <p className="text-sm text-ink-70">{t("current", { plan: t(`name.${current}`) })}</p>
    </div>
  );
}
