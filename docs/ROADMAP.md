# Bazarga — Roadmap after v1

## Shipped

**Storefront & catalog**
- Store home `/s/[slug]`: cover hero (seller photo with scrim, LCP-eager, LQIP placeholder; falls back to the
  theme's `st-hero` gradient) with logo, name, tagline and about; server-side GET search (`?q=`, works without JS);
  category chips that keep the query; cumulative "Show more" pagination (`?page=N` shows the first N×24);
  empty-search state with "Clear"; floating WhatsApp button (wa.me link from `store.whatsapp`, safe-area aware,
  start side so bottom-right in RTL); chips and surfaces on theme tokens only. No next-intl client code on storefront routes.
- `src/lib/catalog-filter.ts` — pure `filterCatalog()` (search across every locale's name, Arabic/Kurdish letter
  folding ي/ی ك/ک ه/ە ة أ/إ/آ, tatweel + diacritics stripped, multi-word AND) — unit tested.

**Seller settings**
- Cover photo upload (client → `/api/uploads` → URL + placeholder saved) and optional free-delivery threshold
  (IQD, accepts `50,000` / Eastern Arabic digits) — `saveStorefrontAction` + `updateStoreStorefront`, zod-validated,
  invalidates the store cache tag and the settings path.

**Checkout**
- Discount codes: percentage / fixed / free-delivery; checks active, start/end window, minimum subtotal, usage
  limit; the use is claimed with a conditional `UPDATE … WHERE used_count < max_uses … RETURNING` inside the
  order transaction, so a failed order never burns a use and racing shoppers can't exceed the limit. Quote shows
  the discount or the reason it doesn't apply; code, amount and id are stored on the order.
- Free-delivery threshold applied in quote and order (checked before the code's discount) with an
  "Add X IQD more for free delivery" nudge.
- Delivery area select per chosen city (seller areas with their own fee, or "Other area" free text) and a
  landmark field; saved on the order and the customer; address line is now optional when a landmark is given.
- Iraqi mobile normalisation to `+9647XXXXXXXXX` (07xx, 7xx, +964, 00964, Eastern Arabic / Kurdish digits) with
  operator validation (75 Korek, 77 Asiacell, 78/79 Zain) and an as-you-type input mask.
- Order confirmation, seller dashboard and seller notification show area, landmark and discount.
- Fixed: `/s/[slug]/cart` and the order confirmation page crashed at runtime (label-key arrays were exported
  from "use client" modules, so server pages got client references); keys now live in `components/store/cart-labels.ts`.

**PWA, push, performance, mobile (v3)**
- Installable PWA: web app manifest, maskable icons, hand-written service worker with a Kurdish offline page,
  production-only registration, seller install prompt.
- Web push for new orders (VAPID from env; the feature hides itself when unset), settings toggle, dead
  subscriptions pruned on 404/410 or repeated failures.
- Performance budgets (`npm run budget`: storefront ≤155 KiB, dashboard ≤200 KiB gzipped first-load JS; all
  routes pass), lazy-split heavy client pieces, explicit cache headers. Lighthouse mobile: store home 88/100/100/100,
  product page 94/100/100/100 (Perf/A11y/BP/SEO), CLS 0 — details in `docs/PERFORMANCE.md`.
- Mobile RTL pass verified at 360/390/414/430 px in ku and en on 11 storefront + dashboard routes: no
  horizontal overflow, tap targets ≥44 px, inputs ≥16 px, logical properties, safe-area insets.
  `npm run test:mobile` (Playwright) and `npm run shots:mobile` (screenshots + report).

**Bazarga (v4)**
- Renamed to **Bazarga** (Latin wordmark "BAZARGA", Kurdish/Arabic بازارگە) across every locale, metadata,
  PWA manifest + regenerated icons, offline page, service worker, reset email, sender display name, storefront
  "Made with" footer, README. Domains, cookie names, DB names and migrations unchanged.
- Product page `/s/[slug]/p/[productId]` (mobile-first, `st-*` tokens): swipe gallery with "2/5" counter, dots,
  thumbnail strip, lazy fullscreen viewer (`<dialog>`, swipe, pinch / double-tap / button zoom with native pan);
  price with compare-at strike + "% off" badge, stock status (in stock / only N left / sold out), SKU (product
  or selected variant), quantity stepper; trust row (cash on delivery, delivery fee + ETA to the home city,
  returns, WhatsApp); collapsible Description (paragraphs + line breaks as text), Details (specs table),
  Delivery & returns; "More from this store" (same category first, ≤8, from the cached catalog); Product
  JSON-LD (Offer/AggregateOffer in IQD, availability, nonced) and og/twitter image.
- `products.specs` (jsonb `{label, value}` LocalizedText rows, ≤20) + `products.sku` and
  `stores.cover_image_renditions` (migration `0002_product_specs_cover_renditions`); specs editor in the product
  form (add/remove rows per language tab), zod validation, tests. Cover uploads keep their renditions → store-home
  cover `srcset` (closes the "cover renditions" item below).
- Demo seed: 4 products with 3–5 photos each (detail crops derived from the demo photos with sharp, run through
  the upload pipeline), specs everywhere, honey on sale (30,000 → 25,000), the variant dress, cover with
  renditions, Erbil areas (Shawes, Ankawa, Bakhtiyari, 100m Street, Iskan) and Sulaymaniyah areas, WELCOME10
  (10 %, min 30,000 IQD, 100 uses) next to NEWROZ. Smoke + Playwright product-page checks added.

**Dashboard: discounts & delivery areas (v5)**
- Discounts screen `/dashboard/discounts`: create / edit / deactivate codes (percentage ≤90 %, fixed, free
  delivery with a truck icon), start/end window, minimum subtotal, usage limit; codes are scoped to the seller's
  store. Linked from the dashboard nav / More.
- Delivery areas management `/dashboard/delivery`: add / edit / remove areas per city with their own fee; changes
  invalidate the storefront cache so checkout offers the new area immediately.
- WhatsApp order summary shows subtotal plus a discount line with the code and amount (free-delivery codes named),
  in ku/ar/en/kmr.
- Migration `0003_phone_e164_backfill`: legacy `9647…` customer and order phones rewritten to `+9647…`; duplicate
  customers per store merged (oldest kept, orders repointed, totals summed).
- Checks: unit tests for both screens and the migration; smoke covers discount + area create; 360 px mobile checks
  cover Discounts, Delivery (areas open) and More.

**Shopper order tracking (v6)**
- `/s/[slug]/track`: the shopper enters the order number + the phone they ordered with (normalised like checkout to
  `+9647…`; `#1001`, Eastern Arabic/Kurdish digits and `00964`/`+964` forms accepted) and sees a status timeline
  (received → confirmed → on its way → delivered, with postponed / refused / returned / cancelled shown where they
  happened, dates in Baghdad time, courier + tracking number when the seller set them), items, totals, discount,
  delivery city/area and fee, payment method and status, and a WhatsApp button to the store. noindex.
- Tenant-safe: lookup scoped to the store, needs both number and phone, one generic "not found" for every miss;
  shopper-safe shape (no address, notes, internal ids or seller history notes). Rate-limited per IP per store
  (10 / 10 min) and per order number across IPs (6 / 10 min) on the existing Postgres limiter.
- No-JS form (`<form action>` server action → 303): a match sets an httpOnly `mm_track` cookie (order public id,
  30 min) so the phone never appears in a URL. No page-specific client JS (144.8 KiB gzip, under 155 KiB).
- Confirmation page links to it; the WhatsApp order summary ends with the tracking link (ku/ar/en/kmr).
- No schema change (orders already had a unique `(store_id, number)` index). 11 new Vitest tests (295 total), smoke
  covers lookup / wrong phone / wrong number / unknown store / rate limit, 360 px mobile checks cover the form and a
  looked-up order, budget now also holds the confirmation and tracking pages to the storefront budget.

**Still open from this batch**
- ~~Cover renditions~~ shipped in v4 (re-run Lighthouse on the store home to confirm the LCP gain).
- Product page: the trust row's delivery line uses the store's home city; remember the shopper's last checkout
  city (cookie) to show their own fee. Specs labels could offer presets (Material, Size, Weight, Origin).
- Lightbox pinch zoom is verified in desktop Chromium with touch emulation only; check on real iOS Safari / Android.
- Product-grid thumbnails: add a ~480 w rendition (Lighthouse estimates ~96 KB savings on store home).
- Run `npm run test:mobile` in CI (needs a seeded build + Chromium in the CI image).
- ~~Dashboard UI for managing discount codes and delivery areas.~~ Shipped in v5.
- ~~Legacy `9647…` phone backfill to `+9647…`.~~ Shipped in v5 (migration 0003, with duplicate-customer merge).
- Order tracking follow-ups: a per-order "copy tracking link" for sellers in the dashboard; a Kurmanji (kmr) pass
  on the `track.*` strings (falls back to English today); storefront `notFound()` answers 200 with the 404 boundary
  (partial prerender streams it) — consider a real 404 status for unknown stores/orders.
- Concurrency of discount claims is tested on PGlite (single connection, so transactions serialise); the
  conditional UPDATE is what makes it safe under Postgres READ COMMITTED — worth one integration run on real Postgres.

---

Ordered by what unblocks real sellers fastest. Each item lists the code seam that already exists for it.

## 1. Payments go-live (weeks 1–3)

- **FIB:** register for the sandbox (fib.iq → Integration Request Form), set `FIB_ENABLED=true` + sandbox
  credentials, run a full order → QR → pay in the FIB sandbox app → callback. Confirm the `redirectUri` field and
  the post-refund status value (both `TODO(verify)` in `src/server/payments/fib.ts`). Request production
  credentials from integration@fib.iq; set `FIB_BASE_URL` to the production host they issue.
- **ZainCash v2:** test against UAT with the public test merchant/wallets (docs.zaincash.iq → Test Credentials).
  Lock down the init-response and JWT claim field names (`TODO(verify)` in `src/server/payments/zaincash.ts`),
  then ask the ZainCash business team to register `https://<APP_URL>/api/payments/zaincash/webhook`.
- **Per-store merchant accounts:** v1 uses one platform merchant account per provider (sellers are paid out
  manually). Next: per-store credentials (encrypted at rest) or a marketplace/split-payment agreement with FIB.
- **FastPay and Qi Card:** obtain merchant API specs, implement the stubs in `src/server/payments/stubs.ts`.
- **Reconciliation job:** a scheduled task that calls `syncPaymentFromProvider` for transactions pending > 15 min,
  and expires abandoned online orders (restocking them).
- **Refunds** from the dashboard (FIB `/refund`, ZainCash `/transaction/reverse`).

## 2. Sign in with WhatsApp OTP (weeks 2–4)

- Implement `WhatsAppOtpProvider` behind the existing `OtpProvider` interface (`src/server/otp`): WhatsApp Cloud
  API *authentication* template, hashed codes in a `otp_codes` table with attempt counters, per-phone + per-IP
  rate limits (reuse `enforceRateLimit`).
- Make `users.email` optional, add `users.phone` unique + verified flag; phone-first signup for sellers who don't use email.
- SMS fallback (Asiacell/Zain/Korek aggregators) for numbers without WhatsApp.

## 3. AI chat onboarding via WhatsApp (weeks 3–8) — the core differentiator

- WhatsApp Cloud API webhook → conversation state machine: seller sends photos + prices in Sorani/Badini/Arabic →
  `createProductsFromPhotos` (already built, `src/server/ai`) → reply with a draft preview link → seller confirms
  with one tap → store live.
- Same flow on Instagram DMs (Messenger Platform) for sellers who live there.
- Voice notes: speech-to-text (Kurdish-capable model) before the vision step.
- Evaluate Sorani/Kurmanji quality of the vision model; build a small labelled set from early sellers.

## 4. Custom domains & subdomains (weeks 4–6)

- Seller adds `shop.example.com` → DNS TXT verification → store `stores.custom_domain`.
- Proxy (`src/proxy.ts`): look up verified domains (cached, e.g. LRU + 60 s TTL; proxy runs on Node so a DB
  query is fine) and rewrite to `/s/{slug}`.
- Automatic TLS: Caddy on-demand TLS with an `ask` endpoint (`/api/domains/check`), or Vercel Domains API.
- Add each verified domain to the server-action allowed origins (or forward `X-Forwarded-Host`).

## 5. Analytics (weeks 5–8)

- Privacy-light event table (`store_events`: view, add_to_cart, checkout_start, order) written server-side —
  no third-party trackers by default.
- Dashboard: visits → orders funnel, top products, revenue by city, repeat customers, WhatsApp-click rate.
- Optional per-store Meta Pixel / TikTok Pixel IDs for sellers running Instagram ads (behind consent).

## 6. Seller experience

- Order notifications to the seller's own WhatsApp via approved utility templates (`WhatsAppCloudNotifier`
  currently sends free-form text, which only works inside the 24 h window).
- Delivery company integrations (common Kurdistan/Iraq couriers): create shipment, label, status sync.
- ~~Product variants (size/colour) with per-variant stock.~~ Shipped (see "Shipped" below).
- ~~Discount codes, free-delivery thresholds, dashboard screen for codes~~ — shipped (v5); still to do: bundles.
- Multiple staff accounts per store with roles.
- ~~PWA install + push notifications for new orders.~~ Shipped (v3).

## 7. Platform & hardening

- ~~Nonce-based CSP (drop `'unsafe-inline'`).~~ Shipped: per-request nonce in `src/proxy.ts`, no `unsafe-inline` scripts.
- Image pipeline: resize/strip EXIF on upload (sharp or Cloudflare Images), responsive `srcset`.
- Redis (or Postgres advisory locks) if rate-limit write volume grows; queue (pg-boss) for notifications and
  payment reconciliation.
- Error monitoring (Sentry/GlitchTip) and uptime checks on `/api/health`.
- Playwright E2E in CI (mobile RTL viewports) in addition to the HTTP smoke test — the mobile spec exists
  (`e2e/`, `npm run test:mobile`); wiring it into CI is what's left.
- Full Kurmanji (kmr) translation by a native speaker; add Turkmen and Assyrian (Syriac) communities later.
- Billing: free tier + paid plan (FIB/ZainCash recurring or manual), plan limits.
