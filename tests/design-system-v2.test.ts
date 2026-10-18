import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESIGNS, HOME_SECTIONS, PREMIUM_VARIANTS, TYPE_PAIRS, composeDesign, decodeComposition, designSpec, encodeComposition, type DesignSpec,
} from "@/lib/theme-studio/designs";
import { FLAGSHIPS, FLAGSHIP_IDS, FLAGSHIP_LIST, LEGACY_PRESET_TO_FLAGSHIP, PREMIUM_FLAGSHIPS, THEME_GROUPS, flagshipOf, isFlagshipId } from "@/lib/theme-studio/themes";
import { THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";
import { themeSchema } from "@/lib/theme-studio/schema";
import { contrast, readableOn } from "@/lib/theme-studio/contrast";
import { parseTheme } from "@/lib/theme-studio/resolve";

/** Structural axes: what still tells two stores apart with the colours stripped. */
const AXES = ["hero", "grid", "card", "footer", "header", "product", "density", "surface", "type"] as const satisfies readonly (keyof DesignSpec)[];

describe("design system v2: flagship themes", () => {
  it("ships 10 valid flagships, each in a style group", () => {
    expect(FLAGSHIP_IDS.length).toBe(10);
    for (const f of FLAGSHIP_LIST) {
      expect(themeSchema.safeParse(f.theme).success, f.id).toBe(true);
      expect(f.theme.preset).toBe(f.id);
      expect(THEME_GROUPS).toContain(f.group);
    }
    // Flagship ids never collide with legacy preset ids (stored themes keep `preset`).
    for (const id of FLAGSHIP_IDS) expect(Object.keys(THEME_STUDIO_PRESETS)).not.toContain(id);
  });

  it("are complete design languages: any two differ on at least 4 structural axes, colours aside", () => {
    const specs = FLAGSHIP_LIST.map((f) => ({ id: f.id, s: composeDesign(f.theme) }));
    for (let i = 0; i < specs.length; i++)
      for (let j = i + 1; j < specs.length; j++) {
        const diff = AXES.filter((k) => specs[i]!.s[k] !== specs[j]!.s[k]);
        expect(diff.length, `${specs[i]!.id} vs ${specs[j]!.id}: ${diff.join(",")}`).toBeGreaterThanOrEqual(4);
      }
    // The set as a whole covers the variant space, not one layout in ten colours.
    const s = specs.map((x) => x.s);
    expect(new Set(s.map((x) => x.hero)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(s.map((x) => x.grid)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(s.map((x) => x.card)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(s.map((x) => x.type)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(s.map((x) => x.product)).size).toBe(4);
    expect(new Set(s.map((x) => x.surface)).size).toBe(5);
    expect(new Set(s.map((x) => x.header)).size).toBe(5);
  });

  it("composes exactly what each flagship declares", () => {
    for (const f of FLAGSHIP_LIST) {
      const s = composeDesign(f.theme);
      for (const [k, v] of Object.entries(f.theme.layout ?? {})) expect((s as Record<string, unknown>)[k], `${f.id}.${k}`).toEqual(v);
      expect(s.type).toBe(f.theme.type.pair);
    }
  });

  it("palettes are readable: text 4.5:1 on bg and surface, accent 3:1 on bg, button text readable on accent", () => {
    for (const f of FLAGSHIP_LIST) {
      const c = f.theme.colors;
      expect(contrast(c.text, c.bg), f.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.text, c.surface), f.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent, c.bg), f.id).toBeGreaterThanOrEqual(3);
      expect(contrast(readableOn(c.accent), c.accent), f.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("2-3 flagships are premium (Max); below Max they lose premium designs and variants", () => {
    expect(PREMIUM_FLAGSHIPS.size).toBeGreaterThanOrEqual(2);
    expect(PREMIUM_FLAGSHIPS.size).toBeLessThanOrEqual(3);
    for (const f of FLAGSHIP_LIST) {
      const s = composeDesign(f.theme, false);
      expect(s.id === "atelier" || s.id === "pulse").toBe(false);
      for (const axis of Object.keys(PREMIUM_VARIANTS) as (keyof typeof PREMIUM_VARIANTS)[])
        expect((PREMIUM_VARIANTS[axis] as readonly string[]).includes(s[axis]), `${f.id}.${axis}=${s[axis]}`).toBe(false);
    }
    // A non-premium theme can't sneak a premium variant in through mix and match.
    const sneaky = { ...FLAGSHIPS.blush.theme, layout: { ...FLAGSHIPS.blush.theme.layout, hero: "runway" as const, card: "glow" as const } };
    expect(composeDesign(sneaky, false).hero).toBe("arch");
    expect(composeDesign(sneaky, false).card).toBe("soft");
    expect(composeDesign(sneaky, true).hero).toBe("runway");
  });
});

describe("design system v2: old themes keep working", () => {
  it("every legacy preset composes to its design's own layout (no store changes until the seller picks a theme)", () => {
    for (const [id, t] of Object.entries(THEME_STUDIO_PRESETS)) {
      const s = composeDesign(t);
      const d = DESIGNS[t.design];
      for (const k of ["hero", "grid", "card", "footer", "product", "density", "surface", "motion", "chips"] as const) expect(s[k], `${id}.${k}`).toBe(d[k]);
      expect(s.sections).toEqual(d.sections);
      expect(s.type).toBe(t.type.pair);
    }
    // Market keeps its search bar and Pulse its ticker even though their stored header token says "split".
    expect(composeDesign(THEME_STUDIO_PRESETS.market).header).toBe("search");
    expect(composeDesign(THEME_STUDIO_PRESETS.pulse).header).toBe("ticker");
    expect(composeDesign(THEME_STUDIO_PRESETS.ivory).header).toBe("centered");
  });

  it("a v1 theme JSON saved before v2 (no layout, 3-way header) still parses and renders", () => {
    const v1 = { v: 1, preset: "ivory", design: "classic", colors: THEME_STUDIO_PRESETS.ivory!.colors, type: { pair: "sans-clean", scale: "m" }, buttons: { shape: "pill", style: "solid", size: "m" }, cards: { radius: "lg", style: "hairline", ratio: "portrait" }, background: { kind: "solid" }, header: { layout: "centered" } };
    const t = parseTheme(v1);
    expect(t).not.toBeNull();
    expect(composeDesign(t).hero).toBe("split");
    expect(composeDesign(null).id).toBe("classic");
    // Garbage in layout is ignored, never thrown.
    expect(composeDesign({ design: "editorial", layout: { hero: "nope" as never, sections: ["x" as never] } }).hero).toBe("masthead");
  });

  it("maps every legacy preset onto a flagship", () => {
    for (const id of Object.keys(THEME_STUDIO_PRESETS)) expect(isFlagshipId(LEGACY_PRESET_TO_FLAGSHIP[id]), id).toBe(true);
    expect(flagshipOf({ preset: "atelier" })).toBe("luxe");
    expect(flagshipOf({ preset: "glow" })).toBe("glow");
    expect(flagshipOf({ preset: "ai" })).toBeNull();
  });
});

describe("design system v2: preview composition cookie", () => {
  it("round-trips every flagship and keeps bare design ids working", () => {
    for (const f of FLAGSHIP_LIST) {
      const s = composeDesign(f.theme);
      expect(decodeComposition(encodeComposition(s))).toEqual(s);
      expect(encodeComposition(s)).toMatch(/^[a-z0-9.-]+$/);
    }
    expect(decodeComposition("editorial")).toEqual(designSpec("editorial"));
    expect(decodeComposition("v2.nope.a.b")).toBeNull();
    expect(decodeComposition("")).toBeNull();
    expect(decodeComposition(undefined)).toBeNull();
  });
});

describe("design system v2: wiring", () => {
  const page = readFileSync("src/app/s/[slug]/page.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  const fonts = readFileSync("src/app/fonts.ts", "utf8");
  it("the store home has a block for every home section", () => {
    for (const s of HOME_SECTIONS) expect(page, s).toMatch(new RegExp(`\\n    ${s}:`));
  });
  it("every type pair, density, surface and motion has storefront CSS", () => {
    for (const p of TYPE_PAIRS.filter((p) => p !== "sans-clean")) expect(css, p).toContain(`[data-type="${p}"]`);
    for (const v of ["compact", "airy"]) expect(css).toContain(`[data-density="${v}"]`);
    for (const v of ["paper", "glass", "blocks", "glow"]) expect(css).toContain(`[data-surface="${v}"]`);
    for (const v of ["fade", "slide"]) expect(css).toContain(`[data-motion="${v}"]`);
    // Arabic script: no uppercase, no tracking, a tall line box.
    expect(css).toMatch(/html:is\(:lang\(ckb\), :lang\(ar\)\) \.storefront :is\(\.t-hero[^{]+\{[^}]*text-transform: none;[^}]*line-height: 1\.45/);
  });
  it("theme faces never preload and always swap", () => {
    const faces = fonts.split("localFont(").slice(1);
    expect(faces.length).toBeGreaterThanOrEqual(16);
    for (const f of faces) expect(f).toContain('display: "swap"');
    for (const name of ["playfair", "oswald", "grotesk", "jetbrains", "nunito", "kufi", "plex-arabic"]) {
      const block = fonts.slice(fonts.indexOf(`--font-${name}"`) - 400, fonts.indexOf(`--font-${name}"`) + 120);
      expect(block, name).toContain("preload: false");
    }
  });
});
