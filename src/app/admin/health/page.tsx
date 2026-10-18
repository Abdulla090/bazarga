import { getTranslations } from "next-intl/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { buildInfo } from "@/server/build-info";
import { integrationStatus } from "@/server/integrations";
import { SETTING_KEYS, getFlags, getMaintenance, getSetting } from "@/server/services/platform-settings";
import { Card, PageHeader } from "@/components/admin/kit";
import { FEATURE_FLAGS } from "@/lib/admin";

export const metadata = { title: "Admin · Health", robots: { index: false } };

async function dbPing(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    await db().execute(sql`select 1`);
    return { ok: true, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

const pill = (on: boolean) => `rounded-full px-2.5 py-1 ${on ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#F2F4F7] text-ink-50"}`;

export default async function AdminHealth() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const [ping, flags, maint, cron] = await Promise.all([dbPing(), getFlags(db()), getMaintenance(db()), getSetting(db(), SETTING_KEYS.cronDaily)]);
  const build = buildInfo();
  let integ: ReturnType<typeof integrationStatus> | null = null;
  try { integ = integrationStatus(env(), { serverless: !!process.env.VERCEL }); } catch { integ = null; }
  const cronRun = cron as { at?: string; ok?: boolean } | null;
  return (
    <div className="space-y-3" data-testid="admin-health">
      <PageHeader title={t("nav.health")} sub={t("h.sub")} />
      <Card title={t("h.runtime")}>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-ink-50">{t("ov.db")}</dt><dd className={`mt-0.5 font-medium ${ping.ok ? "text-[#067647]" : "text-[#B42318]"}`} dir="ltr" data-testid="health-db">{ping.ok ? `ok · ${ping.ms} ms` : "error"}</dd></div>
          <div><dt className="text-ink-50">{t("ov.build")}</dt><dd className="mt-0.5 font-mono text-xs" dir="ltr">{build.shortSha ?? "dev"} · {build.env}</dd></div>
          <div><dt className="text-ink-50">{t("ov.cron")}</dt><dd className="mt-0.5" dir="ltr">{cronRun?.at ? `${cronRun.at.slice(0, 16).replace("T", " ")} UTC · ${cronRun.ok ? "ok" : "failed"}` : t("c.never")}</dd></div>
          <div><dt className="text-ink-50">{t("h.maintenance")}</dt><dd className={`mt-0.5 ${maint.on ? "font-medium text-[#B54708]" : ""}`}>{maint.on ? t("c.on") : t("c.off")}</dd></div>
        </dl>
        <a className="mt-4 inline-flex min-h-11 items-center text-sm text-[#2563EB] underline-offset-2 hover:underline" href="/api/health" target="_blank" rel="noreferrer">/api/health JSON ↗</a>
      </Card>
      {integ && (
        <Card title={t("ov.integrations")}>
          <ul className="flex flex-wrap gap-2 text-xs" dir="ltr">
            <li className="rounded-full bg-[#F2F4F7] px-2.5 py-1">storage: {integ.storage.driver}</li>
            <li className="rounded-full bg-[#F2F4F7] px-2.5 py-1">email: {integ.email.driver}</li>
            {(["cron", "subdomains", "push", "ai"] as const).map((x) => <li key={x} className={pill(!!integ[x])}>{x}: {integ[x] ? "on" : "off"}</li>)}
            <li className="rounded-full bg-[#F2F4F7] px-2.5 py-1">aiText: {integ.aiText}</li>
          </ul>
        </Card>
      )}
      <Card title={t("ov.flags")}>
        <ul className="flex flex-wrap gap-2 text-xs">
          {FEATURE_FLAGS.map((f) => (
            <li key={f} data-testid={`flag-${f}`} className={`rounded-full px-2.5 py-1 ${flags[f] ? "bg-[#EFF4FF] text-[#1D4ED8]" : "bg-[#FEF3F2] text-[#B42318]"}`}>{t(`site.flag.${f}`)}: {flags[f] ? t("c.on") : t("c.off")}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
