import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireStore } from "@/server/auth/session";
import { db } from "@/server/db";
import { getProductUsage } from "@/server/services/catalog";
import { ProductImport } from "@/components/dashboard/ProductImport";
import { PlanLock } from "@/components/dashboard/PlanLock";
import { FEATURE_MIN_PLAN, hasFeature, normalizePlan } from "@/lib/plans";

export default async function ImportProductsPage() {
  const { store } = await requireStore();
  const t = await getTranslations("products");
  if (!hasFeature(normalizePlan(store.plan), "bulkCsv")) {
    const tg = await getTranslations("planGate");
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-headline me-auto">{t("importTitle")}</h1>
          <Link href="/dashboard/products" className="btn-ghost btn-sm">{t("title")}</Link>
        </div>
        <PlanLock min={FEATURE_MIN_PLAN.bulkCsv} title={tg("csvTitle")} body={tg("csvBody")} />
      </div>
    );
  }
  const usage = await getProductUsage(db(), store.id);
  const room = Math.max(0, usage.cap - usage.used);
  const fatal = Object.fromEntries(["empty", "too_big", "no_name_column", "no_price_column", "too_many_rows"].map((k) => [k, t(`importFatal.${k}`)]));
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline me-auto">{t("importTitle")}</h1>
        <Link href="/dashboard/products" className="btn-ghost btn-sm">{t("title")}</Link>
      </div>
      <p className="max-w-2xl text-ink-70">{t("importHelp")}</p>
      <ProductImport
        room={room}
        labels={{
          pick: t("importPick"), paste: t("importPaste"), preview: t("importPreview"), ready: t("importReady", { n: "{n}" }),
          skipped: t("importSkipped", { n: "{n}" }), room: t("importRoom", { n: "{n}" }), start: t("importStart", { n: "{n}" }),
          working: t("importWorking"), done: t("importDone", { n: "{n}" }), template: t("importTemplate"),
          viewProducts: t("importView"), rowError: t("importRowError", { line: "{line}", why: "{why}" }),
          limit: t("importLimit"), failed: t("importFailed"), empty: t("importFatal.empty"), fatal,
        }}
      />
    </div>
  );
}
