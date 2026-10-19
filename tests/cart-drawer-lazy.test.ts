import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("store layout loads the cart drawer lazily, not in the first-load bundle", () => {
  const layout = readFileSync("src/app/s/[slug]/layout.tsx", "utf8");
  expect(layout).toContain("CartDrawerLazy");
  expect(layout).not.toMatch(/from "@\/components\/store\/CartDrawer";/);
  expect(readFileSync("src/components/store/CartDrawerLazy.tsx", "utf8")).toContain('import("./CartDrawer")');
});
