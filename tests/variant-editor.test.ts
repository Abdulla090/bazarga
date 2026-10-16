import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { combinations, editorFromDb, rowTitle, splitValues, syncRows, type EditorOption } from "@/lib/variant-editor";
import { productVariantsInputSchema, variantsFromForm } from "@/lib/validation";
import type { Db } from "@/server/db";
import { createProduct, getProductVariants, updateProduct } from "@/server/services/catalog";
import { loadProductDetail } from "@/server/services/storefront";
import { quoteCart } from "@/server/services/orders";
import { seller, testDb } from "./support/db";

const opt = (key: string, labels: string[], swatches = false): EditorOption => ({
  key,
  name: { en: key },
  swatches,
  values: labels.map((l) => ({ key: `${key}-${l}`, label: { en: l } })),
});

describe("variant editor helpers", () => {
  it("builds every combination in option order, skipping empty options", () => {
    expect(combinations([])).toEqual([]);
    expect(combinations([opt("size", [])])).toEqual([]);
    expect(combinations([opt("size", ["S", "M"]), opt("colour", ["Red", "Blue"])])).toEqual([
      ["size-S", "colour-Red"],
      ["size-S", "colour-Blue"],
      ["size-M", "colour-Red"],
      ["size-M", "colour-Blue"],
    ]);
    expect(combinations([opt("size", ["S"]), opt("empty", [])])).toEqual([["size-S"]]);
  });

  it("keeps filled rows when values or options are added and removed", () => {
    const size = opt("size", ["S", "M"]);
    let rows = syncRows([size], []);
    expect(rows.map((r) => r.keys)).toEqual([["size-S"], ["size-M"]]);
    rows = rows.map((r, i) => ({ ...r, id: `id${i}`, stock: 5 + i, sku: `SKU${i}` }));
    // add a value: existing rows untouched, the new one starts blank
    const bigger = { ...size, values: [...size.values, { key: "size-L", label: { en: "L" } }] };
    rows = syncRows([bigger], rows);
    expect(rows.map((r) => [r.keys[0], r.stock, r.sku])).toEqual([
      ["size-S", 5, "SKU0"],
      ["size-M", 6, "SKU1"],
      ["size-L", null, null], // a new size starts blank: no id, no SKU, untracked stock
    ]);
    // add a colour: the first combination with each size keeps that size's row (id + stock), others copy stock only
    rows = syncRows([bigger, opt("colour", ["Red", "Blue"])], rows);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ id: "id0", keys: ["size-S", "colour-Red"], stock: 5, sku: "SKU0" });
    expect(rows[1]).toMatchObject({ keys: ["size-S", "colour-Blue"], stock: 5, sku: null });
    expect(rows[1]!.id).toBeUndefined();
    // remove a value
    rows = syncRows([size, opt("colour", ["Red", "Blue"])], rows);
    expect(rows).toHaveLength(4);
    expect(rows[0]!.id).toBe("id0");
  });

  it("titles rows and splits pasted values", () => {
    const os = [opt("size", ["M"]), opt("colour", ["Red"])];
    expect(rowTitle(os, ["size-M", "colour-Red"], (t) => t.en ?? "")).toBe("M / Red");
    expect(splitValues("S, M,L\nXL، m , ", ["xl"])).toEqual(["S", "M", "L"]);
  });

  it("editorFromDb keys rows by id and shows swatches when a value has one", () => {
    const s = editorFromDb(
      [{ id: "o1", name: { en: "Colour" } }],
      [
        { id: "v1", optionId: "o1", label: { en: "Red" }, swatch: "#FF0000" },
        { id: "v2", optionId: "o1", label: { en: "Blue" }, swatch: null },
      ],
      [{ id: "x1", optionValueIds: ["v2"], price: null, compareAtPrice: null, stock: 2, sku: null, isActive: true }],
    );
    expect(s.options[0]!.swatches).toBe(true);
    expect(s.variants.map((r) => [r.keys[0], r.id ?? null])).toEqual([
      ["v1", null],
      ["v2", "x1"],
    ]);
  });
});

describe("variant input validation", () => {
  const base = () => ({
    options: [{ key: "o1", name: { en: "Size" } as Record<string, string>, values: [{ key: "a", label: { en: "S" } as Record<string, string> }, { key: "b", label: { en: "M" } as Record<string, string> }] }],
    variants: [
      { keys: ["a"], price: null as number | null, stock: 3 as number | null, sku: "X-S" as string | null, isActive: true },
      { keys: ["b"], price: 9000, stock: null, sku: null, isActive: true },
    ],
  });

  it("accepts a normal editor payload", () => {
    const r = productVariantsInputSchema.parse(base());
    expect(r.variants).toHaveLength(2);
  });

  it("drops blank values and empty options (and then all variants)", () => {
    const r = productVariantsInputSchema.parse({ options: [{ key: "o1", name: {}, values: [{ key: "a", label: { en: "  " } }] }], variants: [{ keys: ["a"], price: null, stock: null, sku: null, isActive: true }] });
    expect(r).toEqual({ options: [], variants: [] });
  });

  it.each([
    ["option without a name", (b: ReturnType<typeof base>) => { b.options[0]!.name = {}; }, "option_name_required"],
    ["duplicate value", (b: ReturnType<typeof base>) => { b.options[0]!.values[1]!.label = { en: "s" }; }, "duplicate_option_value"],
    ["duplicate SKU", (b: ReturnType<typeof base>) => { b.variants[1]!.sku = "x-s"; }, "duplicate_sku"],
    ["unknown value key", (b: ReturnType<typeof base>) => { b.variants[1]!.keys = ["zzz"]; }, "variant_combination_invalid"],
    ["same combination twice", (b: ReturnType<typeof base>) => { b.variants[1]!.keys = ["a"]; }, "variant_combination_invalid"],
    ["all switched off", (b: ReturnType<typeof base>) => { b.variants.forEach((v) => (v.isActive = false)); }, "variants_all_off"],
    ["bad SKU characters", (b: ReturnType<typeof base>) => { b.variants[0]!.sku = "<script>"; }, "invalid_sku"],
  ])("rejects %s", (_n, mutate, code) => {
    const b = base();
    mutate(b);
    const r = productVariantsInputSchema.safeParse(b);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toContain(code);
  });

  it("rejects oversized input", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ key: `v${i}`, label: { en: `V${i}` } }));
    expect(productVariantsInputSchema.safeParse({ options: [{ key: "o", name: { en: "X" }, values: many }], variants: [] }).success).toBe(false);
    expect(productVariantsInputSchema.safeParse({ options: [{ key: "o", name: { en: "x".repeat(61) }, values: [] }], variants: [] }).success).toBe(false);
  });

  it("variantsFromForm: absent → untouched, bad JSON → rejected", () => {
    const fd = new FormData();
    expect(variantsFromForm(fd)).toBeUndefined();
    fd.set("variants", "{not json");
    expect(productVariantsInputSchema.safeParse(variantsFromForm(fd)).success).toBe(false);
  });

  it("every new error code is translated in all four locales", () => {
    const codes = ["option_name_required", "duplicate_option_value", "variant_combination_invalid", "duplicate_sku", "sku_taken", "too_many_values", "too_many_options", "too_many_variants", "variants_all_off"];
    for (const l of ["ku", "ar", "en", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { errors: Record<string, string>; products: Record<string, string> };
      for (const c of codes) expect(m.errors[c], `${l}.errors.${c}`).toBeTruthy();
      for (const k of ["variants", "variantsHint", "addOption", "presetSize", "presetColour", "applyAll", "variantCount"]) expect(m.products[k], `${l}.products.${k}`).toBeTruthy();
    }
  });
});

describe("syncVariants (seller-created variants end to end)", () => {
  let database: Db;
  beforeAll(async () => {
    database = await testDb();
  });
  const product = (price = 20_000) => ({ name: { en: "Tee" }, description: {}, price, isActive: true, imageUrls: [] });

  it("creates options, values and variants that the storefront and checkout use", async () => {
    const { store } = await seller(database, "var1");
    const input = productVariantsInputSchema.parse({
      options: [
        { key: "o1", name: { en: "Size", ku: "قەبارە" }, values: [{ key: "s", label: { en: "S" } }, { key: "m", label: { en: "M" } }] },
        { key: "o2", name: { en: "Colour" }, swatches: true, values: [{ key: "r", label: { en: "Red" }, swatch: "#FF0000" }] },
      ],
      variants: [
        { keys: ["s", "r"], price: null, stock: 2, sku: "TEE-S-R", isActive: true },
        { keys: ["m", "r"], price: 25_000, stock: 0, sku: "TEE-M-R", isActive: true },
      ],
    });
    const p = await createProduct(database, store.id, product(), input);
    const d = await loadProductDetail(database, store.id, p.id);
    expect(d!.options.map((o) => o.name.en)).toEqual(["Size", "Colour"]);
    expect(d!.options[1]!.values[0]!.swatch).toBe("#FF0000");
    expect(d!.variants.map((v) => [v.sku, v.price, v.stock])).toEqual([
      ["TEE-S-R", 20_000, 2],
      ["TEE-M-R", 25_000, 0],
    ]);
    // checkout: variant required, sold-out variant blocked, priced per variant
    const noVariant = await quoteCart(database, store.id, [{ productId: p.id, quantity: 1 }], null, "en");
    expect(noVariant.lines[0]!.available).toBe(false);
    const [sR, mR] = d!.variants;
    const q = await quoteCart(database, store.id, [{ productId: p.id, variantId: sR!.id, quantity: 1 }], null, "en");
    expect(q.lines[0]).toMatchObject({ available: true, unitPrice: 20_000 });
    const out = await quoteCart(database, store.id, [{ productId: p.id, variantId: mR!.id, quantity: 1 }], null, "en");
    expect(out.lines[0]!.available).toBe(false);
  });

  it("updates in place: kept combinations keep their ids, SKUs can swap, removed ones go", async () => {
    const { store } = await seller(database, "var2");
    const first = productVariantsInputSchema.parse({
      options: [{ key: "o1", name: { en: "Size" }, values: [{ key: "s", label: { en: "S" } }, { key: "m", label: { en: "M" } }, { key: "l", label: { en: "L" } }] }],
      variants: [
        { keys: ["s"], price: null, stock: 1, sku: "A", isActive: true },
        { keys: ["m"], price: null, stock: 1, sku: "B", isActive: true },
        { keys: ["l"], price: null, stock: 1, sku: null, isActive: true },
      ],
    });
    const p = await createProduct(database, store.id, product(), first);
    const cur = await getProductVariants(database, store.id, p.id);
    const [optS, optM] = cur.values;
    const [vS, vM] = cur.variants;
    // Edit: rename the option, drop L, swap the SKUs between S and M, change M's stock, switch S off.
    const second = productVariantsInputSchema.parse({
      options: [{ key: cur.options[0]!.id, id: cur.options[0]!.id, name: { en: "Shoe size" }, values: [{ key: optS!.id, id: optS!.id, label: { en: "S" } }, { key: optM!.id, id: optM!.id, label: { en: "M" } }] }],
      variants: [
        { id: vS!.id, keys: [optS!.id], price: null, stock: 1, sku: "B", isActive: false },
        { id: vM!.id, keys: [optM!.id], price: 30_000, stock: 9, sku: "A", isActive: true },
      ],
    });
    await updateProduct(database, store.id, p.id, product(), second);
    const after = await getProductVariants(database, store.id, p.id);
    expect(after.options).toEqual([{ id: cur.options[0]!.id, name: { en: "Shoe size" } }]);
    expect(after.values.map((v) => v.id)).toEqual([optS!.id, optM!.id]);
    expect(after.variants.map((v) => [v.id, v.sku, v.stock, v.isActive])).toEqual([
      [vS!.id, "B", 1, false],
      [vM!.id, "A", 9, true],
    ]);
    // storefront only shows active variants
    const d = await loadProductDetail(database, store.id, p.id);
    expect(d!.variants.map((v) => v.id)).toEqual([vM!.id]);
    // removing every option turns it back into a simple product
    await updateProduct(database, store.id, p.id, product(), productVariantsInputSchema.parse({ options: [], variants: [] }));
    const none = await getProductVariants(database, store.id, p.id);
    expect([none.options.length, none.values.length, none.variants.length]).toEqual([0, 0, 0]);
    // and an update without the editor (old client / import) leaves variants alone
    await updateProduct(database, store.id, p.id, product(), first);
    await updateProduct(database, store.id, p.id, product());
    expect((await getProductVariants(database, store.id, p.id)).variants).toHaveLength(3);
  });

  it("a SKU used by another product's variant is a clear error and nothing is half-saved", async () => {
    const { store } = await seller(database, "var3");
    const mk = (sku: string) =>
      productVariantsInputSchema.parse({
        options: [{ key: "o1", name: { en: "Size" }, values: [{ key: "s", label: { en: "S" } }] }],
        variants: [{ keys: ["s"], price: null, stock: null, sku, isActive: true }],
      });
    await createProduct(database, store.id, product(), mk("DUP-1"));
    const p2 = await createProduct(database, store.id, product(), mk("OTHER"));
    await expect(updateProduct(database, store.id, p2.id, { ...product(), price: 1 }, mk("DUP-1"))).rejects.toMatchObject({ message: "sku_taken" });
    const v = await getProductVariants(database, store.id, p2.id);
    expect(v.variants[0]!.sku).toBe("OTHER");
  });

  it("ignores ids from another product or store", async () => {
    const a = await seller(database, "var4a");
    const b = await seller(database, "var4b");
    const pa = await createProduct(database, a.store.id, product(), productVariantsInputSchema.parse({
      options: [{ key: "o1", name: { en: "Size" }, values: [{ key: "s", label: { en: "S" } }] }],
      variants: [{ keys: ["s"], price: null, stock: 1, sku: null, isActive: true }],
    }));
    const foreign = await getProductVariants(database, a.store.id, pa.id);
    const pb = await createProduct(database, b.store.id, product(), productVariantsInputSchema.parse({
      options: [{ key: "o1", id: foreign.options[0]!.id, name: { en: "Hijack" }, values: [{ key: foreign.values[0]!.id, id: foreign.values[0]!.id, label: { en: "X" } }] }],
      variants: [{ id: foreign.variants[0]!.id, keys: [foreign.values[0]!.id], price: 1, stock: 1, sku: null, isActive: true }],
    }));
    expect((await getProductVariants(database, a.store.id, pa.id)).options[0]!.name).toEqual({ en: "Size" });
    const mine = await getProductVariants(database, b.store.id, pb.id);
    expect(mine.options[0]!.id).not.toBe(foreign.options[0]!.id);
    expect(mine.variants[0]!.id).not.toBe(foreign.variants[0]!.id);
  });
});
