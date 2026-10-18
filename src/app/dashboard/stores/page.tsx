import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { currentLocale } from "@/server/locale";
import { listAccessibleStores, ownedStoreUsage } from "@/server/services/store-access";
import { createAnotherStoreAction, switchStoreAction } from "@/server/actions/stores";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { PlanLock } from "@/components/dashboard/PlanLock";
import { IRAQI_CITIES } from "@/lib/cities";
import { pickText } from "@/lib/i18n";
import { STORE_LIMIT } from "@/lib/plans";

export default async function StoresPage() {
  const { user, store } = await requireStore();
  const t = await getTranslations("stores");
  const tu = await getTranslations("upgrade");
  const locale = await currentLocale();
  const [all, usage] = await Promise.all([listAccessibleStores(db(), user.id), ownedStoreUsage(db(), user.id)]);
  const canAdd = usage.used < usage.limit;
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-1">
        <h1 className="t-headline">{t("title")}</h1>
        <p className="num text-ink-70" data-testid="stores-usage">{t("usage", { used: usage.used, limit: usage.limit, plan: tu(`name.${usage.plan}`) })}</p>
      </div>
      <ul className="grid gap-2" data-testid="stores-list">
        {all.map(({ store: s, role }) => (
          <li key={s.id} className="card flex flex-wrap items-center gap-3">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-bold">{s.name}</span>
              <span className="num truncate text-sm text-ink-70" dir="ltr">/s/{s.slug}</span>
            </span>
            <span className="rounded-full border border-line px-3 py-1 text-[13px] text-ink/70">{role === "owner" ? t("owner") : t("staff")} · {tu(`name.${s.plan === "pro" || s.plan === "business" || s.plan === "max" ? s.plan : "free"}`)}</span>
            {s.id === store.id ? (
              <span className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#2563EB]">{t("current")}</span>
            ) : (
              <form action={switchStoreAction}>
                <input type="hidden" name="storeId" value={s.id} />
                <button className="btn-ghost btn-sm min-h-11" data-testid="stores-open">{t("open")}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {canAdd ? (
        <details className="card" open={false} data-testid="new-store">
          <summary className="min-h-11 cursor-pointer content-center font-bold">+ {t("add")}</summary>
          <p className="hint mt-2">{t("addHint")}</p>
          <div className="mt-3">
            <StoreForm
              action={createAnotherStoreAction}
              mode="create"
              rootDomain={new URL(env().APP_URL).host}
              cities={IRAQI_CITIES.map((c) => ({ key: c.key, name: pickText(c.name, locale) }))}
              initial={{ name: "", slug: "", defaultLocale: store.defaultLocale, phone: store.phone ? `+${store.phone}` : null, whatsapp: store.whatsapp ? `+${store.whatsapp}` : null, instagram: null, city: store.city }}
            />
          </div>
        </details>
      ) : usage.limit < STORE_LIMIT.max ? (
        <PlanLock min={usage.limit < STORE_LIMIT.business ? "business" : "max"} title={t("lockTitle")} body={t("lockBody", { business: STORE_LIMIT.business, max: STORE_LIMIT.max })} />
      ) : (
        <p className="hint" data-testid="stores-max">{t("atMax", { n: usage.limit })}</p>
      )}
    </div>
  );
}
