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
      <div className="card mx-auto max-w-md text-center">
        <p className="text-lg font-semibold">{L.emptyCart}</p>
        <Link href={`/s/${slug}`} className="btn-gold mt-4">{L.continue}</Link>
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      {/* Seller analytics funnel: counted only when the cart has something in it (rendered after hydration). */}
      <ViewPixel slug={slug} checkout />
      {/* minmax(0,…) tracks: a long product name truncates instead of widening the page at 360 px. */}
      <section className="grid h-fit min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        <h1 className="text-2xl font-extrabold">{L.cart}</h1>
        {(quote?.lines ?? lines.map((l) => ({ ...l, key: `${l.productId}:${l.variantId ?? ""}`, name: "…", variantTitle: null, image: null, unitPrice: 0, lineTotal: 0, available: true, stock: null }))).map((l) => (
          <div key={l.key} className={`card flex items-center gap-3 p-3 shadow-e1 transition-shadow duration-150 hover:shadow-e2 ${l.available ? "" : "opacity-60"}`}>
            {l.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.image} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover" />
            ) : (
              <span className="h-20 w-20 shrink-0 rounded-xl border border-line bg-paper" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{l.name}</p>
              {l.variantTitle && <p className="truncate text-sm text-ink-70">{l.variantTitle}</p>}
              {l.available ? <p className="num text-sm text-ink-70">{formatIQD(l.unitPrice, locale)}</p> : <p className="text-sm font-semibold text-danger">{L.unavailableLine}</p>}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-paper p-1" aria-label={L.qty}>
              <button type="button" className="btn-ghost btn-sm w-11 px-0 sm:w-9" onClick={() => setQty(l, l.quantity - 1)} aria-label="−">−</button>
              <span className="num w-6 text-center font-bold">{l.quantity}</span>
              <button type="button" className="btn-ghost btn-sm w-11 px-0 sm:w-9" onClick={() => setQty(l, l.quantity + 1)} aria-label="+" disabled={l.stock !== null && l.quantity >= l.stock}>+</button>
            </div>
          </div>
        ))}
        <Link href={`/s/${slug}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline">{L.continue}</Link>
      </section>

      <form action={submit} className="card grid h-fit gap-4 shadow-e2 lg:sticky lg:top-24">
        <h2 className="border-b border-line pb-3 text-xl font-extrabold">{L.checkout}</h2>
        {/* Honeypot: hidden from people and screen readers; form-filling bots fill it and the order is refused. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="co-website">Website</label>
          <input id="co-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
        <div>
          <label className="label" htmlFor="co-city">{L.deliverTo}</label>
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
            <label className="label" htmlFor="co-area">{L.area}</label>
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
            {zone && zone.areas.length === 0 && <label className="label" htmlFor="co-area-other">{L.area}</label>}
            <input id="co-area-other" name="areaOther" className="input" placeholder={L.areaPlaceholder} aria-label={L.area} maxLength={80} />
          </div>
        )}
        <fieldset className="grid gap-3">
          <legend className="label">{L.yourDetails}</legend>
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
          <legend className="label">{L.payment}</legend>
          <div className="grid gap-2">
            {payments.map((m) => (
              <label key={m} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 font-semibold transition-[border-color,background-color,box-shadow] duration-150 active:scale-[0.99] focus-within:ring-2 focus-within:ring-gold ${method === m ? "border-ink bg-ink/5 shadow-e1" : "border-line hover:border-ink/40"}`}>
                <input type="radio" name="paymentMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="h-5 w-5 shrink-0 accent-ink" />
                {m === "cod" ? L.cod : PAYMENT_LABEL[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          {!codeOpen && !code ? (
            <button type="button" className="min-h-11 text-sm font-semibold underline" onClick={() => setCodeOpen(true)}>{L.haveCode}</button>
          ) : code && quote?.discountCode ? (
            <p className="flex items-center justify-between gap-2 rounded-xl bg-green/10 px-3 py-2 text-sm font-semibold text-green">
              <span>{fmt(L.codeApplied, { code: quote.discountCode })}</span>
              <button type="button" className="underline" onClick={() => { setCode(null); setCodeInput(""); }}>{L.removeCode}</button>
            </p>
          ) : (
            <div>
              <label className="label" htmlFor="co-code">{L.discountCode}</label>
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
          <div className="rounded-xl bg-gold/15 px-3 py-2 text-sm font-semibold">
            <p>{fmt(L.freeDeliveryProgress, { amount: formatIQD(quote.freeDeliveryRemaining, locale) })}</p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={freeDeliveryPercent(quote.subtotal, quote.freeDeliveryRemaining)} className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-green" style={{ width: `${freeDeliveryPercent(quote.subtotal, quote.freeDeliveryRemaining)}%` }} />
            </div>
          </div>
        )}
        {quote && quote.freeDelivery && quote.subtotal > 0 && (
          <p className="rounded-xl bg-green/10 px-3 py-2 text-sm font-semibold text-green">{L.freeDeliveryUnlocked}</p>
        )}
        <dl className="grid grid-cols-2 gap-1 border-t border-line pt-3">
          <dt>{L.subtotal}</dt>
          <dd className="num text-end">{quote ? formatIQD(quote.subtotal, locale) : "…"}</dd>
          {quote && quote.discountAmount > 0 && (
            <>
              <dt>{L.discount}</dt>
              <dd className="num text-end text-green">−{formatIQD(quote.discountAmount, locale)}</dd>
            </>
          )}
          <dt>{L.delivery}</dt>
          <dd className="num text-end">{quote ? (quote.freeDelivery ? L.free : formatIQD(quote.deliveryFee, locale)) : "…"}</dd>
          <dt className="text-lg font-extrabold">{L.total}</dt>
          <dd className="num text-end text-lg font-extrabold">{quote ? formatIQD(quote.total, locale) : "…"}</dd>
        </dl>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{te(error)}</p>}
        <button className="btn-gold" disabled={placing || !available.length || !city}>
          {placing ? L.placing : L.placeOrder}
        </button>
        {waFallback && (
          <a href={waFallback} target="_blank" rel="noopener noreferrer" className="btn min-h-12 bg-whatsapp text-ink hover:brightness-95" data-testid="checkout-whatsapp-fallback">
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
