import { productSchema, type ProductInput } from "@/lib/validation";

/**
 * Seller product import: pure CSV parsing + per-row zod validation (shared by the client preview and the server action).
 * Reads our own export (round trip) and plain spreadsheets: name_ku/name_kmr/name_ar/name_en, price, compare_at_price,
 * stock, sku, status, badge, description_*. Unknown columns are ignored. Images and variants are added in the editor.
 */
export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_BYTES = 400_000;

export type ImportRow = { line: number; input?: ProductInput; error?: string };
export type ImportParse = { rows: ImportRow[]; fatal?: "empty" | "too_big" | "no_name_column" | "no_price_column" | "too_many_rows" };

/** RFC 4180 reader: quoted cells, doubled quotes, CRLF/LF, embedded newlines; strips a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) out.push(row);
  return out;
}

/** Our export prefixes cells starting with = + - @ with an apostrophe (formula safety): undo it on the way back in. */
const unquote = (s: string) => s.replace(/^'(?=[=+\-@\t\r])/, "").trim();
const NUM = /[\s,٬،]/g;
/** Accepts "25000", "25,000", "25 000" and Arabic-Indic digits; returns the raw string for zod to coerce. */
function normNumber(s: string): string {
  const latin = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  return latin.replace(NUM, "").replace(/(iqd|د\.ع)$/i, "");
}

export function parseProductsCsv(text: string): ImportParse {
  if (!text.trim()) return { rows: [], fatal: "empty" };
  if (text.length > IMPORT_MAX_BYTES) return { rows: [], fatal: "too_big" };
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], fatal: "empty" };
  const head = table[0]!.map((h) => unquote(h).toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (name: string) => head.indexOf(name);
  const nameCols = (["ku", "kmr", "ar", "en"] as const).map((l) => [l, col(`name_${l}`)] as const).filter(([, i]) => i >= 0);
  const plainName = col("name");
  if (!nameCols.length && plainName < 0) return { rows: [], fatal: "no_name_column" };
  if (col("price") < 0) return { rows: [], fatal: "no_price_column" };
  if (table.length - 1 > IMPORT_MAX_ROWS) return { rows: [], fatal: "too_many_rows" };
  const get = (r: string[], name: string) => unquote(r[col(name)] ?? "");
  const rows: ImportRow[] = table.slice(1).map((r, idx) => {
    const line = idx + 2;
    const name: Record<string, string> = {};
    for (const [l, i] of nameCols) { const v = unquote(r[i] ?? ""); if (v) name[l] = v; }
    if (!Object.keys(name).length && plainName >= 0) { const v = unquote(r[plainName] ?? ""); if (v) name.en = v; }
    const description: Record<string, string> = {};
    for (const l of ["ku", "kmr", "ar", "en"]) { const v = get(r, `description_${l}`); if (v) description[l] = v; }
    const status = get(r, "status").toLowerCase();
    const stock = normNumber(get(r, "stock"));
    const compare = normNumber(get(r, "compare_at_price"));
    const candidate = {
      name,
      description,
      price: normNumber(get(r, "price")),
      compareAtPrice: compare === "" ? null : compare,
      stock: stock === "" ? null : stock,
      sku: get(r, "sku"),
      badge: get(r, "badge").toLowerCase(),
      isActive: !["hidden", "inactive", "draft", "no", "false", "0"].includes(status),
      imageUrls: [],
    };
    const parsed = productSchema.safeParse(candidate);
    if (parsed.success) return { line, input: parsed.data as ProductInput };
    const issue = parsed.error.issues[0]!;
    return { line, error: `${issue.path.join(".") || "row"}:${issue.message}` };
  });
  return { rows };
}

/** A header-only starter file (with one example row) the seller can fill in Excel/Sheets. */
export function importTemplateCsv(): string {
  const cols = ["name_ku", "name_en", "price", "compare_at_price", "stock", "sku", "status"];
  return "\uFEFF" + cols.join(",") + "\r\n" + ["کراسی نموونە", "Sample product", "25000", "30000", "10", "SKU-1", "active"].join(",") + "\r\n";
}
