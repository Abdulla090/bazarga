import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { db } from "@/server/db";
import { buildInfo } from "@/server/build-info";

export async function generateMetadata() {
  const t = await getTranslations("status");
  return { title: t("title") };
}

async function probe(): Promise<{ ok: boolean; ms: number }> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db().execute(sql`select 1`),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error("timeout")), 3000);
      }),
    ]);
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default async function StatusPage() {
  await connection();
  const t = await getTranslations("status");
  const { ok, ms } = await probe();
  const build = buildInfo();
  const rows = [
    { label: t("app"), good: true },
    { label: t("db"), good: ok },
  ];
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page max-w-2xl py-12 md:py-20">
        <h1 className="text-4xl font-light tracking-tight">{t("title")}</h1>
        <div
          role="status"
          className={`mt-8 rounded-2xl border p-6 ${ok ? "border-[#2563EB]/30 bg-[#2563EB]/5" : "border-ink bg-ink text-paper"}`}
        >
          <p className="text-xl font-semibold">{ok ? t("ok") : t("degraded")}</p>
          <p className="mt-1 text-ink-70">{ok ? t("okLead") : t("degLead")}</p>
        </div>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.label} className="flex min-h-12 items-center justify-between py-3">
              <span>{r.label}</span>
              <span className={`font-semibold ${r.good ? "text-[#2563EB]" : "text-ink"}`}>{r.good ? t("up") : t("down")}</span>
            </li>
          ))}
          <li className="flex min-h-12 items-center justify-between py-3">
            <span>{t("latency")}</span>
            <span dir="ltr" className="tabular-nums">{ms} ms</span>
          </li>
          <li className="flex min-h-12 items-center justify-between py-3">
            <span>{t("build")}</span>
            <span dir="ltr" className="tabular-nums">{build.shortSha}</span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-70">{t("checked")}: <time dir="ltr" dateTime={new Date().toISOString()}>{new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</time></p>
      </main>
      <SiteFooter />
    </>
  );
}
