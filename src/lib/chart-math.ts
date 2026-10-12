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
