import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
describe("first-order celebration", () => {
  it("has copy in all 4 locales and the card on the dashboard", () => {
    for (const l of ["en", "ku", "ar", "kmr"]) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
      expect(m.dash.firstOrderTitle).toBeTruthy();
      expect(m.dash.firstOrderBody).toContain("{name}");
      expect(m.dash.firstOrderCta).toBeTruthy();
    }
    expect(readFileSync("src/app/dashboard/page.tsx", "utf8")).toContain('data-testid="first-order"');
  });
});
