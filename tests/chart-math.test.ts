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

import { bucketStacks, calendarCells, funnelRows, gaugeAngles, heatLevel, heatMatrix, iraqWeekRow, stackHeights, statusGroup } from "@/lib/chart-math";

describe("chart math: funnel, heat, calendar, gauge, stacks", () => {
  it("funnel rows narrow into the next step and report drop-off", () => {
    const r = funnelRows([200, 100, 40, 10]);
    expect(r.map((x) => x.from)).toEqual([100, 50, 20, 8]);
    expect(r.map((x) => x.to)).toEqual([50, 20, 8, 8]);
    expect(r.map((x) => x.dropPct)).toEqual([null, 50, 60, 75]);
    expect(r[3]!.pctOfFirst).toBe(5);
    expect(funnelRows([0, 0])[0]!.from).toBe(8);
  });
  it("heat levels are quartiles of the max", () => {
    expect([0, 1, 30, 60, 100].map((v) => heatLevel(v, 100))).toEqual([0, 1, 2, 3, 4]);
    expect(heatLevel(5, 0)).toBe(0);
  });
  it("heat matrix is Saturday-first and ignores bad rows", () => {
    expect(iraqWeekRow(6)).toBe(0);
    expect(iraqWeekRow(5)).toBe(6);
    const m = heatMatrix([{ dow: 6, hour: 21, n: 3 }, { dow: 6, hour: 21, n: 1 }, { dow: 0, hour: 0, n: 2 }, { dow: 9, hour: 1, n: 5 }]);
    expect(m[0]![21]).toBe(4);
    expect(m[1]![0]).toBe(2);
    expect(m.flat().reduce((a, b) => a + b, 0)).toBe(6);
  });
  it("calendar cells align weekdays and mirror for RTL", () => {
    // 2026-10-10 is a Saturday → row 0, col 0; Friday 2026-10-16 → row 6; Saturday 2026-10-17 → next column.
    const days = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
    const vals = [1, 0, 0, 0, 0, 0, 4, 2];
    const { cells, cols } = calendarCells(days, vals);
    expect(cols).toBe(2);
    expect([cells[0], cells[6], cells[7]].map((c) => [c!.col, c!.row, c!.level])).toEqual([[0, 0, 1], [0, 6, 4], [1, 0, 2]]);
    expect(calendarCells(days, vals, true).cells.map((c) => c.col)).toEqual([1, 1, 1, 1, 1, 1, 1, 0]);
    expect(calendarCells([], []).cols).toBe(0);
  });
  it("gauge angles clamp and place the reference marker", () => {
    const g = gaugeAngles(5, 10, 2.5);
    expect(g.a1 - g.a0).toBeCloseTo(Math.PI * 0.75);
    expect(g.aRef! - g.a0).toBeCloseTo(Math.PI * 0.375);
    expect(gaugeAngles(50, 10, null).a1).toBeCloseTo(gaugeAngles(10, 10, null).aEnd);
    expect(gaugeAngles(1, 0, null).a1).toBe(gaugeAngles(0, 5, null).a0);
  });
  it("stacks bucket by size and scale to the top", () => {
    expect(bucketStacks([[1, 0], [2, 1], [3, 1]], 2)).toEqual([[3, 1], [3, 1]]);
    expect(stackHeights([2, 3], 10)).toEqual([20, 30]);
    expect(stackHeights([2], 0)).toEqual([0]);
  });
  it("groups order statuses", () => {
    expect(["pending", "postponed", "confirmed", "shipped", "delivered", "cancelled", "refused", "returned"].map(statusGroup)).toEqual([
      "new", "new", "confirmed", "confirmed", "delivered", "lost", "lost", "lost",
    ]);
  });
});
