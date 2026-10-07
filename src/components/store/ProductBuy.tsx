"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";
import { GALLERY_EVENT } from "./ProductGallery";
import { formatIQD } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
import { waLink } from "@/lib/whatsapp";
import { initialSelection, isValueAvailable, matchVariant, priceRange, type Selection } from "@/lib/variants";
import { Check, Icon, MessageCircle, Share2, ShoppingBag } from "@/components/ui/icons";

export type BuyOption = { id: string; name: string; values: { id: string; label: string; swatch: string | null }[] };
export type BuyVariant = {
  id: string;
  optionValueIds: string[];
  price: number;
  compareAtPrice: number | null;
  stock: number | null;
  imageId: string | null;
};
/** Pre-translated strings (the storefront ships no i18n runtime to the browser). `{x}` placeholders are filled here. */
export type BuyLabels = {
  addToCart: string;
  added: string;
  soldOut: string;
  buyNow: string;
  /** "Choose {option}" */
  choose: string;
  /** "Only {count} left" */
  onlyLeft: string;
  /** "From {price}" */
  from: string;
  askWhatsApp: string;
  share: string;
  linkCopied: string;
  /** First line of the WhatsApp message, e.g. "Hi Hawler Bazaar, I'd like to ask about:" */
  waIntro: string;
  unavailable: string;
};

export const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/**
 * Price, option pickers, add to cart / buy now, WhatsApp question and share — plus a sticky bottom bar on phones
 * that slides in once the inline buttons scroll out of view (respects the iOS home-indicator safe area).
 */
export function ProductBuy({
  slug,
  productId,
  name,
  basePrice,
  baseCompareAt,
  baseStock,
  options,
  variants,
  locale,
  whatsapp,
  shareUrl,
  labels,
}: {
  slug: string;
  productId: string;
  name: string;
  basePrice: number;
  baseCompareAt: number | null;
  baseStock: number | null;
  options: BuyOption[];
  variants: BuyVariant[];
  locale: Locale;
  whatsapp: string | null;
  shareUrl: string;
  labels: BuyLabels;
}) {
  const router = useRouter();
  const { add } = useCart(slug);
  const hasVariants = variants.length > 0;
  const [sel, setSel] = useState<Selection>(() => initialSelection(options));
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [inlineVisible, setInlineVisible] = useState(true);
  const inlineRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const optionIds = useMemo(() => options.map((o) => o.id), [options]);
  const variant = hasVariants ? matchVariant(optionIds, variants, sel) : null;
  const missing = hasVariants ? options.find((o) => !sel[o.id]) : undefined;
  const range = priceRange(variants, basePrice);

  const price = variant?.price ?? (hasVariants ? range.min : basePrice);
  const compareAt = variant ? variant.compareAtPrice : hasVariants ? null : baseCompareAt;
  const stock = hasVariants ? (variant ? variant.stock : null) : baseStock;
  const soldOut = hasVariants
    ? variant
      ? variant.stock !== null && variant.stock <= 0
      : variants.every((v) => v.stock !== null && v.stock <= 0)
    : baseStock !== null && baseStock <= 0;
  const priceText =
    hasVariants && !variant && range.min !== range.max ? fill(labels.from, { price: formatIQD(range.min, locale) }) : formatIQD(price, locale);

  useEffect(() => {
    const el = inlineRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInlineVisible(!!e?.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function pick(optionId: string, valueId: string) {
    const next = { ...sel, [optionId]: valueId };
    setSel(next);
    setNudge(false);
    const v = matchVariant(optionIds, variants, next);
    if (v?.imageId) window.dispatchEvent(new CustomEvent(GALLERY_EVENT, { detail: v.imageId }));
  }

  /** false (and points at the picker) while a required option is unpicked. */
  function ready(): boolean {
    if (!missing) return true;
    setNudge(true);
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function addToCart(): boolean {
    if (!ready() || soldOut) return false;
    add({ productId, variantId: variant?.id ?? null });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    return true;
  }

  function buyNow() {
    if (addToCart()) router.push(`/s/${slug}/cart`);
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url: shareUrl });
      } catch {
        /* dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(labels.share, shareUrl);
    }
  }

  const valueLabel = (id: string) => options.flatMap((o) => o.values).find((v) => v.id === id)?.label;
  const variantTitle = variant ? variant.optionValueIds.map(valueLabel).filter(Boolean).join(" / ") : "";
  const waHref = whatsapp
    ? waLink(whatsapp, [labels.waIntro, `${name}${variantTitle ? ` (${variantTitle})` : ""}`, formatIQD(price, locale), shareUrl].join("\n"))
    : null;

  const ctaLabel = soldOut
    ? labels.soldOut
    : missing && nudge
      ? fill(labels.choose, { option: missing.name })
      : added
        ? labels.added
        : labels.addToCart;

  const buttons = (compact: boolean) => (
    <div className={`grid grid-cols-2 gap-2 ${compact ? "flex-1" : ""}`}>
      <button type="button" onClick={addToCart} disabled={soldOut} className={`btn-ghost ${compact ? "btn-sm min-h-11 px-2" : ""}`}>
        {added && !compact && <Icon as={Check} />}
        <span className="truncate">{ctaLabel}</span>
      </button>
      <button type="button" onClick={buyNow} disabled={soldOut} className={`btn-gold ${compact ? "btn-sm min-h-11 px-2" : ""}`}>
        {!compact && <Icon as={ShoppingBag} />} <span className="truncate">{labels.buyNow}</span>
      </button>
    </div>
  );

  return (
    <>
      <div className="grid gap-4">
        <p className="num flex flex-wrap items-baseline gap-x-3 text-2xl" aria-live="polite">
          <span className="font-extrabold">{priceText}</span>
          {compareAt && compareAt > price && <s className="text-lg text-ink-50">{formatIQD(compareAt, locale)}</s>}
        </p>

        {options.length > 0 && (
          <div ref={pickerRef} className="grid scroll-mt-24 gap-4">
            {options.map((o) => (
              <fieldset key={o.id}>
                <legend className="mb-2 text-sm font-bold">
                  {o.name}
                  {sel[o.id] && <span className="ms-2 font-semibold text-ink-70">{valueLabel(sel[o.id]!)}</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((v) => {
                    const ok = isValueAvailable(variants, sel, o.id, v.id);
                    const on = sel[o.id] === v.id;
                    return v.swatch ? (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={ok ? v.label : `${v.label} · ${labels.unavailable}`}
                        title={v.label}
                        disabled={!ok}
                        onClick={() => pick(o.id, v.id)}
                        className={`relative h-11 w-11 rounded-full border-2 p-0.5 ${on ? "border-ink" : "border-line"} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        <span className="block h-full w-full rounded-full" style={{ background: v.swatch }} />
                        {!ok && <span aria-hidden className="absolute inset-x-1 top-1/2 h-0.5 -rotate-45 bg-ink" />}
                      </button>
                    ) : (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={ok ? undefined : `${v.label} · ${labels.unavailable}`}
                        disabled={!ok}
                        onClick={() => pick(o.id, v.id)}
                        className={`num min-h-11 min-w-12 rounded-xl border-2 px-3 font-bold transition ${
                          on ? "border-ink bg-ink text-paper" : "border-line bg-white"
                        } disabled:cursor-not-allowed disabled:text-ink-50 disabled:line-through disabled:opacity-60`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {nudge && missing && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {fill(labels.choose, { option: missing.name })}
              </p>
            )}
          </div>
        )}

        {!soldOut && stock !== null && stock > 0 && stock <= 5 && (
          <p className="font-semibold text-danger">{fill(labels.onlyLeft, { count: stock })}</p>
        )}

        <div ref={inlineRef}>{buttons(false)}</div>

        <div className="flex flex-wrap gap-2">
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-sm flex-1 bg-whatsapp text-[#0b3d1f] hover:brightness-95">
              <Icon as={MessageCircle} /> {labels.askWhatsApp}
            </a>
          )}
          <button type="button" onClick={share} className="btn-ghost btn-sm flex-1">
            <Icon as={copied ? Check : Share2} /> <span aria-live="polite">{copied ? labels.linkCopied : labels.share}</span>
          </button>
        </div>
      </div>

      {/* Phones: sticky buy bar once the inline buttons are off screen. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-2 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur transition-transform duration-200 md:hidden ${
          inlineVisible ? "translate-y-full" : "translate-y-0"
        }`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-hidden={inlineVisible || undefined}
        inert={inlineVisible || undefined}
        data-testid="buy-bar"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 max-w-[34%]">
            <p className="hidden truncate text-xs text-ink-70 min-[400px]:block">{variantTitle || name}</p>
            <p className="num truncate text-sm font-extrabold min-[400px]:text-base">{priceText}</p>
          </div>
          {buttons(true)}
        </div>
      </div>
    </>
  );
}
