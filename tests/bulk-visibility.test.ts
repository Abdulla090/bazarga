import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("bulk visibility", () => {
  it("has 4-locale strings", () => {
    for (const l of ["en", "ku", "ar", "kmr"]) {
      const j = JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
      const found = JSON.stringify(j).includes('"hideAll"') && JSON.stringify(j).includes('"showAll"');
      expect(found).toBe(true);
    }
  });
  it("action validates ids and scopes to store", () => {
    const s = readFileSync("src/server/actions/dashboard.ts", "utf8");
    expect(s).toMatch(/bulkProductVisibilityAction[\s\S]*z\.array\(uuid\)\.max\(100\)[\s\S]*store\.id/);
  });
});
