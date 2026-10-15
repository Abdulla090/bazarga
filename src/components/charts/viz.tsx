import { calendarCells, donutArc, funnelRows, gaugeAngles, heatLevel, stackHeights } from "@/lib/chart-math";

/**
 * Server-rendered analytics visuals — HTML grids and inline SVG only, no chart library, no client JS.
 * Colours are fixed hex values (blue ramp + ink/greys) so they never follow a seller's storefront theme.
 * Hover tooltips are native `title` attributes; every visual has an aria-label or a visually hidden table.
 * Layout flows with the page direction, so RTL mirrors automatically (oldest on the right).
 */

/** Neutral → deep blue, 5 levels (0 = nothing). */
export const BLUE_RAMP = ["bg-[#EEF1F6]", "bg-[#DBEAFE]", "bg-[#93C5FD]", "bg-[#3B82F6]", "bg-[#1D4ED8]"] as const;
const FUNNEL_FILL = ["#1D4ED8", "#2563EB", "#60A5FA", "#BFDBFE"];

/* ───────── stepped funnel ───────── */

export type FunnelStepView = { key: string; label: string; count: number; countLabel: string; pctLabel: string | null; dropLabel: string | null };

export function FunnelChart({ steps, label, rowPx = 64 }: { steps: FunnelStepView[]; label: string; rowPx?: number }) {
  const rows = funnelRows(steps.map((s) => s.count));
  const h = rows.length * rowPx;
  return (
    <div className="grid grid-cols-[38%_minmax(0,1fr)] items-start gap-3">
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const y0 = i * rowPx + 1;
          const y1 = (i + 1) * rowPx - 1;
          const pts = `${50 - r.from / 2},${y0} ${50 + r.from / 2},${y0} ${50 + r.to / 2},${y1} ${50 - r.to / 2},${y1}`;
          return <polygon key={steps[i]!.key} points={pts} fill={FUNNEL_FILL[i % FUNNEL_FILL.length]} />;
        })}
      </svg>
      <ol className="grid min-w-0">
        {steps.map((s, i) => (
          <li key={s.key} className="flex min-w-0 flex-col justify-center" style={{ height: rowPx }} data-funnel={s.key}>
            <span className="truncate text-sm font-semibold">{s.label}</span>
            <span className="num flex flex-wrap items-baseline gap-x-2 text-sm text-ink-70" dir="ltr">
              <b className="text-base font-extrabold text-ink">{s.countLabel}</b>
              {s.pctLabel && <span>{s.pctLabel}</span>}
              {i > 0 && s.dropLabel && <span className="text-ink-50">↓ {s.dropLabel}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ───────── weekday × hour heatmap ───────── */

export function Heatmap({
  matrix,
  rowLabels,
  hourTicks,
  label,
  cellTitle,
}: {
  matrix: number[][];
  rowLabels: string[];
  /** [hour, text] pairs shown under the grid, e.g. [0,"0"],[6,"6"]… */
  hourTicks: [number, string][];
  label: string;
  cellTitle: (row: number, hour: number, n: number) => string;
}) {
  const max = Math.max(0, ...matrix.flat());
  return (
    <div className="grid gap-2" role="img" aria-label={label}>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
        <div className="grid grid-rows-7 gap-[3px] text-xs text-ink-50" aria-hidden="true">
          {rowLabels.map((l) => (
            <span key={l} className="flex h-6 items-center truncate">{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]" aria-hidden="true">
          {matrix.flatMap((row, r) =>
            row.map((n, h) => <span key={`${r}-${h}`} className={`h-6 rounded-[4px] ${BLUE_RAMP[heatLevel(n, max)]}`} title={cellTitle(r, h, n)} />),
          )}
        </div>
      </div>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2" aria-hidden="true">
        <span />
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-[11px] text-ink-50">
          {hourTicks.map(([h, t]) => (
            <span key={h} className="num whitespace-nowrap" style={{ gridColumn: `${h + 1} / span 3` }} dir="ltr">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────── radial gauge ───────── */

export function Gauge({
  value,
  max,
  prev: refValue,
  label,
  center,
  caption,
}: {
  value: number;
  max: number;
  prev?: number | null;
  label: string;
  center: string;
  caption?: string;
}) {
  const g = gaugeAngles(value, max, refValue ?? null);
  const [cx, cy, r] = [60, 60, 46];
  const pt = (a: number, rr: number) => `${cx + rr * Math.sin(a)} ${cy - rr * Math.cos(a)}`;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={label}>
        <path d={donutArc(cx, cy, r, g.a0, g.aEnd)} className="fill-none stroke-[#E3E8F0]" strokeWidth={9} strokeLinecap="round" />
        {g.a1 > g.a0 && <path d={donutArc(cx, cy, r, g.a0, g.a1)} className="fill-none stroke-[#2563EB]" strokeWidth={9} strokeLinecap="round" />}
        {g.aRef !== null && (
          <path d={`M${pt(g.aRef, r - 9)}L${pt(g.aRef, r + 9)}`} className="stroke-ink" strokeWidth={2} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="num text-3xl font-extrabold leading-none" dir="ltr">{center}</span>
        {caption && <span className="mt-1 text-xs text-ink-50">{caption}</span>}
      </div>
    </div>
  );
}

/* ───────── stacked columns ───────── */

export type StackSeries = { key: string; label: string; bar: string; dot: string };

export function StackedColumns({
  columns,
  series,
  label,
  captions,
}: {
  /** One entry per column: segment values in `series` order and a tooltip text. */
  columns: { values: number[]; title: string }[];
  series: StackSeries[];
  label: string;
  captions: [string, string];
}) {
  const top = Math.max(1, ...columns.map((c) => c.values.reduce((a, b) => a + b, 0)));
  return (
    <figure className="grid gap-2" role="img" aria-label={label}>
      <div className="flex h-44 items-end gap-[3px] border-b border-line" aria-hidden="true">
        {columns.map((c, i) => {
          const hs = stackHeights(c.values, top);
          return (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col-reverse gap-px" title={c.title}>
              {c.values.map((v, j) =>
                v > 0 ? <span key={series[j]!.key} className={`block w-full first:rounded-b-[2px] last:rounded-t-[3px] ${series[j]!.bar}`} style={{ height: `${Math.max(hs[j]!, 2)}%` }} /> : null,
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-ink-50" aria-hidden="true">
        <span className="num">{captions[0]}</span>
        <span className="num">{captions[1]}</span>
      </div>
    </figure>
  );
}

export function Legend({ items }: { items: { key: string; label: string; dot: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((s) => (
        <li key={s.key} className="inline-flex min-h-6 items-center gap-1.5 text-ink-70">
          <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
          {s.label}
          {s.value !== undefined && <b className="num font-bold text-ink" dir="ltr">{s.value}</b>}
        </li>
      ))}
    </ul>
  );
}

/* ───────── 90-day calendar strip ───────── */

export function CalendarStrip({
  days,
  values,
  label,
  cellTitle,
  lessMore,
}: {
  days: string[];
  values: number[];
  label: string;
  cellTitle: (day: string, v: number) => string;
  lessMore: [string, string];
}) {
  const { cells, cols } = calendarCells(days, values);
  return (
    <div className="grid gap-2" role="img" aria-label={label}>
      <div
        className="grid grid-rows-[repeat(7,minmax(0,1fr))] gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {cells.map((c) => (
          <span key={c.day} className={`h-5 rounded-[4px] ${BLUE_RAMP[c.level]}`} style={{ gridColumn: c.col + 1, gridRow: c.row + 1 }} title={cellTitle(c.day, c.value)} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-xs text-ink-50" aria-hidden="true">
        <span>{lessMore[0]}</span>
        {BLUE_RAMP.map((c) => (
          <span key={c} className={`size-3 rounded-[3px] ${c}`} />
        ))}
        <span>{lessMore[1]}</span>
      </div>
    </div>
  );
}

/* ───────── ranked horizontal bars with thumbnails ───────── */

export type RankItem = { id: string; name: string; value: number; valueLabel: string; sub?: string; thumb?: string };

export function RankedBars({ items, testId }: { items: RankItem[]; testId?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="grid gap-3" data-testid={testId}>
      {items.map((it, idx) => (
        <li key={it.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
          {it.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.thumb} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-10 rounded-lg bg-line object-cover" />
          ) : (
            <span className="num grid size-10 place-content-center rounded-lg bg-[#EEF1F6] text-sm font-bold text-ink-50" aria-hidden="true">{idx + 1}</span>
          )}
          <div className="grid min-w-0 gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold">{it.name}</span>
              <span className="num shrink-0 text-sm text-ink-70" dir="ltr">{it.valueLabel}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#E3E8F0]" aria-hidden="true">
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.max(3, Math.round((it.value / max) * 100))}%` }} />
            </div>
            {it.sub && <span className="num text-xs text-ink-50" dir="ltr">{it.sub}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────── orders by source (docs/SOCIAL-FIRST.md S4) ───────── */

export type SourceBarRow = { key: string; label: string; color: string; orders: number; ordersLabel: string; share: string; convLabel: string; visitsLabel: string };

/**
 * One SVG per platform row: an orders bar (blue/ink by platform) on a soft track, sized to the busiest platform.
 * Labels live in HTML around the SVG so text never scales with the viewBox; the whole list has an aria-label and every
 * row a native `title` tooltip. Bars grow from the reading start (right in RTL) via the flex direction.
 */
export function SourceBars({ rows, label, convHeader, ordersHeader }: { rows: SourceBarRow[]; label: string; convHeader: string; ordersHeader: string }) {
  const max = Math.max(1, ...rows.map((r) => r.orders));
  return (
    <div className="grid gap-1" role="group" aria-label={label}>
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_3.75rem] items-end gap-3 pb-1 text-xs font-semibold text-ink-50">
        <span />
        <span>{ordersHeader}</span>
        <span className="text-end">{convHeader}</span>
      </div>
      <ol className="grid gap-2.5" data-testid="source-bars">
        {rows.map((r) => {
          const w = r.orders > 0 ? Math.max(2, (r.orders / max) * 100) : 0;
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_3.75rem] items-center gap-3" data-source={r.key} title={`${r.label} · ${r.ordersLabel} · ${r.share} · ${r.convLabel}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                <span className="truncate text-sm font-semibold">{r.label}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-3 min-w-0 flex-1 overflow-hidden rounded-full rtl:-scale-x-100" aria-hidden="true">
                  <rect x="0" y="0" width="100" height="10" fill="#EEF1F6" />
                  {w > 0 && <rect x="0" y="0" width={w} height="10" fill={r.color} />}
                </svg>
                <span className="num w-[4.5rem] shrink-0 text-sm text-ink-70" dir="ltr">
                  <b className="font-extrabold text-ink">{r.ordersLabel}</b> <span className="text-ink-50">{r.share}</span>
                </span>
              </span>
              <span className="num text-end text-sm font-semibold" dir="ltr" title={r.visitsLabel}>{r.convLabel}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
