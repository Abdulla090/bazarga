import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { pendingRequestFor } from "@/server/services/upgrades";
import { submitUpgradeForm } from "@/server/actions/upgrade";
import { PLANS, usd, normalizePlan } from "@/lib/plans";

export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { store } = await requireStore();
  const t = await getTranslations("upgrade");
  const sp = await searchParams;
  const want = sp.plan === "business" ? "business" : "pro";
  const pending = await pendingRequestFor(db(), store.id);
  const current = normalizePlan(store.plan);
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
              <span dir="ltr">{usd(p.monthly)}/mo · {usd(p.yearly)}/yr</span>
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
        <button className="min-h-12 rounded-full bg-ink px-6 text-white">{t("submit")}</button>
      </form>
      <p className="text-sm text-ink-70">{t("steps")}</p>
      <p className="text-sm text-ink-70">{t("current", { plan: t(`name.${current}`) })}</p>
    </div>
  );
}
