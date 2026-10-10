"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { maskIraqiMobile } from "@/lib/phone";
import { fmt } from "@/lib/fmt";
import type { CartLabels } from "./cart-labels";
import { useCart } from "./cart";
import { placeOrderAction, quoteAction } from "@/server/actions/storefront";
import type { Quote } from "@/server/services/orders";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/order-status";
import type { Locale } from "@/lib/i18n";
import { shopperCityCookie } from "@/lib/shopper-city";
import { checkoutFallbackLink } from "@/lib/checkout-fallback";
import { SAVED_DETAILS_KEY, parseDetails, serializeDetails } from "@/lib/saved-details";
import { ViewPixel } from "./ViewPixel";

type Zone = { key: string; name: string; fee: number; areas: { id: string; name: string; fee: number }[] };
const OTHER = "__other";



export function CartCheckout({ labels: L, slug, locale, zones, payments, defaultCity, whatsapp, storeName }: { whatsapp?: string | null; storeName?: string; labels: CartLabels; slug: string; locale: Locale; zones: Zone[]; payments: PaymentMethod[]; defaultCity: string }) {
  const te = (k: string) => L.errors[k] ?? L.errors.generic ?? k;
  const router = useRouter();
  const { lines, setQty, clear } = useCart(slug);
  const [city, setCity] = useState(zones.some((z) => z.key === defaultCity) ? defaultCity : (zones[0]?.key ?? ""));
  const [method, setMethod] = useState<PaymentMethod>(payments[0] ?? "cod");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const zone = zones.find((z) => z.key === city);
  const areaId = area && area !== OTHER ? area : null;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [placing, startPlacing] = useTransition();

  // Fake-order protection: when the checkout form first appeared (bots submit instantly) — see src/lib/order-risk.ts.
  const openedAt = useRef(0);
  const hasLines = lines.length > 0;
  useEffect(() => {
    if (hasLines && !openedAt.current) openedAt.current = Date.now();
  }, [hasLines]);

  const nameRef = useRef<HTMLInputElement>(null);
  const landmarkRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const d = parseDetails(localStorage.getItem(SAVED_DETAILS_KEY));
      if (!d) return;
      if (nameRef.current && !nameRef.current.value) nameRef.current.value = d.name;
      if (landmarkRef.current && !landmarkRef.current.value) landmarkRef.current.value = d.landmark;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage
      if (d.phone) queueMicrotask(() => setPhone((p) => p || maskIraqiMobile(d.phone)));
    } catch {}
  }, []);

  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    let live = true;
    if (!lines.length) return;
    quoteAction(slug, lines, city || null, locale, { areaId, discountCode: code }).then((q) => live && setQuote(q));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, city, areaId, code, slug, locale]);

  if (!lines.length) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-6 py-16 text-center sm:py-24">
        <p className="display text-[28px] sm:text-[40px]">{L.emptyCart}</p>
        <Link href={`/s/${slug}`} className="btn-gold min-h-12 px-7">{L.continue}</Link>
      </div>
    );
  }

  const available = quote?.lines.filter((l) => l.available) ?? [];
  const waFallback = checkoutFallbackLink(
    { whatsapp, storeName: storeName ?? "", lines: available, total: quote?.total, cityName: zones.find((z) => z.key === city)?.name },
    locale,
  );

  function submit(fd: FormData) {
    setError(undefined);
    setFieldErrors({});
    try {
      localStorage.setItem(SAVED_DETAILS_KEY, serializeDetails({ name: String(fd.get("customerName") ?? ""), phone: String(fd.get("phone") ?? ""), landmark: String(fd.get("landmark") ?? "") }));
    } catch {}
    startPlacing(async () => {
      const r = await placeOrderAction(slug, {
        items: available.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        customerName: fd.get("customerName"),
        phone: fd.get("phone"),
        cityKey: city,
        areaId,
        areaOther: area === OTHER ? fd.get("areaOther") : null,
        landmark: fd.get("landmark"),
        discountCode: quote?.discountCode ?? null,
        address: fd.get("address") ?? "",
        notes: fd.get("notes") || undefined,
        paymentMethod: method,
        locale,
        hp: String(fd.get("website") ?? ""),
        elapsedMs: openedAt.current ? Date.now() - openedAt.current : undefined,
      });
      if (!r.ok) {
        setError(r.error === "VALIDATION" ? undefined : r.error);
        setFieldErrors(r.fieldErrors ?? {});
        if (r.error === "OUT_OF_STOCK" || r.error === "out_of_stock" || r.error === "product_unavailable") {
          setQuote(await quoteAction(slug, lines, city || null, locale, { areaId, discountCode: code }));
        }
        if (r.error?.startsWith("discount_")) {
          setQuote(await quoteAction(slug, lines, city || null, locale, { areaId, discountCode: code }));
        }
        return;
      }
      clear();
      if (r.external && r.redirectTo) window.location.assign(r.redirectTo);
      else if (r.redirectTo) router.push(new URL(r.redirectTo).pathname);
    });
  }

  const fe = (k: string) => fieldErrors[k] && <p className="field-error">{te(fieldErrors[k]!)}</p>;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
      {/* Seller analytics funnel: counted only when the cart has something in it (rendered after hydration). */}
      <ViewPixel slug={slug} checkout />
      {/* minmax(0,…) tracks: a long product name truncates instead of widening the page at 360 px. */}
      <section className="grid h-fit min-w-0 grid-cols-[minmax(0,1fr)]">
        <h1 className="display mb-6 text-[28px] sm:mb-8 sm:text-[40px]">{L.cart}</h1>
        <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-st-border border-y border-st-border" data-testid="cart-lines">
        {(quote?.lines ?? lines.map((l) => ({ ...l, key: `${l.productId}:${l.variantId ?? ""}`, name: "…", variantTitle: null, image: null, unitPrice: 0, lineTotal: 0, available: true, stock: null }))).map((l) => (
          <li key={l.key} className={`flex items-center gap-4 py-4 ${l.available ? "" : "opacity-60"}`}>
            {l.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.image} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-[#F4F4F5] object-cover sm:h-24 sm:w-[4.8rem]" />
            ) : (
              <span className="h-20 w-16 shrink-0 rounded-xl bg-[#F4F4F5] sm:h-24 sm:w-[4.8rem]" />
            )}
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="truncate text-[15px]">{l.name}</p>
              {l.variantTitle && <p className="truncate text-[13px] text-muted">{l.variantTitle}</p>}
              {l.available ? <p className="num text-sm font-medium">{formatIQD(l.unitPrice, locale)}</p> : <p className="text-sm font-medium">{L.unavailableLine}</p>}
            </div>
            <div className="flex shrink-0 items-center rounded-full border border-st-border" aria-label={L.qty}>
              <button type="button" className="h-11 w-11 rounded-full text-lg transition-colors duration-150 hover:bg-st-fg/5 disabled:opacity-30 sm:h-10 sm:w-10" onClick={() => setQty(l, l.quantity - 1)} aria-label="−">−</button>
              <span className="num w-6 text-center text-sm font-medium">{l.quantity}</span>
              <button type="button" className="h-11 w-11 rounded-full text-lg transition-colors duration-150 hover:bg-st-fg/5 disabled:opacity-30 sm:h-10 sm:w-10" onClick={() => setQty(l, l.quantity + 1)} aria-label="+" disabled={l.stock !== null && l.quantity >= l.stock}>+</button>
            </div>
          </li>
        ))}
        </ul>
        <Link href={`/s/${slug}`} className="mt-4 inline-flex min-h-11 w-fit items-center text-sm font-medium underline underline-offset-4 hover:text-st-accent">{L.continue}</Link>
      </section>

      <form action={submit} className="grid h-fit gap-5 rounded-2xl border border-st-border bg-st-surface p-5 sm:p-6 lg:sticky lg:top-24" data-testid="checkout-form">
        <h2 className="display text-[22px] sm:text-[28px]">{L.checkout}</h2>
        {/* Honeypot: hidden from people and screen readers; form-filling bots fill it and the order is refused. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="co-website">Website</label>
          <input id="co-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium" htmlFor="co-city">{L.deliverTo}</label>
          <select
            id="co-city"
            className="select"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              document.cookie = `${shopperCityCookie(slug)}=${encodeURIComponent(e.target.value)}; path=/s/${slug}; max-age=31536000; SameSite=Lax`;
              setArea("");
            }}
            required
          >
            {zones.map((z) => (
              <option key={z.key} value={z.key}>
                {z.name} · {z.fee === 0 ? L.free : formatIQD(z.fee, locale)}
              </option>
            ))}
          </select>
        </div>
        {zone && zone.areas.length > 0 && (
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" htmlFor="co-area">{L.area}</label>
            <select id="co-area" name="areaId" className="select" value={area} onChange={(e) => setArea(e.target.value)} required>
              <option value="" disabled>{L.chooseArea}</option>
              {zone.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.fee !== zone.fee ? ` · ${a.fee === 0 ? L.free : formatIQD(a.fee, locale)}` : ""}
                </option>
              ))}
              <option value={OTHER}>{L.otherArea}</option>
            </select>
            {fe("areaId")}
          </div>
        )}
        {(area === OTHER || (zone && zone.areas.length === 0)) && (
          <div>
            {zone && zone.areas.length === 0 && <label className="mb-1.5 block text-[13px] font-medium" htmlFor="co-area-other">{L.area}</label>}
            <input id="co-area-other" name="areaOther" className="input" placeholder={L.areaPlaceholder} aria-label={L.area} maxLength={80} />
          </div>
        )}
        <fieldset className="grid gap-3">
          <legend className="mb-1.5 block text-[13px] font-medium">{L.yourDetails}</legend>
          <input ref={nameRef} name="customerName" className="input" placeholder={L.name} aria-label={L.name} autoComplete="name" required minLength={2} />
          {fe("customerName")}
          <div>
            <input
              name="phone"
              className="input num w-full"
              dir="ltr"
              type="tel"
              inputMode="tel"
              placeholder="07XX XXX XXXX"
              aria-label={L.phone}
              aria-describedby="co-phone-hint"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(maskIraqiMobile(e.target.value))}
              maxLength={17}
              required
            />
            {fieldErrors.phone ? fe("phone") : <p id="co-phone-hint" className="hint">{L.phoneHint}</p>}
          </div>
          <div>
            <input ref={landmarkRef} name="landmark" className="input w-full" placeholder={L.landmarkHint} aria-label={L.landmark} maxLength={200} />
            {fe("landmark")}
          </div>
          <textarea name="address" className="input min-h-16" placeholder={L.addressDetails} aria-label={L.address} maxLength={300} />
          {fe("address")}
          <textarea name="notes" className="input min-h-16" placeholder={L.notes} aria-label={L.notes} maxLength={500} />
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 block text-[13px] font-medium">{L.payment}</legend>
          <div className="grid gap-2">
            {payments.map((m) => (
              <label key={m} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-[15px] transition-[border-color,box-shadow] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2563EB] ${method === m ? "border-st-fg ring-1 ring-st-fg" : "border-st-border hover:border-st-fg/40"}`}>
                <input type="radio" name="paymentMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="h-5 w-5 shrink-0 accent-ink" />
                {m === "cod" ? L.cod : PAYMENT_LABEL[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          {!codeOpen && !code ? (
            <button type="button" className="min-h-11 text-sm font-medium underline underline-offset-4 hover:text-st-accent" onClick={() => setCodeOpen(true)}>{L.haveCode}</button>
          ) : code && quote?.discountCode ? (
            <p className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-st-border px-4 text-sm">
              <span className="font-medium">{fmt(L.codeApplied, { code: quote.discountCode })}</span>
              <button type="button" className="min-h-11 text-muted underline underline-offset-4 hover:text-st-fg" onClick={() => { setCode(null); setCodeInput(""); }}>{L.removeCode}</button>
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium" htmlFor="co-code">{L.discountCode}</label>
              <div className="flex gap-2">
                <input
                  id="co-code"
                  className="input min-w-0 flex-1 uppercase"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setCode(codeInput.trim() || null);
                    }
                  }}
                  maxLength={32}
                />
                <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setCode(codeInput.trim() || null)} disabled={!codeInput.trim()}>{L.apply}</button>
              </div>
              {code && quote?.discountError && <p className="field-error" role="alert">{te(quote.discountError)}</p>}
            </div>
          )}
        </div>
        {quote && quote.freeDeliveryRemaining !== null && (
          <div className="text-[13px] text-muted">
            <p>{fmt(L.freeDeliveryProgress, { amount: formatIQD(quote.freeDeliveryRemaining, locale) })}</p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={freeDeliveryPercent(quote.subtotal, quote.freeDeliveryRemaining)} className="mt-2 h-1 overflow-hidden rounded-full bg-st-fg/10">
              <div className="h-full rounded-full bg-st-fg transition-[width] duration-500 ease-out" style={{ width: `${freeDeliveryPercent(quote.subtotal, quote.freeDeliveryRemaining)}%` }} />
            </div>
          </div>
        )}
        {quote && quote.freeDelivery && quote.subtotal > 0 && (
          <p className="text-[13px] font-medium">{L.freeDeliveryUnlocked}</p>
        )}
        <dl className="grid grid-cols-2 gap-y-2 border-t border-st-border pt-4 text-sm">
          <dt className="text-muted">{L.subtotal}</dt>
          <dd className="num text-end">{quote ? formatIQD(quote.subtotal, locale) : "…"}</dd>
          {quote && quote.discountAmount > 0 && (
            <>
              <dt className="text-muted">{L.discount}</dt>
              <dd className="num text-end">−{formatIQD(quote.discountAmount, locale)}</dd>
            </>
          )}
          <dt className="text-muted">{L.delivery}</dt>
          <dd className="num text-end">{quote ? (quote.freeDelivery ? L.free : formatIQD(quote.deliveryFee, locale)) : "…"}</dd>
          <dt className="mt-2 border-t border-st-border pt-3 text-base font-medium">{L.total}</dt>
          <dd className="num mt-2 border-t border-st-border pt-3 text-end text-base font-medium">{quote ? formatIQD(quote.total, locale) : "…"}</dd>
        </dl>
        {error && <p role="alert" className="rounded-xl border border-danger/30 px-4 py-3 text-sm font-medium text-danger">{te(error)}</p>}
        <button className="btn-gold min-h-12 w-full" disabled={placing || !available.length || !city}>
          {placing ? L.placing : L.placeOrder}
        </button>
        {waFallback && (
          <a href={waFallback} target="_blank" rel="noopener noreferrer" className="btn btn-ghost -mt-2 min-h-12 border-st-border" data-testid="checkout-whatsapp-fallback">
            {L.orderViaWhatsapp}
          </a>
        )}
      </form>
    </div>
  );
}

export function freeDeliveryPercent(subtotal: number, remaining: number): number {
  const total = subtotal + remaining;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((subtotal / total) * 100)));
}
