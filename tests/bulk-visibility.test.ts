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
describe("bulk sale", () => {
  it("action is zod-bounded and store-scoped", () => {
    const s = readFileSync("src/server/actions/dashboard.ts", "utf8");
    expect(s).toMatch(/bulkProductSaleAction[\s\S]*min\(5\)\.max\(90\)[\s\S]*store\.id/);
    for (const l of ["en", "ku", "ar", "kmr"]) {
      const t = readFileSync(`messages/${l}.json`, "utf8");
      expect(t).toContain('"saleAll"');
      expect(t).toContain('"endSale"');
    }
  });
});

import { readFileSync as rfs } from "node:fs";
import { it as it2, expect as ex2 } from "vitest";
it2("bulk sale offers 10/20/30/50 percent presets", () => {
  const s = rfs("src/app/dashboard/products/BulkVisibility.tsx", "utf8");
  ex2(s).toMatch(/\[10, 20, 30, 50\]/);
});
