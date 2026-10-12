import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMPARE, PLANS, getPlan, usd, yearlyMonthsFree } from "../src/lib/plans";

describe("plans config", () => {
  it("has the agreed round USD prices", () => {
    expect(getPlan("free").monthly).toBe(0);
    expect(getPlan("pro")).toMatchObject({ monthly: 10, yearly: 100, firstMonth: 1 });
    expect(getPlan("business").monthly).toBe(20);
    for (const p of PLANS) expect(Number.isInteger(p.monthly) && Number.isInteger(p.yearly)).toBe(true);
  });
  it("yearly Pro is 2 months free; usd uses ASCII", () => {
    expect(yearlyMonthsFree(getPlan("pro"))).toBe(2);
    expect(usd(10)).toBe("$10");
  });
  it("every feature, row and cell key exists in all 4 locales", () => {
    for (const loc of ["en", "ku", "kmr", "ar"]) {
      const m = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8")).pricing;
      for (const p of PLANS) { expect(m[p.id]).toBeTruthy(); for (const f of p.features) expect(m.features[f]).toBeTruthy(); }
      for (const r of COMPARE) {
        expect(m.rows[r.key]).toBeTruthy();
        for (const v of [r.free, r.pro, r.business]) if (typeof v === "string") expect(m.cells[v]).toBeTruthy();
      }
      for (const k of ["q1", "q2", "q3", "q4"]) expect(m.faq[k].a).toBeTruthy();
      expect(JSON.stringify(m)).not.toMatch(/[٠-٩]/);
    }
  });
});
