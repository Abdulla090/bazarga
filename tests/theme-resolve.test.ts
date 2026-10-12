import { describe, expect, it } from "vitest";
import { parseTheme, publishedThemeStyle } from "@/lib/theme-studio/resolve";
import { DEFAULT_THEME, THEME_STUDIO_PRESETS } from "@/lib/theme-studio/presets";

describe("resolve", () => {
  it("null/invalid fall back", () => {
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme({ v: 2 })).toBeNull();
    expect(publishedThemeStyle(undefined)).toBeUndefined();
  });
  it("valid presets emit vars", () => {
    for (const p of Object.values(THEME_STUDIO_PRESETS)) expect(publishedThemeStyle(p)?.["--t-accent"]).toBe(p.colors.accent);
    expect(parseTheme(DEFAULT_THEME)).toEqual(DEFAULT_THEME);
  });
});
