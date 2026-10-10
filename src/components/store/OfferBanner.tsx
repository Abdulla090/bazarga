import { formatIQD } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
import type { BannerOffer } from "@/lib/merch";
import { Icon, TicketPercent } from "@/components/ui/icons";

export type OfferBannerLabels = {
  /** "{pct}% off with code {code}" */
  percent: string;
  /** "{amount} off with code {code}" */
  fixed: string;
  /** "Free delivery with code {code}" */
  freeDelivery: string;
  /** "On orders over {amount}" */
  min: string;
  howTo: string;
  label: string;
};

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/**
 * The seller's advertised discount code (dashboard → Discounts → "Show on my store"). Server-rendered; the code is
 * `select-all` so a long-press selects it whole for pasting at checkout.
 */
export function OfferBanner({ offer, locale, labels }: { offer: BannerOffer; locale: Locale; labels: OfferBannerLabels }) {
  const code = `\u2066${offer.code}\u2069`; // LTR-isolated inside RTL sentences
  const headline =
    offer.type === "percentage"
      ? fill(labels.percent, { pct: offer.value, code })
      : offer.type === "fixed"
        ? fill(labels.fixed, { amount: formatIQD(offer.value, locale), code })
        : fill(labels.freeDelivery, { code });
  const [before, after] = headline.split(code);
  return (
    <aside
      aria-label={labels.label}
      className="flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-st-border bg-st-surface p-3 text-st-fg shadow-sm"
      data-testid="offer-banner"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-st-accent text-st-on-accent">
        <Icon as={TicketPercent} className="h-5 w-5" />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="font-extrabold leading-snug">
          {before}
          <bdi dir="ltr" className="num mx-0.5 inline-block select-all break-all rounded-md bg-st-bg px-1.5 py-0.5 font-mono font-extrabold tracking-wider ring-1 ring-st-border" data-testid="offer-code">
            {offer.code}
          </bdi>
          {after}
        </span>
        <span className="text-sm text-st-muted">
          {offer.minSubtotal > 0 ? `${fill(labels.min, { amount: formatIQD(offer.minSubtotal, locale) })} · ` : ""}
          {labels.howTo}
        </span>
      </span>
    </aside>
  );
}
