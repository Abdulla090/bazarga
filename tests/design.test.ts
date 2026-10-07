import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArrowBack, ArrowForward, ChevronForward, Icon, ShoppingCart } from "@/components/ui/icons";
import { BRAND, PRESET_TOKENS } from "@/lib/theme";

const SRC = path.join(process.cwd(), "src");
function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

describe("icon set", () => {
  it("UI components (.tsx) use SVG icons, not emoji (outgoing WhatsApp/Telegram text in .ts is exempt)", () => {
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]\u{FE0F}?/u;
    const offenders = files(SRC)
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => ({ f: path.relative(SRC, f), i: i + 1, line }))
          .filter(({ line }) => EMOJI.test(line) && !line.trim().startsWith("*") && !line.trim().startsWith("//")),
      );
    expect(offenders).toEqual([]);
  });

  it("icons are decorative by default and labelled when asked", () => {
    const deco = renderToStaticMarkup(createElement(Icon, { as: ShoppingCart }));
    expect(deco).toContain("<svg");
    expect(deco).toContain('aria-hidden="true"');
    const labelled = renderToStaticMarkup(createElement(Icon, { as: ShoppingCart, label: "Cart" }));
    expect(labelled).toContain('aria-label="Cart"');
    expect(labelled).toContain('role="img"');
    expect(labelled).not.toContain("aria-hidden");
  });

  it("forward/back arrows mirror in RTL", () => {
    for (const C of [ArrowForward, ArrowBack, ChevronForward]) {
      expect(renderToStaticMarkup(createElement(C))).toContain("rtl:-scale-x-100");
    }
    expect(renderToStaticMarkup(createElement(ArrowForward))).toContain("lucide-arrow-right");
    expect(renderToStaticMarkup(createElement(ArrowBack))).toContain("lucide-arrow-left");
  });

  it("lucide is imported only through the icon module (keeps the set tree-shaken and consistent)", () => {
    const direct = files(SRC).filter(
      (f) => !f.endsWith(path.join("ui", "icons.tsx")) && /from "lucide-react"/.test(readFileSync(f, "utf8")),
    );
    expect(direct.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("design tokens", () => {
  const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
  it("brand colours in CSS match src/lib/theme.ts", () => {
    expect(css).toContain(`--color-gold: ${BRAND.gold.toLowerCase()}`);
    expect(css).toContain(`--color-ink: ${BRAND.ink.toLowerCase()}`);
    expect(css).toContain(`--color-green: ${BRAND.green.toLowerCase()}`);
    expect(css).toContain(`--color-paper: ${BRAND.paper.toLowerCase()}`);
    expect(css).toContain(`--color-green-deep: ${BRAND.greenDeep.toLowerCase()}`);
  });
  it(":root storefront defaults equal the bazaar preset", () => {
    const b = PRESET_TOKENS.bazaar;
    for (const [k, v] of [
      ["bg", b.bg], ["surface", b.surface], ["fg", b.fg], ["muted", b.muted], ["border", b.border],
      ["accent", b.accent], ["on-accent", b.onAccent], ["hero", b.hero], ["on-hero", b.onHero], ["radius", b.radius],
    ] as const) {
      expect(css).toContain(`--st-${k}: ${v.toLowerCase()};`);
    }
  });
  it("fonts are self-hosted next/font files with licences", () => {
    const fonts = readFileSync(path.join(SRC, "app/fonts.ts"), "utf8");
    expect(fonts).toContain('from "next/font/local"');
    for (const f of ["vazirmatn-arabic-wght-normal.woff2", "inter-latin-wght-normal.woff2", "inter-latin-ext-wght-normal.woff2", "LICENSE-Inter.txt", "LICENSE-Vazirmatn.txt"]) {
      expect(statSync(path.join(SRC, "app/fonts", f)).size).toBeGreaterThan(1000);
    }
    expect(css).toMatch(/--font-sans: var\(--font-vazirmatn\), var\(--font-inter\)/);
  });
});
