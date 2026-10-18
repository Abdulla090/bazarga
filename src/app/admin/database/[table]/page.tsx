import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { browseTable } from "@/server/admin/db-browser";
import { DbTableView } from "@/components/admin/DbTableView";
import { PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Database", robots: { index: false } };

export default async function AdminDbTable({ params, searchParams }: { params: Promise<{ table: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("team");
  const [{ table }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations("admin");
  const res = await browseTable(db(), { table: decodeURIComponent(table), q: sp.q, sort: sp.sort, dir: sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : undefined, page: Number(sp.page ?? 1) });
  if (!res) notFound();
  return (
    <div data-testid="admin-db-table">
      <Link href="/admin/database" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-ink-70 hover:text-ink">
        <span aria-hidden className="rtl:rotate-180">←</span> {t("nav.database")}
      </Link>
      <PageHeader title={res.table} count={res.total} sub={t("db.readOnly")} />
      <DbTableView data={res} q={sp.q ?? ""} />
    </div>
  );
}
