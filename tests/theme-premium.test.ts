import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BUILT_DESIGNS, DESIGNS, PREMIUM_DESIGNS, designSpec, isPremiumDesign } from "@/lib/theme-studio/designs";
import { PREMIUM_PRESETS, THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";
import { themeSchema } from "@/lib/theme-studio/schema";
import { getPlan, hasFeature } from "@/lib/plans";

describe("premium designs (Max)", () => {
  it("are full designs: own hero, grid, card and footer, not palette swaps", () => {
    const base = BUILT_DESIGNS.filter((d) => !isPremiumDesign(d)).map((d) => DESIGNS[d]);
    for (const id of PREMIUM_DESIGNS) {
      const d = DESIGNS[id];
      for (const k of ["hero", "grid", "card", "footer"] as const) expect(base.map((b) => b[k])).not.toContain(d[k]);
    }
    expect(PREMIUM_DESIGNS.length).toBeGreaterThanOrEqual(2);
  });
  it("each has a valid preset flagged premium", () => {
    for (const id of PREMIUM_DESIGNS) {
      const p = THEME_STUDIO_PRESETS[id]!;
      expect(p.design).toBe(id);
      expect(themeSchema.safeParse(p).success).toBe(true);
      expect(PREMIUM_PRESETS.has(id)).toBe(true);
    }
    for (const [id, p] of Object.entries(THEME_STUDIO_PRESETS)) if (!PREMIUM_PRESETS.has(id)) expect(isPremiumDesign(p.design)).toBe(false);
  });
  it("stores below Max render classic; Max renders the design", () => {
    expect(designSpec("atelier", false).id).toBe("classic");
    expect(designSpec("pulse", false).id).toBe("classic");
    expect(designSpec("atelier", true).id).toBe("atelier");
    expect(designSpec("studio", false).id).toBe("studio");
    expect(hasFeature("business", "templatesPremium")).toBe(false);
    expect(hasFeature("max", "templatesPremium")).toBe(true);
    expect(getPlan("max").features.find((f) => f.key === "templatesPremium")?.soon).toBeUndefined();
  });
  it("publishing is gated server-side and the storefront passes the plan", () => {
    expect(readFileSync("src/server/actions/theme.ts", "utf8")).toMatch(/usesPremium\(theme\)\) assertFeature\(store, "templatesPremium"\)/);
    expect(readFileSync("src/app/s/[slug]/design.ts", "utf8")).toContain('hasFeature(normalizePlan(plan), "templatesPremium")');
    for (const f of ["src/app/s/[slug]/layout.tsx", "src/app/s/[slug]/page.tsx", "src/app/s/[slug]/p/[productId]/page.tsx"]) expect(readFileSync(f, "utf8")).toMatch(/resolve(Store)?Design\(slug, store\.themePublished, store\.plan\)/);
  });
  it("RTL-safe CSS: no uppercase/tracking for ckb/ar in premium designs", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/html:lang\(ckb\) \.at-eyebrow, html:lang\(ar\) \.at-eyebrow \{ text-transform: none; letter-spacing: 0/);
    expect(css).toMatch(/\[dir="rtl"\] \.pulse-track/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.pulse-track/);
  });
});
