/** Pure chart math for the server-rendered SVG charts (no deps). */
export type Pt = { x: number; y: number };

export function maxNice(max: number): number {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

/** Map values to points inside w×h (y flipped). `flip` mirrors x for RTL. */
export function scalePoints(values: number[], w: number, h: number, top: number, flip = false): Pt[] {
  const n = values.length;
  return values.map((v, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = (flip ? 1 - t : t) * w;
    const y = top <= 0 ? h : h - (Math.max(0, v) / top) * h;
    return { x: round(x), y: round(y) };
  });
}

const round = (n: number) => Math.round(n * 100) / 100;

export function linePath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");
}

export function areaPath(pts: Pt[], h: number): string {
  if (!pts.length) return "";
  const a = [...pts].sort((p, q) => p.x - q.x);
  return `${linePath(a)}L${a[a.length - 1]!.x} ${h}L${a[0]!.x} ${h}Z`;
}

/** Percent change vs previous period; null when there is no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** SVG arc path for a donut slice (angles in radians from 12 o'clock). */
export function donutArc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const f = Math.min(a1 - a0, Math.PI * 2 - 0.0001);
  const e = a0 + f;
  const p = (a: number) => `${round(cx + r * Math.sin(a))} ${round(cy - r * Math.cos(a))}`;
  return `M${p(a0)}A${r} ${r} 0 ${f > Math.PI ? 1 : 0} 1 ${p(e)}`;
}

export function donutSlices(values: number[]): { a0: number; a1: number }[] {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  let acc = 0;
  return values.map((v) => {
    const a0 = total ? (acc / total) * Math.PI * 2 : 0;
    acc += Math.max(0, v);
    return { a0, a1: total ? (acc / total) * Math.PI * 2 : 0 };
  });
}

/* ───────── funnel ───────── */

export type FunnelRow = { count: number; pctOfFirst: number; dropPct: number | null; from: number; to: number };

/**
 * Stepped funnel geometry. `from`/`to` are the top/bottom widths (0–100, centred) of each step's trapezoid so the
 * shape narrows smoothly into the next step; `dropPct` is the share lost since the previous step.
 */
export function funnelRows(counts: number[], floor = 8): FunnelRow[] {
  const first = counts[0] ?? 0;
  const w = (c: number) => (first <= 0 ? floor : Math.max(floor, Math.min(100, (c / first) * 100)));
  return counts.map((count, i) => {
    const prev = i > 0 ? counts[i - 1]! : null;
    const next = i < counts.length - 1 ? counts[i + 1]! : count;
    return {
      count,
      pctOfFirst: first > 0 ? Math.round((count / first) * 1000) / 10 : 0,
      dropPct: prev !== null && prev > 0 ? Math.max(0, Math.round((1 - count / prev) * 1000) / 10) : null,
      from: round(w(count)),
      to: round(w(next)),
    };
  });
}

/* ───────── heat levels (heatmap + calendar) ───────── */

/** 0 = nothing, 1–4 = quartiles of the maximum. */
export function heatLevel(v: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (v <= 0 || max <= 0) return 0;
  const r = v / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

/** Iraqi week runs Saturday → Friday. Row 0 = Saturday for JS weekday numbers (0 = Sunday). */
export function iraqWeekRow(dow: number): number {
  return (dow + 1) % 7;
}

/** Orders by weekday × hour → 7×24 matrix (rows Saturday-first). Input rows use JS dow (0 = Sunday). */
export function heatMatrix(rows: { dow: number; hour: number; n: number }[]): number[][] {
  const m = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of rows) {
    if (r.dow < 0 || r.dow > 6 || r.hour < 0 || r.hour > 23) continue;
    m[iraqWeekRow(r.dow)]![r.hour]! += r.n;
  }
  return m;
}

export type CalCell = { day: string; value: number; col: number; row: number; level: 0 | 1 | 2 | 3 | 4 };

/** Contribution-calendar cells: one column per week (Saturday-first), one row per weekday. `flip` mirrors for RTL. */
export function calendarCells(days: string[], values: number[], flip = false): { cells: CalCell[]; cols: number } {
  if (!days.length) return { cells: [], cols: 0 };
  const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
  const offset = iraqWeekRow(dow(days[0]!));
  const cols = Math.ceil((offset + days.length) / 7);
  const max = Math.max(0, ...values);
  const cells = days.map((day, i) => {
    const col = Math.floor((offset + i) / 7);
    return { day, value: values[i] ?? 0, col: flip ? cols - 1 - col : col, row: iraqWeekRow(dow(day)), level: heatLevel(values[i] ?? 0, max) };
  });
  return { cells, cols };
}

/* ───────── gauge ───────── */

const GAUGE_START = -Math.PI * 0.75;
const GAUGE_SWEEP = Math.PI * 1.5;

/** Angles of a 270° gauge for a value on 0…max, plus the marker angle of a reference value. */
export function gaugeAngles(value: number, max: number, ref: number | null): { a0: number; a1: number; aEnd: number; aRef: number | null } {
  const f = (v: number) => GAUGE_START + GAUGE_SWEEP * Math.min(1, Math.max(0, max > 0 ? v / max : 0));
  return { a0: GAUGE_START, a1: f(value), aEnd: GAUGE_START + GAUGE_SWEEP, aRef: ref === null ? null : f(ref) };
}

/* ───────── stacked columns ───────── */

/** Sum consecutive days into buckets of `size` (last bucket may be shorter); each day is a vector of series values. */
export function bucketStacks(perDay: number[][], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < perDay.length; i += size) {
    const chunk = perDay.slice(i, i + size);
    const k = chunk[0]?.length ?? 0;
    out.push(Array.from({ length: k }, (_, j) => chunk.reduce((a, d) => a + (d[j] ?? 0), 0)));
  }
  return out;
}

/** Heights (0–100) of stacked segments inside a column scaled to `top`. */
export function stackHeights(seg: number[], top: number): number[] {
  return seg.map((v) => (top > 0 ? round((Math.max(0, v) / top) * 100) : 0));
}

/** Order status → the four groups the stacked chart shows. */
export type StatusGroup = "new" | "confirmed" | "delivered" | "lost";
export const STATUS_GROUPS: readonly StatusGroup[] = ["new", "confirmed", "delivered", "lost"];
export function statusGroup(status: string): StatusGroup {
  switch (status) {
    case "pending":
    case "postponed":
      return "new";
    case "confirmed":
    case "shipped":
      return "confirmed";
    case "delivered":
      return "delivered";
    default:
      return "lost";
  }
}
