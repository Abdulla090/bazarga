import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/server/actions/locale", () => ({ setLocaleAction: async () => {}, setLocaleFormAction: async () => {} }));

const { LocaleSwitcher } = await import("@/components/LocaleSwitcher");
const { switcherItems, SWITCHER_LABEL } = await import("@/lib/i18n");

describe("language dropdown (everywhere)", () => {
  it("lists سۆرانی, Kurmancî, العربية, English in that order with lang/dir", () => {
    const items = switcherItems();
    expect(items.map((i) => i.label)).toEqual(["سۆرانی", "Kurmancî", "العربية", "English"]);
    expect(items.map((i) => i.dir)).toEqual(["rtl", "ltr", "rtl", "ltr"]);
    expect(switcherItems(["en", "ku"]).map((i) => i.value)).toEqual(["ku", "en"]);
    expect(SWITCHER_LABEL.ku).toBe("سۆرانی");
  });

  it("LocaleSwitcher renders one trigger (globe + current name), closed, 44px, no pill row", () => {
    for (const [l, name] of [["ku", "سۆرانی"], ["en", "English"], ["ar", "العربية"], ["kmr", "Kurmancî"]] as const) {
      const html = renderToStaticMarkup(createElement(LocaleSwitcher, { current: l }));
      // one trigger; the 4 picks ship closed inside <details> (+ a server-action form) so taps work before hydration
      expect(html.match(/data-lang-trigger/g)?.length).toBe(1);
      expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*data-lang-dropdown/);
      expect(html.match(/role="menuitemradio"/g)?.length).toBe(4);
      expect(html).toContain('name="locale"');
      expect(html).toContain('aria-haspopup="menu"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain(name);
      expect(html).toContain("min-h-11");
      expect(html).not.toContain("aria-pressed");
      expect(html).not.toContain('role="group"');
    }
    expect(renderToStaticMarkup(createElement(LocaleSwitcher, { current: "ku", compact: true }))).toMatch(/>ku</);
  });

  it("is direction-aware, keyboard accessible, viewport-capped and reduced-motion safe", () => {
    const src = readFileSync("src/components/LanguageDropdown.tsx", "utf8");
    expect(src).toContain('role="menu"');
    expect(src).toContain('role="menuitemradio"');
    expect(src).toContain("aria-checked");
    for (const k of ['"Escape"', '"ArrowDown"', '"ArrowUp"', '"Home"', '"End"', '"Tab"']) expect(src).toContain(k);
    expect(src).toContain("pointerdown");
    expect(src).toMatch(/direction === "rtl"/);
    expect(src).toContain('"start-0" : "end-0"');
    expect(src).toContain("max-w-[calc(100vw-1rem)]");
    expect(src).toContain("motion-safe:animate-[ld-in");
    expect(readFileSync("src/app/globals.css", "utf8")).toContain("@keyframes ld-in");
  });
});
