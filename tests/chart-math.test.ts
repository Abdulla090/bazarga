import { describe, expect, it } from "vitest";
import { areaPath, donutArc, donutSlices, linePath, maxNice, pctChange, scalePoints } from "@/lib/chart-math";

describe("chart math", () => {
  it("rounds axis max up to a nice number", () => {
    expect(maxNice(0)).toBe(1);
    expect(maxNice(73)).toBe(100);
    expect(maxNice(1200)).toBe(2000);
    expect(maxNice(4)).toBe(5);
  });
  it("scales points and flips for RTL", () => {
    expect(scalePoints([0, 10], 100, 50, 10)).toEqual([{ x: 0, y: 50 }, { x: 100, y: 0 }]);
    expect(scalePoints([0, 10], 100, 50, 10, true)[0]).toEqual({ x: 100, y: 50 });
  });
  it("builds paths", () => {
    const pts = scalePoints([0, 10], 100, 50, 10);
    expect(linePath(pts)).toBe("M0 50L100 0");
    expect(areaPath(pts, 50)).toBe("M0 50L100 0L100 50L0 50Z");
  });
  it("computes period change", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(5, 0)).toBeNull();
  });
  it("splits donut slices", () => {
    const s = donutSlices([1, 1]);
    expect(s[1]!.a1).toBeCloseTo(Math.PI * 2);
    expect(donutArc(50, 50, 40, 0, Math.PI)).toContain("A40 40 0 0 1");
  });
});
