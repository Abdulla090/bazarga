import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("storefront renders real content without JavaScript", () => {
  // A loading.tsx wraps the page in a Suspense boundary: the HTML then ships the skeleton and the real page in a hidden
  // div that only a script swaps in, so no-JS visitors (and some crawlers / link previewers) saw a skeleton forever.
  it.each(["src/app/s/[slug]/loading.tsx", "src/app/s/[slug]/p/[productId]/loading.tsx"])("%s is absent (home and product render blocking)", (f) => {
    expect(existsSync(f)).toBe(false);
  });
  it("the root layout allows blocking routes (instant = false)", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/export const instant = false/);
  });
});
