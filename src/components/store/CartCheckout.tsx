"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "./cart";
import { placeOrderAction, quoteAction } from "@/server/actions/storefront";
import type { Quote } from "@/server/services/orders";
import { formatIQD } from "@/lib/money";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/order-status";
import type { Locale } from "@/lib/i18n";
import { FormError } from "@/components/forms/Field";

type Zone = { key: string; name: string; fee: number };

export function CartCheckout({ slug, locale, zones, payments, defaultCity }: { slug: string; locale: Locale; zones: Zone[]; payments: PaymentMethod[]; defaultCity: string }) {
  const t = useTranslations("store");
  const tp = useTranslations("payments");
  const te = useTranslations("errors");
  const router = useRouter();
  const { lines, setQty, clear } = useCart(slug);
  const [city, setCity] = useState(zones.some((z) => z.key === defaultCity) ? defaultCity : (zones[0]?.key ?? ""));
  const [method, setMethod] = useState<PaymentMethod>(payments[0] ?? "cod");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [placing, startPlacing] = useTransition();

  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    let live = true;
    if (!lines.length) return;
    quoteAction(slug, lines, city || null, locale).then((q) => live && setQuote(q));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, city, slug, locale]);

  if (!lines.length) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="text-lg font-semibold">{t("emptyCart")}</p>
        <Link href={`/s/${slug}`} className="btn-gold mt-4">{t("continue")}</Link>
      </div>
    );
  }

  const available = quote?.lines.filter((l) => l.available) ?? [];

  function submit(fd: FormData) {
    setError(undefined);
    setFieldErrors({});
    startPlacing(async () => {
      const r = await placeOrderAction(slug, {
        items: available.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customerName: fd.get("customerName"),
        phone: fd.get("phone"),
        cityKey: city,
        address: fd.get("address"),
        notes: fd.get("notes") || undefined,
        paymentMethod: method,
        locale,
      });
      if (!r.ok) {
        setError(r.error === "VALIDATION" ? undefined : r.error);
        setFieldErrors(r.fieldErrors ?? {});
        if (r.error === "OUT_OF_STOCK" || r.error === "out_of_stock" || r.error === "product_unavailable") {
          setQuote(await quoteAction(slug, lines, city || null, locale));
        }
        return;
      }
      clear();
      if (r.external && r.redirectTo) window.location.assign(r.redirectTo);
      else if (r.redirectTo) router.push(new URL(r.redirectTo).pathname);
    });
  }

  const fe = (k: string) => fieldErrors[k] && <p className="field-error">{te(fieldErrors[k] as "generic")}</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section className="grid h-fit gap-2">
        <h1 className="text-2xl font-extrabold">{t("cart")}</h1>
        {(quote?.lines ?? lines.map((l) => ({ ...l, name: "…", image: null, unitPrice: 0, lineTotal: 0, available: true, stock: null }))).map((l) => (
          <div key={l.productId} className={`card flex items-center gap-3 p-3 ${l.available ? "" : "opacity-60"}`}>
            {l.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <span className="h-16 w-16 rounded-xl bg-paper" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{l.name}</p>
              {l.available ? <p className="num text-sm text-ink-70">{formatIQD(l.unitPrice, locale)}</p> : <p className="text-sm font-semibold text-danger">{t("unavailableLine")}</p>}
            </div>
            <div className="flex items-center gap-1" aria-label={t("qty")}>
              <button type="button" className="btn-ghost btn-sm w-9 px-0" onClick={() => setQty(l.productId, l.quantity - 1)} aria-label="−">−</button>
              <span className="num w-6 text-center font-bold">{l.quantity}</span>
              <button type="button" className="btn-ghost btn-sm w-9 px-0" onClick={() => setQty(l.productId, l.quantity + 1)} aria-label="+" disabled={l.stock !== null && l.quantity >= l.stock}>+</button>
            </div>
          </div>
        ))}
        <Link href={`/s/${slug}`} className="mt-2 text-sm font-semibold underline">{t("continue")}</Link>
      </section>

      <form action={submit} className="card grid h-fit gap-4 lg:sticky lg:top-24">
        <h2 className="text-xl font-extrabold">{t("checkout")}</h2>
        <div>
          <label className="label" htmlFor="co-city">{t("deliverTo")}</label>
          <select id="co-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} required>
            {zones.map((z) => (
              <option key={z.key} value={z.key}>
                {z.name} · {z.fee === 0 ? "0" : z.fee.toLocaleString("en-US")}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="grid gap-3">
          <legend className="label">{t("yourDetails")}</legend>
          <input name="customerName" className="input" placeholder={t("name")} aria-label={t("name")} autoComplete="name" required minLength={2} />
          {fe("customerName")}
          <input name="phone" className="input num" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" aria-label={t("phone")} autoComplete="tel" required />
          {fe("phone")}
          <textarea name="address" className="input min-h-20" placeholder={t("addressHint")} aria-label={t("address")} required minLength={3} maxLength={300} />
          {fe("address")}
          <textarea name="notes" className="input min-h-16" placeholder={t("notes")} aria-label={t("notes")} maxLength={500} />
        </fieldset>
        <fieldset>
          <legend className="label">{t("payment")}</legend>
          <div className="grid gap-2">
            {payments.map((m) => (
              <label key={m} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 font-semibold ${method === m ? "border-ink bg-ink/5" : "border-line"}`}>
                <input type="radio" name="paymentMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-[#0F1B2D]" />
                {m === "cod" ? tp("cod") : PAYMENT_LABEL[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <dl className="grid grid-cols-2 gap-1 border-t border-line pt-3">
          <dt>{t("subtotal")}</dt>
          <dd className="num text-end">{quote ? formatIQD(quote.subtotal, locale) : "…"}</dd>
          <dt>{t("delivery")}</dt>
          <dd className="num text-end">{quote ? formatIQD(quote.deliveryFee, locale) : "…"}</dd>
          <dt className="text-lg font-extrabold">{t("total")}</dt>
          <dd className="num text-end text-lg font-extrabold">{quote ? formatIQD(quote.total, locale) : "…"}</dd>
        </dl>
        <FormError error={error} />
        <button className="btn-gold" disabled={placing || !available.length || !city}>
          {placing ? "…" : t("placeOrder")}
        </button>
      </form>
    </div>
  );
}
