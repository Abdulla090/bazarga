"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toCsv } from "@/lib/admin";
import { Btn, Empty, FilterBar, Pager } from "./kit";

type Col = { name: string; type: string; nullable: boolean; secret: boolean };
export type DbTableData = { table: string; columns: Col[]; rows: (string | null)[][]; total: number; page: number; size: number; sort: string | null; dir: "asc" | "desc" };

/** Read-only rows of one table. Sorting and search run on the server (URL); CSV exports exactly the rows on screen. */
export function DbTableView({ data, q }: { data: DbTableData; q: string }) {
  const t = useTranslations("admin");
  const href = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | number | undefined> = { q: q || undefined, sort: data.sort ?? undefined, dir: data.dir, page: data.page, ...over };
    for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") p.set(k, String(v));
    return `?${p}`;
  };
  const exportCsv = () => {
    const csv = toCsv(data.columns.map((c) => c.name), data.rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${data.table}-p${data.page}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div>
      <FilterBar q={q} placeholder={t("db.searchRows")}>
        {data.sort && <input type="hidden" name="sort" value={data.sort} />}
        {data.sort && <input type="hidden" name="dir" value={data.dir} />}
        <Btn onClick={exportCsv} disabled={!data.rows.length} data-testid="db-export">{t("db.exportVisible")}</Btn>
      </FilterBar>
      {data.rows.length === 0 ? (
        <Empty testId="db-empty">{q ? t("db.noMatch") : t("db.emptyTable")}</Empty>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-white" data-testid="db-scroll">
          <table className="min-w-full text-start text-[13px]" data-testid="db-rows">
            <thead className="sticky top-0 z-10 bg-[#F9FAFB] text-xs text-ink-50 shadow-[inset_0_-1px_0_var(--color-line,#E4E7EC)]">
              <tr>
                {data.columns.map((c) => {
                  const on = data.sort === c.name;
                  const next = on && data.dir === "asc" ? "desc" : "asc";
                  return (
                    <th key={c.name} scope="col" className="whitespace-nowrap px-3 py-0 text-start font-medium" aria-sort={on ? (data.dir === "asc" ? "ascending" : "descending") : undefined}>
                      <Link href={href({ sort: c.name, dir: next, page: 1 })} className={`inline-flex min-h-11 items-center gap-1 font-mono ${on ? "text-ink" : "hover:text-ink"}`} dir="ltr" title={`${c.type}${c.nullable ? " · null" : ""}`}>
                        {c.name}
                        {c.secret && <span className="rounded bg-[#F2F4F7] px-1 font-sans text-[10px] text-ink-50">{t("db.masked")}</span>}
                        {on && <span aria-hidden>{data.dir === "asc" ? "↑" : "↓"}</span>}
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((r, i) => (
                <tr key={i} className="hover:bg-[#F9FAFB]" data-testid="db-row">
                  {r.map((v, j) => (
                    <td key={j} className={`max-w-[22rem] truncate whitespace-nowrap px-3 py-2 align-top font-mono ${v === null ? "text-ink-50/70" : data.columns[j]?.secret ? "text-ink-50" : "text-ink"}`} dir="ltr" title={v ?? "null"}>
                      {v ?? "null"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={data.page} total={data.total} size={data.size} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
