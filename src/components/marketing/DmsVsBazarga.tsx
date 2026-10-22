import Link from "next/link";
import { ArrowForward, Check, Icon, X } from "@/components/ui/icons";
import { rv, Words } from "./reveal";

export type DvbLabels = {
  eyebrow: string; title: string;
  dmTitle: string; dms: string[];
  bzTitle: string; bzs: string[];
  cta: string;
};

/**
 * Landing "DMs vs Reelcart" (docs/SOCIAL-FIRST.md S1), Oct 18 rework: one tight headline and a minimal side-by-side.
 * Left: what selling in the DMs costs (muted, ×). Right: the same four things on Reelcart (blue ✓), row for row.
 * Rows are 3-5 words, no paragraphs. Server component, no JS; blue + ink only.
 */
export function DmsVsBazarga({ l }: { l: DvbLabels }) {
  return (
    <section id="dms" className="dvb-band scroll-mt-20" aria-labelledby="dvb-title" data-testid="dms-vs-bazarga">
      <div className="container-page">
        <div className="dvb-head">
          <p className="mk-eyebrow" {...rv("e")}>{l.eyebrow}</p>
          <h2 id="dvb-title" className="dvb-title" {...rv("h", 80)}><Words text={l.title} /></h2>
        </div>

        <div className="dvb-grid" {...rv("c", 120)}>
          <div className="dvb-col dvb-col-dm" data-testid="dvb-dm">
            <h3 className="dvb-col-title">
              <span className="dvb-ic dvb-ic-x" aria-hidden="true"><Icon as={X} size="0.85rem" strokeWidth={2.2} /></span>
              {l.dmTitle}
            </h3>
            <ul className="dvb-rows">
              {l.dms.map((d, i) => (
                <li key={i} className="dvb-row" {...rv("e", 260 + i * 70)}>
                  <span className="dvb-ic dvb-ic-x" aria-hidden="true"><Icon as={X} size="0.85rem" strokeWidth={2.2} /></span>
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="dvb-col dvb-col-bz" data-testid="dvb-bz">
            <h3 className="dvb-col-title">
              <span className="dvb-ic dvb-ic-ok" aria-hidden="true"><Icon as={Check} size="0.85rem" strokeWidth={2.6} /></span>
              {l.bzTitle}
            </h3>
            <ul className="dvb-rows">
              {l.bzs.map((d, i) => (
                <li key={i} className="dvb-row" {...rv("e", 380 + i * 90)}>
                  <span className="dvb-ic dvb-ic-ok" aria-hidden="true"><Icon as={Check} size="0.85rem" strokeWidth={2.6} /></span>
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="dvb-foot" {...rv("t", 200)}>
          <Link href="/signup" className="dvb-cta group" data-testid="dvb-cta">
            {l.cta}
            <ArrowForward className="text-base transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
