import Link from "next/link";
import { ArrowForward, Check, Icon, MapPin, Smartphone, Users, X } from "@/components/ui/icons";

export type DvbLabels = {
  eyebrow: string; title: string; lead: string;
  dmTitle: string; dmBubble: string; dmUnread: string; dms: string[];
  bzTitle: string; bzs: string[];
  orderLabel: string; orderFrom: string; orderName: string; orderCity: string; cod: string; cta: string;
};

/**
 * Landing "DMs vs Bazarga" (docs/SOCIAL-FIRST.md S1): sellers already get buyers from TikTok / Instagram; the chat is
 * where orders get lost. Left: the DM inbox (lost messages, endless "how much?"). Right: one bio link, structured COD
 * order, source shown. Server component, no JS; blue + ink only; motion is CSS and off under reduced motion.
 */
export function DmsVsBazarga({ l }: { l: DvbLabels }) {
  return (
    <section id="dms" className="dvb-band scroll-mt-20" aria-labelledby="dvb-title" data-testid="dms-vs-bazarga">
      <div className="container-page">
        <p className="mk-eyebrow">{l.eyebrow}</p>
        <h2 id="dvb-title" className="mt-3 max-w-3xl text-[2rem] font-light leading-[1.1] tracking-tight text-balance sm:text-[2.75rem]">{l.title}</h2>
        <p className="mt-4 max-w-xl text-pretty text-ink-70 sm:text-lg">{l.lead}</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
          {/* The DM inbox */}
          <article className="dvb-card dvb-dm" aria-labelledby="dvb-dm-title" data-testid="dvb-dm">
            <header className="flex items-center justify-between gap-3">
              <h3 id="dvb-dm-title" className="text-lg font-bold">{l.dmTitle}</h3>
              <span className="dvb-unread"><b className="num" dir="ltr">47</b> {l.dmUnread}</span>
            </header>
            <div className="dvb-chat" aria-hidden="true">
              {["A", "S", "R", "H"].map((who, i) => (
                <div key={who} className="dvb-msg" style={{ ["--i" as string]: i }}>
                  <span className="dvb-avatar">{who}</span>
                  <span className="dvb-bubble">{l.dmBubble}</span>
                  {i === 3 && <span className="dvb-seen">· · ·</span>}
                </div>
              ))}
            </div>
            <ul className="mt-5 grid gap-2.5">
              {l.dms.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <span className="dvb-mark dvb-mark-x"><Icon as={X} size="0.9rem" strokeWidth={2.2} /></span>
                  <span className="min-w-0 text-ink-70">{d}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Bazarga */}
          <article className="dvb-card dvb-bz" aria-labelledby="dvb-bz-title" data-testid="dvb-bz">
            <header className="flex items-center justify-between gap-3">
              <h3 id="dvb-bz-title" className="text-lg font-bold text-white">{l.bzTitle}</h3>
              <span className="dvb-live" aria-hidden="true"><span className="dvb-live-dot" />bazarga.app/s/…</span>
            </header>
            <div className="dvb-order" aria-hidden="true">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{l.orderLabel}</span>
                <span className="dvb-src"><span className="dvb-src-dot" />{l.orderFrom}</span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt className="dvb-k"><Icon as={Users} size="0.95rem" /></dt><dd className="min-w-0 truncate font-semibold text-ink">{l.orderName}</dd>
                <dt className="dvb-k"><Icon as={Smartphone} size="0.95rem" /></dt><dd className="num min-w-0 truncate text-ink-70"><span dir="ltr">0750 ••• 12 34</span></dd>
                <dt className="dvb-k"><Icon as={MapPin} size="0.95rem" /></dt><dd className="min-w-0 truncate text-ink-70">{l.orderCity}</dd>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="dvb-cod">{l.cod}</span>
                <span className="num text-sm font-extrabold text-ink" dir="ltr">85,000 IQD</span>
              </div>
            </div>
            <ul className="mt-5 grid gap-2.5">
              {l.bzs.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <span className="dvb-mark dvb-mark-ok"><Icon as={Check} size="0.9rem" strokeWidth={2.4} /></span>
                  <span className="min-w-0 text-white/85">{d}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="dvb-cta group mt-6" data-testid="dvb-cta">
              {l.cta}
              <ArrowForward className="text-base transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
