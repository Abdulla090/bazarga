/**
 * Pure helpers for the seller's product-variant editor (no React, no server code): option groups (Size, Colour…),
 * the auto-generated combinations and the rows that carry each combination's price/stock/SKU.
 * The form posts the whole editor as one JSON hidden input (`variants`), parsed by `productVariantsInputSchema`.
 */
import type { Locale } from "./i18n";

export type LText = Partial<Record<Locale, string>>;

export type EditorValue = { key: string; id?: string; label: LText; swatch?: string | null };
export type EditorOption = { key: string; id?: string; name: LText; swatches?: boolean; values: EditorValue[] };
/** `price`/`stock` null = use the product price / don't track stock. */
export type EditorRow = {
  id?: string;
  keys: string[];
  price: number | null;
  compareAtPrice?: number | null;
  stock: number | null;
  sku: string | null;
  isActive: boolean;
};
export type EditorState = { options: EditorOption[]; variants: EditorRow[] };

export const MAX_OPTIONS = 3;
export const MAX_VALUES = 20;
export const MAX_VARIANTS = 100;

/** Built-in groups so a seller gets "Size" / "Colour" named in every language with one tap. */
export const OPTION_PRESETS: Record<"size" | "colour", { name: Required<LText>; swatches: boolean }> = {
  size: { name: { ku: "قەبارە", ar: "المقاس", en: "Size", kmr: "Mezinahî" }, swatches: false },
  colour: { name: { ku: "ڕەنگ", ar: "اللون", en: "Colour", kmr: "Reng" }, swatches: true },
};

/** Key that identifies a combination regardless of option order. */
export const comboKey = (keys: string[]) => [...keys].sort().join("|");

/** Cartesian product of the option values (options with no values are skipped until they get one). */
export function combinations(options: EditorOption[]): string[][] {
  const axes = options.filter((o) => o.values.length > 0).map((o) => o.values.map((v) => v.key));
  if (!axes.length) return [];
  return axes.reduce<string[][]>((acc, axis) => acc.flatMap((combo) => axis.map((k) => [...combo, k])), [[]]);
}

/**
 * Rows for every current combination, in option order. A combination that existed before keeps its row (id, price,
 * stock, SKU); when a value is added to a new option, the old row carries over to the first combination that
 * contains it, so adding "Colour" to a sized product doesn't wipe the stock the seller typed for each size.
 */
export function syncRows(options: EditorOption[], prev: EditorRow[]): EditorRow[] {
  const combos = combinations(options);
  const byKey = new Map(prev.map((r) => [comboKey(r.keys), r]));
  const used = new Set<EditorRow>();
  return combos.map((keys) => {
    const exact = byKey.get(comboKey(keys));
    if (exact && !used.has(exact)) {
      used.add(exact);
      return { ...exact, keys };
    }
    // A previous row whose values are all still in this combination (an option was added) → inherit it once.
    const parent = prev.find((r) => !used.has(r) && r.keys.length > 0 && r.keys.length < keys.length && r.keys.every((k) => keys.includes(k)));
    if (parent) {
      used.add(parent);
      return { ...parent, keys };
    }
    // Inherit price/stock defaults (not id/SKU, which must stay unique) from a sibling sharing a value.
    const sib = prev.find((r) => r.keys.some((k) => keys.includes(k)));
    return { keys, price: sib?.price ?? null, compareAtPrice: null, stock: sib ? sib.stock : null, sku: null, isActive: true };
  });
}

/** "M / Red" in the given language (falls back like the storefront does). */
export function rowTitle(options: EditorOption[], keys: string[], pick: (t: LText) => string): string {
  return keys
    .map((k) => {
      for (const o of options) {
        const v = o.values.find((x) => x.key === k);
        if (v) return pick(v.label) || "?";
      }
      return "?";
    })
    .join(" / ");
}

/** Split what the seller typed/pasted into value labels: "S, M, L" or one per line; trims and drops duplicates. */
export function splitValues(raw: string, existing: string[]): string[] {
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  const out: string[] = [];
  for (const part of raw.split(/[,،\n]/)) {
    const s = part.trim().slice(0, 60);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

let seq = 0;
/** Client-only key for a new option/value (existing rows use their DB id). */
export const newKey = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Editor state from the rows stored in the DB (keys = ids). */
export function editorFromDb(
  options: { id: string; name: LText }[],
  values: { id: string; optionId: string; label: LText; swatch: string | null }[],
  variants: { id: string; optionValueIds: string[]; price: number | null; compareAtPrice: number | null; stock: number | null; sku: string | null; isActive: boolean }[],
): EditorState {
  const opts: EditorOption[] = options.map((o) => {
    const vals = values.filter((v) => v.optionId === o.id).map((v) => ({ key: v.id, id: v.id, label: v.label, swatch: v.swatch }));
    return { key: o.id, id: o.id, name: o.name, swatches: vals.some((v) => !!v.swatch), values: vals };
  });
  const rows: EditorRow[] = variants.map((v) => ({
    id: v.id,
    keys: v.optionValueIds,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    stock: v.stock,
    sku: v.sku,
    isActive: v.isActive,
  }));
  return { options: opts, variants: syncRows(opts, rows) };
}
