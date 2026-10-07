/**
 * Variant selection rules shared by the product page picker and tests (no React, no server code).
 * A variant is the combination of one option value per option (`optionValueIds`); `stock` null = not tracked.
 */
export type VariantLike = { id: string; optionValueIds: string[]; price: number; stock: number | null };
export type Selection = Record<string, string | undefined>; // optionId → valueId

export const inStock = (v: Pick<VariantLike, "stock">) => v.stock === null || v.stock > 0;

/** Variants compatible with every value picked so far (ignoring `skipOption`). */
function compatible<V extends VariantLike>(variants: V[], selection: Selection, skipOption?: string): V[] {
  const picked = Object.entries(selection)
    .filter(([opt, val]) => opt !== skipOption && !!val)
    .map(([, val]) => val!);
  return variants.filter((v) => picked.every((id) => v.optionValueIds.includes(id)));
}

/** The variant matching a complete selection, or null while an option is still unpicked. */
export function matchVariant<V extends VariantLike>(optionIds: string[], variants: V[], selection: Selection): V | null {
  if (!optionIds.every((o) => selection[o])) return null;
  return compatible(variants, selection)[0] ?? null;
}

/**
 * Can this value still be bought given the other options already picked? Values with no in-stock combination
 * are shown disabled (struck through), never hidden, so shoppers see the size exists but is sold out.
 */
export function isValueAvailable(variants: VariantLike[], selection: Selection, optionId: string, valueId: string): boolean {
  return compatible(variants, selection, optionId).some((v) => v.optionValueIds.includes(valueId) && inStock(v));
}

/** Price span across purchasable variants (all variants when every one is sold out). */
export function priceRange(variants: VariantLike[], fallback: number): { min: number; max: number } {
  const pool = variants.filter(inStock);
  const prices = (pool.length ? pool : variants).map((v) => v.price);
  if (!prices.length) return { min: fallback, max: fallback };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Pre-select options that have a single value (nothing to choose). */
export function initialSelection(options: { id: string; values: { id: string }[] }[]): Selection {
  return Object.fromEntries(options.filter((o) => o.values.length === 1).map((o) => [o.id, o.values[0]!.id]));
}
