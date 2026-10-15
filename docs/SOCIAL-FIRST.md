# Social-first Bazarga

**Thesis (Abdulla, 2026-10-15).** "Everyone just posts products on TikTok / Instagram" is not the reason Bazarga fails;
it is the reason Bazarga exists. Iraqi sellers already get the attention on TikTok, Instagram and WhatsApp. What they
lose is everything after the view: DMs pile up, the same "بەچەندە؟" is answered a hundred times a day, there is no
order record, no tracking, and no idea which platform actually sold.

Bazarga does not compete with TikTok or Instagram. **Its job is to turn those views into real orders**:

- one link in the bio, every product with a visible price;
- a structured order (name, phone, city, address) with cash on delivery, not a chat thread;
- every shared link tagged with its platform, so the seller sees *which platform sold*;
- the seller's own ad pixels, and WhatsApp as the hand-off rather than the order book.

Sellers keep posting. Bazarga is what happens when someone taps.

## Checklist

| # | Item | Status |
|---|------|--------|
| S1 | **Landing positioning**: hero "Keep posting on TikTok. Bazarga turns views into orders." in ku / ar / en / kmr, plus a "DMs vs Bazarga" comparison section (lost DMs, endless "how much?", no record, no tracking vs one bio link, visible prices, structured COD orders, source shown). Blue/ink, 360 px safe, reduced motion. | ✅ shipped (on main, a7f0bdd) |
| S2 | **Bio link + short product links + rich OG cards**: `/p/<code>` short links per product, per-product dynamic OG image (next/og) so a link pasted in WhatsApp/Telegram/Instagram DMs previews with photo, name and price. | ⏳ open. OG-card piece assigned to Hark (Agent A) on `hark/og-cards`; short links still open |
| S3 | **Dashboard share kit per product**: "Share" on every product → modal with client-side canvas 9:16 (1080×1920) and 1:1 (1080×1080) images (photo, name, IQD price, store name, QR to the product link, Bazarga mark), Download, caption generator (ku/ar/en + hashtags, copy), copy link per platform (TikTok, Instagram, WhatsApp, Telegram, Facebook), Web Share API with files. QR = `uqr` (MIT), computed on the server. RTL text drawn with `ctx.direction = "rtl"`. | ✅ shipped (on main, a7f0bdd) |
| S4 | **Source attribution**: share-kit links carry `?src=<platform>`; the storefront keeps it (sessionStorage + 7-day first-party cookie, allowlist) and checkout stores it on `orders.source` (migration 0018, nullable + index; zod allowlist server-side). Social arrivals counted as `src:<platform>` rows in `store_page_views`. Analytics: "Orders by source" chart + conversion per platform; order detail shows "From TikTok". Demo data seeded (TikTok largest). | ✅ shipped (on main, a7f0bdd) |
| S5 | **Seller TikTok / Meta Pixel IDs**: settings fields for the seller's TikTok Pixel and Meta Pixel IDs; fire PageView / ViewContent / AddToCart / Purchase on the storefront (CSP nonce, consent-light, no PII). | ⏳ open |
| S6 | **WhatsApp order hand-off**: after checkout, a wa.me button to the seller with a prefilled order message (number, items, total, tracking link), plus a re-openable order status page the shopper can come back to. | ⏳ open |

## How the pieces fit (S3 + S4)

```
Dashboard → Products → Share ─┬─ story / square PNG (canvas, QR → /s/<slug>/p/<id>?src=qr)
                              ├─ caption (ku/ar/en) with link ?src=<platform>
                              └─ copy link: TikTok / Instagram / WhatsApp / Telegram / Facebook (?src=…)
Shopper taps link → /s/<slug>/p/<id>?src=tiktok
  └─ SourceCapture (client): sessionStorage + cookie bzsrc_<slug>, beacon /api/v/<slug>?s=tiktok, strips ?src
Checkout → placeOrderAction({ …, source: "tiktok" }) → zod allowlist → orders.source
Analytics → "Orders by source" (orders + share, conversion = orders / social arrivals); order page "From TikTok"
```

Allowlist: `tiktok, instagram, whatsapp, facebook, telegram, snapchat, qr` (`src/lib/social.ts`). Anything else is
dropped silently (never fails an order). No visitor-level data is stored: arrivals are per-store, per-day counters.

## Files

- `src/lib/social.ts`: allowlist, labels/colours, `withSource`, `productUrl`, caption builder, formats.
- `src/lib/source-client.ts`, `src/components/store/SourceCapture.tsx`: storefront capture.
- `src/lib/share-canvas.ts`: canvas drawing (story + square), RTL-aware wrap.
- `src/components/dashboard/ProductShareButton.tsx`, `ProductShareModal.tsx`, `src/server/actions/share.ts`.
- `drizzle/0018_order_source.sql`, `src/server/services/analytics.ts` (`bySource`, `buildSourceRows`),
  `src/components/charts/viz.tsx` (`SourceBars`), `scripts/seed-analytics.ts` (`DEMO_SOURCES`, `backfillDemoSources`).
- `src/components/marketing/DmsVsBazarga.tsx`, landing hero copy in `messages/*.json` (`landing.hero*`, `landing.dvb.*`).
