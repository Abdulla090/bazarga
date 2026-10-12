import { areaPath, linePath, maxNice, scalePoints, donutArc, donutSlices } from "@/lib/chart-math";

/** Server-rendered SVG charts. Colors via classes (CSP-safe); no client JS. */
export function Sparkline({ values, rtl, label }: { values: number[]; rtl?: boolean; label: string }) {
  const w = 120, h = 32;
  const pts = scalePoints(values, w, h - 4, Math.max(1, ...values), !!rtl).map((p) => ({ x: p.x, y: p.y + 2 }));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <path d={areaPath(pts, h)} className="fill-[#2563EB]/10" />
      <path d={linePath(pts)} className="fill-none stroke-[#2563EB]" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function AreaChart({
  series,
  rtl,
  label,
  xLabels,
}: {
  series: { values: number[]; kind: "primary" | "secondary" }[];
  rtl?: boolean;
  label: string;
  xLabels: [string, string];
}) {
  const w = 640, h = 220;
  const top = maxNice(Math.max(1, ...series.flatMap((s) => s.values)));
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="grid gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label={label} preserveAspectRatio="none">
        <defs>
          <linearGradient id="an-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.28" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((g) => (
          <line key={g} x1={0} x2={w} y1={h - g * h} y2={h - g * h} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((s, i) => {
          const pts = scalePoints(s.values, w, h, top, !!rtl);
          return s.kind === "primary" ? (
            <g key={i}>
              <path d={areaPath(pts, h)} fill="url(#an-grad)" />
              <path d={linePath(pts)} className="fill-none stroke-[#2563EB]" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          ) : (
            <path key={i} d={linePath(pts)} className="fill-none stroke-ink-50" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-ink-50" aria-hidden="true">
        <span className="num">{xLabels[rtl ? 1 : 0]}</span>
        <span className="num">{xLabels[rtl ? 0 : 1]}</span>
      </div>
    </div>
  );
}

const DONUT = ["#2563EB", "#0B0F1A", "#60A5FA", "#64748B", "#CBD5E1", "#93C5FD", "#334155", "#E2E8F0"];
export function donutColor(i: number) { return DONUT[i % DONUT.length]!; }

export function Donut({ values, label }: { values: number[]; label: string }) {
  const sl = donutSlices(values);
  return (
    <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0" role="img" aria-label={label}>
      <circle cx={50} cy={50} r={38} className="fill-none stroke-line" strokeWidth={12} />
      {sl.map((s, i) => (s.a1 > s.a0 ? <path key={i} d={donutArc(50, 50, 38, s.a0, s.a1)} fill="none" stroke={donutColor(i)} strokeWidth={12} /> : null))}
    </svg>
  );
}
