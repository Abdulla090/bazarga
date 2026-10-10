import { formatIQD } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
import type { BannerOffer } from "@/lib/merch";
import { CopyCode } from "./CopyCode";

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
  copy: string;
  copied: string;
};

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/**
 * The seller's advertised discount code (dashboard → Discounts → "Show on my store"): one quiet line, "10% off with
 * SAVE10", and a copy pill. The code is `select-all` so a long-press selects it whole for pasting at checkout; the
 * minimum order, when there is one, is the title tooltip and the screen-reader text.
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
  const min = offer.minSubtotal > 0 ? fill(labels.min, { amount: formatIQD(offer.minSubtotal, locale) }) : null;
  return (
    <aside aria-label={labels.label} className="flex min-w-0 items-center gap-3" data-testid="offer-banner">
      <p className="min-w-0 text-sm" title={min ?? undefined}>
        <span className="font-medium">
          {before}
          <bdi dir="ltr" className="num select-all font-semibold tracking-wide" data-testid="offer-code">
            {offer.code}
          </bdi>
          {after}
        </span>
        {min && <span className="sr-only"> · {min}</span>}
      </p>
      <CopyCode code={offer.code} label={labels.copy} done={labels.copied} />
    </aside>
  );
}
