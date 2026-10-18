import { csvCell } from "@/lib/orders-csv";
import type { LocalizedText } from "@/lib/i18n";

/** Seller product export: pure CSV building (Excel-safe, formula-injection safe). Reuses the orders CSV cell rules. */
export type ExportProduct = {
  name: LocalizedText;
  description: LocalizedText;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  /** null = stock not tracked. */
  stock: number | null;
  isActive: boolean;
  badge: string | null;
  categoryName: string | null;
  shortCode: string;
  imageCount: number;
  variantCount: number;
  createdAt: Date;
};

export const PRODUCT_CSV_HEADERS = [
  "name_ku", "name_kmr", "name_ar", "name_en", "sku", "price", "compare_at_price", "stock", "status", "badge",
  "category", "variants", "images", "description_ku", "description_kmr", "description_ar", "description_en", "link", "created",
] as const;

/** Line breaks inside descriptions would break spreadsheet rows for non-technical sellers: flatten them. */
function oneLine(s: string | undefined): string {
  return (s ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
}

/** UTF-8 BOM first so Excel reads Kurdish/Arabic text correctly. CRLF line ends. `base` is the public site origin. */
export function productsToCsv(rows: ExportProduct[], base: string): string {
  const lines = [PRODUCT_CSV_HEADERS.join(",")];
  for (const p of rows) {
    lines.push(
      [
        p.name.ku, p.name.kmr, p.name.ar, p.name.en, p.sku, p.price, p.compareAtPrice, p.stock === null ? "" : p.stock,
        p.isActive ? "active" : "hidden", p.badge, p.categoryName, p.variantCount, p.imageCount,
        oneLine(p.description.ku), oneLine(p.description.kmr), oneLine(p.description.ar), oneLine(p.description.en),
        `${base.replace(/\/+$/, "")}/p/${p.shortCode}`, p.createdAt.toISOString().slice(0, 10),
      ].map((c) => csvCell(typeof c === "string" ? c : (c as number | null | undefined))).join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
