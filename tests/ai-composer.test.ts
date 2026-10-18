import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GeminiText, MockText } from "@/server/ai/text";
import {
  OPTION_COUNT, catalogTraits, composeDesigns, composeInputSchema, composePrompt, detectNiche, mockComposition, normalizeComposition, normalizeOption,
  type CatalogContext, type ComposeInput,
} from "@/server/ai/design-composer";
import { themeSchema } from "@/lib/theme-studio/schema";
import { contrast } from "@/lib/theme-studio/contrast";
import { CARD_VARIANTS, FOOTER_VARIANTS, GRID_VARIANTS, HEADER_VARIANTS, HERO_VARIANTS, PRODUCT_LAYOUTS, TYPE_PAIRS, composeDesign, encodeComposition } from "@/lib/theme-studio/designs";
import { decodePreviewTheme, encodePreviewTheme } from "@/lib/theme-studio/preview-token";
import { previewThemeParam } from "@/lib/preview";
import { FLAGSHIPS } from "@/lib/theme-studio/themes";

const cat = (cats: string[], titles: string[], o: { img?: boolean; sale?: boolean; n?: number; cover?: boolean } = {}): CatalogContext => ({
  categories: cats,
  products: titles.map((t) => ({ title: t, price: 25000, onSale: !!o.sale, hasImage: o.img ?? true })),
  productCount: o.n ?? titles.length,
  hasCover: o.cover ?? true,
});
const inp = (brief: string, catalog: CatalogContext, extra: Partial<ComposeInput> = {}): ComposeInput => ({ brief, lang: "en", storeName: "Studio Hawler", catalog, ...extra });

const STORES: ComposeInput[] = [
  inp("handmade perfumes and oud from Erbil", cat(["Perfume", "Oud"], ["Rose attar 50ml", "Black oud"])),
  inp("kids toys and school bags", cat(["Toys"], ["Plush bear", "Lego set", "School bag"])),
  inp("sneaker drops", cat(["Sneakers"], ["Jordan 1 Low", "Hoodie"], { sale: true })),
  inp("honey and dates from Duhok", cat(["Honey", "Dates"], ["Mountain honey", "Medjool dates"], { img: false, n: 45 })),
  inp("skincare and makeup", cat(["Skincare"], ["Vitamin C serum", "Lipstick"])),
  inp("ceramic vases and linen for home", cat(["Home"], ["Ceramic vase", "Linen towel"])),
  inp("used books and journals", cat(["Books"], ["Novel", "Journal"])),
  inp("phone chargers and headphones", cat(["Electronics"], ["USB-C charger", "Earbuds"])),
];

describe("AI Website Designer v2: composer (three full designs)", () => {
  it("brief is validated, vibe optional", () => {
    expect(composeInputSchema.safeParse({ brief: "x" }).success).toBe(false);
    expect(composeInputSchema.parse({ brief: " perfume shop ", vibe: "luxury" })).toEqual({ brief: "perfume shop", vibe: "luxury" });
  });

  it("reads the niche from the brief, the categories and the product names (any language)", () => {
    expect(detectNiche("handmade perfumes", cat([], []))).toBe("luxury");
    expect(detectNiche("my shop", cat(["Toys"], ["Plush bear"]))).toBe("kids");
    expect(detectNiche("شتی جوان", cat(["گوڵ"], ["بوکێی گوڵ"]))).toBe("beauty");
    expect(detectNiche("dikana min", cat(["Pirtûk"], ["Roman"]))).toBe("books");
    expect(detectNiche("anything", cat([], []))).toBe("general");
    expect(detectNiche("anything", cat([], []), "playful")).toBe("kids");
  });

  it("every option is a valid, complete composition with readable colours and copy in the store language", () => {
    for (const lang of ["ku", "kmr", "ar", "en"] as const) {
      for (const s of STORES) {
        const opts = mockComposition({ ...s, lang });
        expect(opts).toHaveLength(OPTION_COUNT);
        expect(opts.map((o) => o.id)).toEqual(["a", "b", "c"]);
        for (const o of opts) {
          expect(themeSchema.safeParse(o.theme).success).toBe(true);
          const L = o.theme.layout!;
          expect(HEADER_VARIANTS).toContain(L.header);
          expect(HERO_VARIANTS).toContain(L.hero);
          expect(GRID_VARIANTS).toContain(L.grid);
          expect(CARD_VARIANTS).toContain(L.card);
          expect(PRODUCT_LAYOUTS).toContain(L.product);
          expect(FOOTER_VARIANTS).toContain(L.footer);
          expect(L.sections!.length).toBeGreaterThan(0);
          expect(TYPE_PAIRS).toContain(o.theme.type.pair);
          expect(contrast(o.theme.colors.text, o.theme.colors.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(o.theme.colors.text, o.theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(o.theme.colors.accent, o.theme.colors.bg)).toBeGreaterThanOrEqual(3);
          expect(o.theme.copy!.lang).toBe(lang);
          expect(o.theme.copy!.tagline.length).toBeGreaterThan(0);
          if (lang === "ku" || lang === "ar") expect(o.theme.copy!.tagline).toMatch(/[\u0600-\u06FF]/);
          if (lang === "kmr") expect(o.theme.copy!.tagline.replace("Studio Hawler", "")).not.toMatch(/[\u0600-\u06FF]/);
          expect(decodePreviewTheme(o.preview)).not.toBeNull();
        }
      }
    }
  });

  it("the mock is deterministic but the three options really differ (base, hero, composition)", () => {
    for (const s of STORES) {
      const a = mockComposition(s);
      expect(a).toEqual(mockComposition(s));
      expect(new Set(a.map((o) => o.base)).size).toBe(3);
      expect(new Set(a.map((o) => o.theme.layout!.hero)).size).toBe(3);
      expect(new Set(a.map((o) => encodeComposition(composeDesign(o.theme)))).size).toBe(3);
    }
  });

  it("the mock fits the niche and varies across niches", () => {
    const lead = (s: ComposeInput) => mockComposition(s)[0]!.base;
    expect(lead(STORES[0]!)).toBe("luxe");
    expect(lead(STORES[1]!)).toBe("play");
    expect(lead(STORES[2]!)).toBe("street");
    expect(lead(STORES[3]!)).toBe("hearth");
    expect(lead(STORES[4]!)).toBe("glow");
    expect(lead(STORES[7]!)).toBe("circuit");
    const firstHeroes = new Set(STORES.map((s) => mockComposition(s)[0]!.theme.layout!.hero));
    expect(firstHeroes.size).toBeGreaterThanOrEqual(5);
    // Same niche, different brief → not the same three.
    const x = mockComposition(inp("perfume", cat(["Perfume"], ["Oud"])));
    const y = mockComposition(inp("gold jewellery and watches", cat(["Gold"], ["Ring"])));
    const fp = (os: typeof x) => os.map((o) => o.base + encodeComposition(composeDesign(o.theme)) + o.theme.colors.bg + o.theme.type.pair).join("|");
    expect(fp(x)).not.toBe(fp(y));
  });

  it("respects the real catalogue: no photo-led parts without photos, sale only when on sale, dense for big catalogues", () => {
    const noPhotos = mockComposition(STORES[3]!);
    for (const o of noPhotos) {
      expect(["fullbleed", "runway", "spotlight", "arch"]).not.toContain(o.theme.layout!.hero);
      expect(["tiles", "lookbook"]).not.toContain(o.theme.layout!.grid);
      expect(o.theme.layout!.sections).not.toContain("spotlight");
      expect(o.theme.layout!.density).toBe("compact");
    }
    expect(noPhotos.some((o) => o.theme.layout!.grid === "dense")).toBe(true);
    for (const o of mockComposition(STORES[0]!)) expect(o.theme.layout!.sections).not.toContain("sale");
    expect(mockComposition(STORES[2]!).some((o) => o.theme.layout!.sections!.includes("sale"))).toBe(true);
    for (const o of mockComposition(inp("prints", cat(["Art"], ["Poster"], { cover: false })))) expect(o.theme.layout!.hero).not.toBe("fullbleed");
    expect(catalogTraits(cat([], [], { cover: false })).photoRich).toBe(false);
  });

  it("normalises a model answer: unknown values fall back to the base, colours fixed, duplicates and junk replaced", () => {
    const n = normalizeOption({ base: "folio", layout: { hero: "weird", grid: "bento", sections: ["story", "nope", "story", "best"] }, fontPair: "comic", palette: { accent: "#FFFFFE", bg: "#FFFFFF", text: "#EEEEEE" }, headline: "", tagline: "x".repeat(300) }, "en", { headline: "H", tagline: "T" })!;
    expect(n.theme.layout!.hero).toBe(FLAGSHIPS.folio.theme.layout!.hero);
    expect(n.theme.layout!.grid).toBe("bento");
    expect(n.theme.layout!.sections).toEqual(["story", "best"]);
    expect(n.theme.type.pair).toBe(FLAGSHIPS.folio.theme.type.pair);
    expect(contrast(n.theme.colors.text, n.theme.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(n.theme.colors.accent, n.theme.colors.bg)).toBeGreaterThanOrEqual(3);
    expect(n.theme.copy!.tagline.length).toBeLessThanOrEqual(140);
    expect(n.theme.header.announce).toBe("H");
    expect(normalizeOption({ base: "nope" }, "en", { headline: "", tagline: "t" })).toBeNull();

    const one = { base: "street", layout: { hero: "pulse" }, palette: { accent: "#FF3B2F", bg: "#0A0A0A", text: "#F5F5F5" }, tagline: "Night drops" };
    const opts = normalizeComposition({ options: [one, one, { base: "nope" }] }, STORES[2]!);
    expect(opts).toHaveLength(3);
    expect(opts[0]!.theme.copy!.tagline).toBe("Night drops");
    expect(new Set(opts.map((o) => encodeComposition(composeDesign(o.theme)) + o.theme.colors.bg)).size).toBe(3);
    expect(() => normalizeComposition({ options: [] }, STORES[2]!)).toThrow();
    expect(() => normalizeComposition("nonsense", STORES[2]!)).toThrow();
  });

  it("prompt carries the catalogue, every part and the store language", () => {
    const p = composePrompt({ ...STORES[2]!, lang: "kmr" });
    expect(p.system).toContain("Kurmanji");
    for (const v of [...HERO_VARIANTS, ...GRID_VARIANTS, ...TYPE_PAIRS, "luxe", "play"]) expect(p.system).toContain(v);
    expect(p.system).toMatch(/Never invent prices/);
    expect(p.user).toContain("Jordan 1 Low");
    expect(p.user).toContain("on sale");
  });

  it("uses the real provider when configured, the mock otherwise", async () => {
    const answer = { options: [{ base: "luxe", tagline: "a" }, { base: "folio", tagline: "b" }, { base: "canvas", tagline: "c" }] };
    const fake = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })) as unknown as typeof fetch;
    const r = await composeDesigns(new GeminiText({ apiKey: "K", model: "m" }, fake), STORES[0]!);
    expect(r.map((o) => o.base)).toEqual(["luxe", "folio", "canvas"]);
    expect((await composeDesigns(new MockText(), STORES[0]!))[0]!.base).toBe("luxe");
  });

  it("preview tokens carry no text and round-trip; the proxy accepts them, junk is refused", () => {
    const o = mockComposition({ ...STORES[0]!, lang: "ku" })[0]!;
    const back = decodePreviewTheme(o.preview)!;
    expect(back.copy).toBeUndefined();
    expect(back.header.announce).toBeUndefined();
    expect(encodeComposition(composeDesign(back))).toBe(encodeComposition(composeDesign(o.theme)));
    expect(back.colors).toEqual(o.theme.colors);
    expect(o.preview).toBe(encodePreviewTheme(o.theme));
    expect(previewThemeParam("/s/x", new URLSearchParams({ pv: "1", pvt: o.preview }))).toBe(o.preview);
    expect(previewThemeParam("/s/x", new URLSearchParams({ pvt: o.preview }))).toBeNull();
    expect(decodePreviewTheme("t.AAAAAAAAAAAAAAAAAAAA")).toBeNull();
    expect(decodePreviewTheme("t." + btoa(JSON.stringify({ ...back, colors: { ...back.colors, bg: "red" } })).replace(/=+$/, ""))).toBeNull();
    expect(readFileSync("src/app/s/[slug]/design.ts", "utf8")).toContain("decodePreviewTheme(pvt)");
  });

  it("UI: three options side by side with live thumbnails, 44px targets, every new string in 4 locales (kmr not English)", () => {
    const ui = readFileSync("src/components/dashboard/AiDesigner.tsx", "utf8");
    expect(ui).toContain("composeStoreDesignsAction");
    expect(ui).toContain("grid-cols-3");
    expect(ui).toContain("<ThemeThumb");
    expect(ui).toContain("pvt=${o.preview}");
    expect(ui).toMatch(/ai-option-use-\$\{o\.id\}/);
    for (const m of ui.match(/<button[^>]*className="[^"]*"/g) ?? []) expect(m).toMatch(/min-h-11|h-11/);
    const msgs = Object.fromEntries(["en", "ku", "kmr", "ar"].map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, "utf8")).aiDesigner]));
    for (const k of ["options", "optionsNote", "use", "picked", "optionName", "generate", "again", "left", "intro"]) {
      for (const l of ["en", "ku", "kmr", "ar"]) expect(msgs[l][k], `${l}.${k}`).toBeTruthy();
      expect(msgs.kmr[k], k).not.toBe(msgs.en[k]);
      expect(msgs.ku[k]).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
