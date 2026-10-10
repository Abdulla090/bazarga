"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";
import { GALLERY_EVENT } from "./ProductGallery";
import { formatIQD } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
import { waLink } from "@/lib/whatsapp";
import { WaTap } from "./WaTap";
import { initialSelection, isValueAvailable, matchVariant, priceRange, type Selection } from "@/lib/variants";
import { percentOff, stockStatus } from "@/lib/product-page";
import { Check, Icon, MessageCircle, Share2 } from "@/components/ui/icons";

export type BuyOption = { id: string; name: string; values: { id: string; label: string; swatch: string | null }[] };
export type BuyVariant = {
  id: string;
  optionValueIds: string[];
  sku: string | null;
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
  /** First line of the WhatsApp message, e.g. "Hi Studio Hawler, I'd like to ask about:" */
  waIntro: string;
  unavailable: string;
  inStock: string;
  soldOutStatus: string;
  skuLabel: string;
  quantity: string;
  decrease: string;
  increase: string;
  /** "{pct}% off" */
  percentOff: string;
};

const MAX_QTY = 99;

export const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/**
 * Product info block in shopping order: title → price (sale + % off) → `info` (short description, server-rendered)
 * → option pickers → stock → quantity → add to cart / buy now, WhatsApp question and share — plus a sticky bottom
 * bar on phones that slides in once the inline buttons scroll out of view (respects the iOS home-indicator safe area).
 * Price, add to cart / buy now, WhatsApp question and share — plus a sticky bottom bar on phones
 * that slides in once the inline buttons scroll out of view (respects the iOS home-indicator safe area).
 */
export function ProductBuy({
  slug,
  productId,
  name,
  basePrice,
  baseCompareAt,
  baseStock,
  sku,
  options,
  variants,
  locale,
  whatsapp,
  shareUrl,
  labels,
  title,
  info,
}: {
  slug: string;
  productId: string;
  name: string;
  basePrice: number;
  baseCompareAt: number | null;
  baseStock: number | null;
  sku: string | null;
  options: BuyOption[];
  variants: BuyVariant[];
  locale: Locale;
  whatsapp: string | null;
  shareUrl: string;
  labels: BuyLabels;
  /** Product name heading (server-rendered). */
  title?: ReactNode;
  /** Short description etc., shown right under the price and before the option pickers. */
  info?: ReactNode;
}) {
  const router = useRouter();
  const { add } = useCart(slug);
  const hasVariants = variants.length > 0;
  const [sel, setSel] = useState<Selection>(() => initialSelection(options));
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [qty, setQty] = useState(1);
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
  const pct = percentOff(price, compareAt);
  const status = stockStatus(stock, soldOut);
  const maxQty = stock !== null && stock > 0 ? Math.min(MAX_QTY, stock) : MAX_QTY;
  const shownSku = variant?.sku ?? (hasVariants ? null : sku);
  const priceText =
    hasVariants && !variant && range.min !== range.max ? fill(labels.from, { price: formatIQD(range.min, locale) }) : formatIQD(price, locale);

  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    // The bar shows only once the inline buttons have scrolled out ABOVE the viewport (never while they are still
    // below it). A rAF-throttled scroll check, because an IntersectionObserver misses jumps straight past them.
    let raf = 0;
    const check = () => {
      raf = 0;
      setInlineVisible(el.getBoundingClientRect().bottom > 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // While the phone buy bar is up, the storefront gets bottom padding (globals.css) so it never covers content.
  useEffect(() => {
    const root = document.documentElement;
    if (inlineVisible) root.removeAttribute("data-buybar");
    else root.setAttribute("data-buybar", "");
    return () => root.removeAttribute("data-buybar");
  }, [inlineVisible]);

  function pick(optionId: string, valueId: string) {
    const next = { ...sel, [optionId]: valueId };
    setSel(next);
    setNudge(false);
    setQty(1);
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
    add({ productId, variantId: variant?.id ?? null }, Math.min(qty, maxQty));
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
    <div className={compact ? "grid flex-1 grid-cols-2 gap-2" : "grid gap-2"}>
      <button type="button" onClick={addToCart} disabled={soldOut} className={`btn-ghost ${compact ? "btn-sm min-h-11 px-2" : "min-h-12 w-full"}`} data-testid={compact ? undefined : "buy-add"}>
        {added && !compact && <Icon as={Check} />}
        <span className="truncate">{ctaLabel}</span>
      </button>
      <button type="button" onClick={buyNow} disabled={soldOut} className={`btn-gold ${compact ? "btn-sm min-h-11 px-2" : "min-h-12 w-full"}`}>
        <span className="truncate">{labels.buyNow}</span>
      </button>
    </div>
  );

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-3">
          {title}
          <p className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-xl" aria-live="polite" data-testid="price">
            <span className="font-medium">{priceText}</span>
            {compareAt && compareAt > price && <s className="text-base text-faint">{formatIQD(compareAt, locale)}</s>}
            {pct !== null && (
              <span className="inline-flex min-h-6 items-center rounded-full bg-st-accent px-2.5 text-xs font-medium text-st-on-accent" data-testid="pct-off">
                {fill(labels.percentOff, { pct })}
              </span>
            )}
          </p>
        </div>

        {info}

        {options.length > 0 && (
          <div ref={pickerRef} className="grid scroll-mt-24 gap-4">
            {options.map((o) => (
              <fieldset key={o.id}>
                <legend className="mb-2.5 text-[13px] font-medium">
                  {o.name}
                  {sel[o.id] && <span className="ms-2 font-normal text-muted">{valueLabel(sel[o.id]!)}</span>}
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
                        className={`relative h-11 w-11 rounded-full border p-0.5 transition-colors duration-150 ${on ? "border-st-fg ring-1 ring-st-fg" : "border-st-border hover:border-st-fg"} disabled:cursor-not-allowed disabled:opacity-40`}
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
                        className={`num min-h-11 min-w-14 rounded-full border px-4 text-sm font-medium transition-colors duration-150 ${
                          on ? "border-st-fg bg-st-fg text-st-bg" : "border-st-border bg-transparent hover:border-st-fg"
                        } disabled:cursor-not-allowed disabled:text-faint disabled:line-through disabled:hover:border-st-border`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {nudge && missing && (
              <p role="alert" className="text-sm font-medium">
                {fill(labels.choose, { option: missing.name })}
              </p>
            )}
          </div>
        )}

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted" data-testid="stock-status">
          {status.kind === "out" ? (
            <span className="font-medium text-st-fg">{labels.soldOutStatus}</span>
          ) : status.kind === "low" ? (
            <span className="font-medium text-st-fg">{fill(labels.onlyLeft, { count: status.count })}</span>
          ) : !hasVariants || variant ? (
            <span>{labels.inStock}</span>
          ) : null}
          {shownSku && (
            <span data-testid="sku">
              {labels.skuLabel}: <bdi className="num">{shownSku}</bdi>
            </span>
          )}
        </p>

        {!soldOut && (
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium" id="qty-label">{labels.quantity}</span>
            <div className="inline-flex items-center rounded-full border border-st-border bg-st-surface" role="group" aria-labelledby="qty-label">
              <button
                type="button"
                className="h-11 w-11 rounded-full text-lg transition-colors duration-150 hover:bg-st-fg/5 disabled:opacity-30"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label={labels.decrease}
              >
                −
              </button>
              <output className="num min-w-8 text-center font-medium" aria-live="polite" data-testid="qty">
                {qty}
              </output>
              <button
                type="button"
                className="h-11 w-11 rounded-full text-lg transition-colors duration-150 hover:bg-st-fg/5 disabled:opacity-30"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty}
                aria-label={labels.increase}
              >
                +
              </button>
            </div>
          </div>
        )}

        <div ref={inlineRef}>{buttons(false)}</div>

        <div className="flex gap-2">
          {waHref && (
            <WaTap slug={slug} href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-11 flex-1 border-st-border">
              <Icon as={MessageCircle} /> {labels.askWhatsApp}
            </WaTap>
          )}
          <button type="button" onClick={share} className={`btn-ghost min-h-11 border-st-border ${waHref ? "w-11 shrink-0 px-0" : "flex-1"}`} aria-label={copied ? labels.linkCopied : labels.share} title={labels.share}>
            <Icon as={copied ? Check : Share2} />
            {!waHref && <span aria-live="polite">{copied ? labels.linkCopied : labels.share}</span>}
          </button>
        </div>
      </div>

      {/* Phones: sticky buy bar once the inline buttons are off screen. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-st-border bg-st-bg/90 px-4 pt-2 backdrop-blur-xl transition-[transform,visibility] duration-200 ease-out md:hidden ${
          inlineVisible ? "invisible translate-y-full" : "visible translate-y-0"
        }`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-hidden={inlineVisible || undefined}
        inert={inlineVisible || undefined}
        data-testid="buy-bar"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 max-w-[34%]">
            <p className="hidden truncate text-xs text-muted min-[400px]:block">{variantTitle || name}</p>
            <p className="num truncate text-sm font-medium min-[400px]:text-base">{priceText}</p>
          </div>
          {buttons(true)}
        </div>
      </div>
    </>
  );
}
