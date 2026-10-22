import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("empty storefront results offer a reset link when only the in-stock filter is on", () => {
  const src = readFileSync("src/app/s/[slug]/page.tsx", "utf8");
  expect(src).toContain("(q || c || offers || inStock) && (");
});
