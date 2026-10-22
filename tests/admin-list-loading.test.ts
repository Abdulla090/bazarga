import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin list loading skeletons", () => {
  for (const d of ["users", "stores", "orders", "products"]) {
    it(`${d} has an accessible, reduced-motion-safe skeleton`, () => {
      const p = `src/app/admin/${d}/loading.tsx`;
      expect(existsSync(p)).toBe(true);
      const s = readFileSync(p, "utf8");
      expect(s).toContain('role="status"');
      expect(s).toContain("motion-safe:animate-pulse");
    });
  }
});
