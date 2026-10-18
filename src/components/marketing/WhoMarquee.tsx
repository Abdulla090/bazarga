import { rv, Words } from "./reveal";
import { Baby, Book, Cake, Droplet, Gem, Icon, Perfume, Plant, Scissors, Shirt, Smartphone, Sofa, Sparkles, type LucideIcon } from "@/components/ui/icons";

export type WhoLabels = { eyebrow: string; title: string; lead: string; cats: string[] };

const ICONS: LucideIcon[] = [Shirt, Sparkles, Droplet, Scissors, Smartphone, Gem, Sofa, Baby, Cake, Perfume, Book, Plant];

/**
 * "Who it's for": blue/ink only. Two hairline chip rows drifting in opposite directions (CSS marquee, edge-faded,
 * direction-aware for RTL, paused on hover). The first copy of each row is the real list; three aria-hidden copies fill
 * the loop (two identical halves, each wider than the viewport, so translate ±50% is seamless). Reduced motion: no drift, the rows wrap and the filler is hidden.
 */
export function WhoMarquee({ l }: { l: WhoLabels }) {
  const items = l.cats.map((label, i) => ({ label, icon: ICONS[i % ICONS.length] ?? Sparkles }));
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];
  return (
    <section className="who-band" aria-labelledby="who-title">
      <div className="container-page">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <div className="max-w-xl">
            <p className="mk-eyebrow" {...rv("e")}>{l.eyebrow}</p>
            <h2 id="who-title" className="mt-3 text-[2rem] font-light leading-[1.1] tracking-tight text-balance sm:text-[2.75rem]" {...rv("h", 60)}><Words text={l.title} /></h2>
          </div>
          <p className="max-w-sm text-pretty text-ink-70 sm:pb-1.5" {...rv("t", 220)}>{l.lead}</p>
        </div>
      </div>
      <div className="who-rows mt-9 sm:mt-11" {...rv("t", 320)}>
        {rows.map((row, r) => (
          <div key={r} className="marquee" data-reverse={r === 1 || undefined}>
            <ul className="marquee-track">
              {[0, 1, 2, 3].map((copy) =>
                row.map((it) => (
                  <li key={`${copy}-${it.label}`} className="who-chip" aria-hidden={copy > 0 || undefined} data-copy={copy}>
                    <span className="who-ico"><Icon as={it.icon} /></span>
                    {it.label}
                  </li>
                )),
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
