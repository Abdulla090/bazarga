import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { env } from "@/server/env";
import { StoreSeoForm } from "@/components/dashboard/SeoForms";
import { PlanLock } from "@/components/dashboard/PlanLock";
import { FEATURE_MIN_PLAN, hasFeature, normalizePlan } from "@/lib/plans";

export default async function SeoSettingsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("seo");
  const ts = await getTranslations("settings");
  const allowed = hasFeature(normalizePlan(store.plan), "seoAdvanced");
  const base = env().APP_URL.replace(/\/$/, "");
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline me-auto">{t("title")}</h1>
        <Link href="/dashboard/settings" className="btn-ghost btn-sm">{ts("title")}</Link>
      </div>
      {allowed ? (
        <>
          <StoreSeoForm
            placeholderTitle={store.name}
            initial={{ title: store.seo?.title ?? "", description: store.seo?.description ?? "", ogImageUrl: store.seo?.ogImageUrl ?? "", whiteLabel: store.whiteLabel }}
          />
          <section className="card grid gap-2" data-testid="seo-extras">
            <h2 className="text-lg font-bold">{t("extrasTitle")}</h2>
            <p className="hint">{t("extrasHint")}</p>
            <a href={`${base}/s/${store.slug}/sitemap.xml`} target="_blank" rel="noopener" className="num inline-flex min-h-11 items-center break-all text-[#2563EB] underline" dir="ltr" data-testid="store-sitemap-link">
              {`${base}/s/${store.slug}/sitemap.xml`}
            </a>
          </section>
        </>
      ) : (
        <PlanLock min={FEATURE_MIN_PLAN.seoAdvanced} title={t("lockTitle")} body={t("lockBody")} />
      )}
    </div>
  );
}
