import { describe, expect, it } from "vitest";
import { BUILT_DESIGNS, DESIGNS, DESIGN_IDS, designSpec, isDesignId, numberSections } from "@/lib/theme-studio/designs";
import { THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";
import { themeSchema } from "@/lib/theme-studio/schema";
import { parseTheme } from "@/lib/theme-studio/resolve";

describe("store designs", () => {
  it("every design id has a spec and built designs differ in composition", () => {
    for (const id of DESIGN_IDS) expect(DESIGNS[id].id).toBe(id);
    const built = BUILT_DESIGNS.map((id) => DESIGNS[id]);
    expect(new Set(built.map((d) => d.hero)).size).toBe(built.length);
    expect(new Set(built.map((d) => d.grid)).size).toBe(built.length);
    expect(new Set(built.map((d) => d.card)).size).toBe(built.length);
    expect(new Set(built.map((d) => d.footer)).size).toBe(built.length);
  });
  it("unknown and not-yet-built designs fall back to classic", () => {
    expect(designSpec("editorial").id).toBe("editorial");
    expect(designSpec("market").id).toBe("market");
    expect(designSpec("gallery").id).toBe("gallery");
    expect(designSpec("boutique").id).toBe("boutique");
    expect(designSpec("mono").id).toBe("mono");
    expect(designSpec("studio").id).toBe("classic");
    expect(designSpec("nope").id).toBe("classic");
    expect(designSpec(undefined).id).toBe("classic");
    expect(isDesignId("studio")).toBe(true);
    expect(isDesignId("x")).toBe(false);
  });
  it("themes saved before designs parse as classic", () => {
    const old = { ...THEME_STUDIO_PRESETS.ivory!, design: undefined };
    const parsed = parseTheme(old);
    expect(parsed?.design).toBe("classic");
    expect(themeSchema.safeParse({ ...old, design: "bogus" }).success).toBe(false);
  });
  it("presets that name a built design use it", () => {
    expect(THEME_STUDIO_PRESETS.editorial!.design).toBe("editorial");
    expect(THEME_STUDIO_PRESETS.market!.design).toBe("market");
    expect(THEME_STUDIO_PRESETS.gallery!.design).toBe("gallery");
    expect(THEME_STUDIO_PRESETS.boutique!.design).toBe("boutique");
    expect(THEME_STUDIO_PRESETS.mono!.design).toBe("mono");
    for (const p of Object.values(THEME_STUDIO_PRESETS)) expect(DESIGN_IDS).toContain(p.design);
  });
  it("numbers only the sections that are present, in the design's own order", () => {
    const n = numberSections(DESIGNS.editorial.sections, { spotlight: true, collections: true, best: false, sale: true });
    expect(n.spotlight).toBe("01");
    expect(n.collections).toBe("02");
    expect(n.best).toBe("");
    expect(n.sale).toBe(""); // not part of the editorial order
    expect(numberSections(DESIGNS.market.sections, { sale: true, best: true }).best).toBe("02");
  });
});
