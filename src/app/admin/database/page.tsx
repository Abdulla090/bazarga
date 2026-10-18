import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { listDbTables } from "@/server/admin/db-browser";
import { Empty, FilterBar, PageHeader } from "@/components/admin/kit";

export const metadata = { title: "Admin · Database", robots: { index: false } };

/** Read-only table browser, owner only (admins and everyone else get a 404). */
export default async function AdminDatabase({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("team");
  const sp = await searchParams;
  const t = await getTranslations("admin");
  const all = await listDbTables(db());
  const q = (sp.q ?? "").trim().toLowerCase();
  const tables = q ? all.filter((x) => x.name.includes(q)) : all;
  const rows = all.reduce((s, x) => s + x.rows, 0);
  return (
    <div data-testid="admin-database">
      <PageHeader title={t("nav.database")} count={all.length} sub={t("db.sub", { rows: rows.toLocaleString("en-US") })} />
      <FilterBar q={sp.q} placeholder={t("db.searchTables")} />
      {tables.length === 0 ? (
        <Empty>{t("c.none")}</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="db-tables">
          {tables.map((x) => (
            <li key={x.name}>
              <Link
                href={`/admin/database/${encodeURIComponent(x.name)}`}
                data-testid="db-table"
                data-table={x.name}
                data-rows={x.rows}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 transition-colors hover:border-[#2563EB]/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px] font-medium text-ink" dir="ltr">{x.name}</span>
                  <span className="block text-xs text-ink-50">{t("db.columnsN", { n: x.columns })}</span>
                </span>
                <span className={`tabular-nums text-sm font-semibold ${x.rows ? "text-ink" : "text-ink-50"}`} dir="ltr">{x.rows.toLocaleString("en-US")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
