import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("form skeleton loading states", () => {
  for (const d of ["products/new", "products/[id]", "products/import", "settings/domain", "settings/seo"]) {
    it(`${d} uses FormSkeleton`, () => {
      const f = `src/app/dashboard/${d}/loading.tsx`;
      expect(existsSync(f)).toBe(true);
      expect(readFileSync(f, "utf8")).toContain("FormSkeleton");
    });
  }
});
