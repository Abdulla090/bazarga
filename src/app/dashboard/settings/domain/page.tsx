import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/server/auth/session";
import { env } from "@/server/env";
import { vercelApiOn } from "@/server/services/custom-domain";
import { DomainForm } from "@/components/dashboard/DomainForm";
import { PlanLock } from "@/components/dashboard/PlanLock";
import { dnsInstructions, domainTargets } from "@/lib/custom-domain";
import { FEATURE_MIN_PLAN, hasFeature, normalizePlan } from "@/lib/plans";

/** SF7: the seller's own domain (Business+). DNS record to add, a server-side Verify, and the live status. */
export default async function DomainSettingsPage() {
  const { store } = await requireOwnerPage();
  const t = await getTranslations("domain");
  const ts = await getTranslations("settings");
  const allowed = hasFeature(normalizePlan(store.plan), "domain");
  const e = env();
  const host = store.customDomain ?? "";
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline me-auto">{t("title")}</h1>
        <Link href="/dashboard/settings" className="btn-ghost btn-sm">{ts("title")}</Link>
      </div>
      {allowed ? (
        <DomainForm
          host={host}
          verified={!!(host && store.customDomainVerifiedAt)}
          record={host ? dnsInstructions(host, domainTargets(e)) : null}
          auto={vercelApiOn({ token: e.VERCEL_TOKEN, projectId: e.VERCEL_PROJECT_ID })}
        />
      ) : (
        <PlanLock min={FEATURE_MIN_PLAN.domain} title={t("lockTitle")} body={t("lockBody")} />
      )}
    </div>
  );
}
