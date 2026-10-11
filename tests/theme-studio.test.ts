import { describe, expect, it } from "vitest";
import { contrast, ensureContrast } from "@/lib/theme-studio/contrast";
import { themeToCssVars } from "@/lib/theme-studio/css";
import { THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";
import { themeSchema } from "@/lib/theme-studio/schema";

describe("theme studio", () => {
  it("contrast basics", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(ensureContrast("#CCCCCC", "#FFFFFF").fixed).toBe(true);
  });
  it("all presets validate and pass AA for text", () => {
    for (const [k, p] of Object.entries(THEME_STUDIO_PRESETS)) {
      expect(themeSchema.safeParse(p).success, k).toBe(true);
      const { vars } = themeToCssVars(p);
      expect(contrast(vars["--t-fg"]!, vars["--t-bg"]!), k).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--t-on-accent"]!, vars["--t-accent"]!), k).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("auto-fixes low-contrast text and rejects bad input", () => {
    const iv = THEME_STUDIO_PRESETS.ivory!;
    const p = { ...iv, colors: { ...iv.colors, text: "#EEEEEE" } };
    const r = themeToCssVars(p);
    expect(r.fixes).toContain("text");
    expect(themeSchema.safeParse({ ...p, v: 2 }).success).toBe(false);
  });
});
