import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { DB_BROWSER_PAGE_SIZE, browserCell, isSecretColumn } from "@/lib/admin";

/**
 * Read-only database browser for the owner (docs/ADMIN.md, "Database"). Only SELECTs; table and column names come from
 * information_schema and are matched exactly before they reach a query (as quoted identifiers), so nothing typed by
 * the admin is ever SQL. Secret columns are masked here on the server, before rows leave it.
 */
type Rows<T> = { rows: T[] };
const rowsOf = <T>(r: unknown) => ((r as Rows<T>).rows ?? []) as T[];

export type DbTable = { name: string; rows: number; columns: number };
export type DbColumn = { name: string; type: string; nullable: boolean; secret: boolean };

async function tableNames(database: Db): Promise<string[]> {
  const r = await database.execute(sql`
    select table_name as name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`);
  return rowsOf<{ name: string }>(r).map((x) => x.name);
}

/** Every app table with its exact row count (one round trip). */
export async function listDbTables(database: Db): Promise<DbTable[]> {
  const names = await tableNames(database);
  if (!names.length) return [];
  const counts = sql.join(
    names.map((n) => sql`select ${n}::text as name, count(*)::bigint as n from ${sql.identifier(n)}`),
    sql` union all `,
  );
  const [c, cols] = await Promise.all([
    database.execute(counts),
    database.execute(sql`select table_name as name, count(*)::int as n from information_schema.columns where table_schema = 'public' group by table_name`),
  ]);
  const byName = new Map(rowsOf<{ name: string; n: string | number }>(c).map((r) => [r.name, Number(r.n)]));
  const colN = new Map(rowsOf<{ name: string; n: string | number }>(cols).map((r) => [r.name, Number(r.n)]));
  return names.map((name) => ({ name, rows: byName.get(name) ?? 0, columns: colN.get(name) ?? 0 }));
}

export async function dbColumns(database: Db, table: string): Promise<DbColumn[]> {
  const r = await database.execute(sql`
    select column_name as name, data_type as type, is_nullable as nullable from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position`);
  return rowsOf<{ name: string; type: string; nullable: string }>(r).map((c) => ({ name: c.name, type: c.type, nullable: c.nullable === "YES", secret: isSecretColumn(table, c.name) }));
}

export type BrowseQuery = { table: string; q?: string; sort?: string; dir?: "asc" | "desc"; page?: number };
export type BrowseResult = {
  table: string;
  columns: DbColumn[];
  rows: (string | null)[][];
  total: number;
  page: number;
  size: number;
  sort: string | null;
  dir: "asc" | "desc";
};

/** One page of a table. Returns null when the table is not an app table (the page answers 404). */
export async function browseTable(database: Db, query: BrowseQuery): Promise<BrowseResult | null> {
  const names = await tableNames(database);
  if (!names.includes(query.table)) return null;
  const table = query.table;
  const columns = await dbColumns(database, table);
  const names2 = columns.map((c) => c.name);
  const fallbackSort = names2.includes("created_at") ? "created_at" : names2[0] ?? null;
  const sort = query.sort && names2.includes(query.sort) ? query.sort : fallbackSort;
  const dir = query.dir === "asc" ? "asc" : query.sort && names2.includes(query.sort) ? (query.dir ?? "asc") : "desc";
  const page = Math.max(1, Math.min(Number.isFinite(query.page) ? Number(query.page) : 1, 100_000));
  const size = DB_BROWSER_PAGE_SIZE;
  const term = (query.q ?? "").trim().replace(/[%_\\]/g, "").slice(0, 80);
  // Search only what the admin can see: secret columns are never matched, so a search can't probe a hash.
  const visible = columns.filter((c) => !c.secret);
  let where: SQL = sql``;
  if (term && visible.length) {
    const hay = sql.join(visible.map((c) => sql`coalesce(${sql.identifier(c.name)}::text, '')`), sql`, `);
    where = sql` where concat_ws(' ', ${hay}) ilike ${`%${term}%`}`;
  }
  const order = sort ? sql` order by ${sql.identifier(sort)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last` : sql``;
  const t = sql.identifier(table);
  const [rowsRes, countRes] = await Promise.all([
    database.execute(sql`select * from ${t}${where}${order} limit ${size} offset ${(page - 1) * size}`),
    database.execute(sql`select count(*)::bigint as n from ${t}${where}`),
  ]);
  const raw = rowsOf<Record<string, unknown>>(rowsRes);
  const total = Number(rowsOf<{ n: string | number }>(countRes)[0]?.n ?? 0);
  return {
    table,
    columns,
    rows: raw.map((r) => columns.map((c) => browserCell(table, c.name, r[c.name]))),
    total,
    page,
    size,
    sort,
    dir,
  };
}
