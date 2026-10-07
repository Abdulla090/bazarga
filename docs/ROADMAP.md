# my market — Roadmap after v1

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

**Still open from this batch**
- Dashboard UI for managing discount codes and delivery areas.
- Legacy customer phones are stored as `9647…`; new checkouts store `+9647…`. A one-off migration to
  `+`-prefix existing `customers.phone` / `orders.customer_phone` would keep repeat-customer matching exact.
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
- ~~Discount codes, free-delivery thresholds~~ — shipped at checkout; still to do: a dashboard screen to
  create/edit/deactivate codes (codes are rows in `discount_codes`, seeded/inserted directly for now), bundles.
- Multiple staff accounts per store with roles.
- PWA install + push notifications for new orders.

## 7. Platform & hardening

- Nonce-based CSP (drop `'unsafe-inline'`).
- Image pipeline: resize/strip EXIF on upload (sharp or Cloudflare Images), responsive `srcset`.
- Redis (or Postgres advisory locks) if rate-limit write volume grows; queue (pg-boss) for notifications and
  payment reconciliation.
- Error monitoring (Sentry/GlitchTip) and uptime checks on `/api/health`.
- Playwright E2E in CI (mobile RTL viewports) in addition to the HTTP smoke test.
- Full Kurmanji (kmr) translation by a native speaker; add Turkmen and Assyrian (Syriac) communities later.
- Billing: free tier + paid plan (FIB/ZainCash recurring or manual), plan limits.
