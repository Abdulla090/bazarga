import { visibleStats, type LiveStats as Stats, type StatKey } from "@/lib/live-stats";

export type LiveStatsLabels = { eyebrow: string; title: string; note: string; labels: Record<StatKey, string> };

/** Real-number band (docs/DEMAND.md D2). Renders nothing until at least two counters clear their floor. */
export function LiveStats({ stats, l, locale }: { stats: Stats | null; l: LiveStatsLabels; locale: string }) {
  const items = visibleStats(stats);
  if (items.length === 0) return null;
  const fmt = new Intl.NumberFormat(locale === "en" ? "en-US" : `${locale === "ku" ? "ckb" : locale}-u-nu-latn`);
  return (
    <section className="stats-band" aria-labelledby="stats-title">
      <div className="container-page">
        <p className="mk-eyebrow">{l.eyebrow}</p>
        <h2 id="stats-title" className="mt-3 text-[1.75rem] font-light leading-[1.15] tracking-tight text-balance sm:text-[2.25rem]">{l.title}</h2>
        <dl className="stats-grid">
          {items.map((s) => (
            <div key={s.key} className="stat">
              <dt className="stat-label">{l.labels[s.key]}</dt>
              <dd className="stat-num num"><bdi dir="ltr">{fmt.format(s.value)}</bdi></dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-ink-70">{l.note}</p>
      </div>
    </section>
  );
}
