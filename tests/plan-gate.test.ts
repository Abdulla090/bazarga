import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FEATURE_MIN_PLAN, PLAN_IDS, getPlan, hasFeature, planAtLeast, COMPARE } from "@/lib/plans";
import { assertFeature } from "@/server/plan-gate";

describe("plan feature gates", () => {
  it("planAtLeast follows free < pro < business < max", () => {
    expect(planAtLeast("free", "pro")).toBe(false);
    expect(planAtLeast("business", "pro")).toBe(true);
    expect(planAtLeast("max", "max")).toBe(true);
    expect(planAtLeast("business", "max")).toBe(false);
  });

  it("bulk CSV import is Business+", () => {
    expect(PLAN_IDS.filter((p) => hasFeature(p, "bulkCsv"))).toEqual(["business", "max"]);
    expect(() => assertFeature({ plan: "pro" }, "bulkCsv")).toThrow("plan_feature");
    expect(() => assertFeature({ plan: null }, "bulkCsv")).toThrow("plan_feature");
    expect(() => assertFeature({ plan: "business" }, "bulkCsv")).not.toThrow();
  });

  it("each gated feature's min plan is the first plan whose card lists it", () => {
    expect(FEATURE_MIN_PLAN.bulkCsv).toBe("business");
    expect(getPlan("business").features.find((f) => f.key === "bulkCsv")?.soon).toBeFalsy();
    expect(COMPARE.find((r) => r.key === "bulkCsv")).toMatchObject({ free: false, pro: false, business: true, max: true });
  });

  it("the CSV import server action enforces the gate (not only the page)", () => {
    const src = readFileSync("src/server/actions/dashboard.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function importProductsCsvAction"));
    expect(fn.slice(0, fn.indexOf("parseProductsCsv("))).toContain('assertFeature(store, "bulkCsv")');
  });
});
