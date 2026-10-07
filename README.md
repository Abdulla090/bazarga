# my market · فرۆشگاکەم

**Your store, in your language.** · **دوکانەکەت، بە زمانی خۆت.** · **متجرك، بلغتك.**

A Kurdish-first, zero-setup online store builder for Instagram and WhatsApp sellers in Kurdistan and Iraq.
A seller signs up, names the store, and gets a mobile storefront at `/s/<slug>` with delivery fees per city,
Cash on Delivery (plus FIB / ZainCash when connected), WhatsApp order hand-off, and a small trilingual dashboard.

| | |
|---|---|
| Stack | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · PostgreSQL + Drizzle ORM · Zod 4 · Tailwind CSS 4 · next-intl 4 |
| Locales | `ku` Sorani (default, RTL) · `ar` Arabic (RTL) · `en` English (LTR) · `kmr` Kurmanji (Latin, scaffolded) |
| Tests | Vitest (63 unit/integration tests on a real embedded Postgres) + an HTTP smoke test of the production build |
| Deploy | Docker / docker-compose (app + Postgres) on a VPS, or Vercel + Neon/Supabase + Cloudflare R2 |

---

## 1. Quick start (no Postgres or Docker needed)

```bash
npm install
cp .env.example .env.local      # defaults work as-is
npm run db:setup                # migrate + seed the demo store into an embedded Postgres (./.pglite)
npm run dev                     # http://localhost:3000
```

* Demo storefront: <http://localhost:3000/s/hawler-bazaar>
* Demo seller login: `demo@mymarket.app` / `mymarket-demo`
* Password-reset emails, OTP codes and "new order" notifications print to the server log (console adapters).

`DATABASE_URL=pglite://./.pglite` runs real PostgreSQL (PGlite, WebAssembly) in-process. It's a single-process
database: stop `npm run dev` before running `db:*` scripts against the same folder. In production, point
`DATABASE_URL` at a real Postgres.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / start (`npm run start:standalone` runs the standalone server) |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm test` | Vitest — every test file gets a fresh, fully-migrated in-memory Postgres |
| `npm run test:smoke` | HTTP end-to-end smoke test against a running build (`BASE_URL=…`) |
| `npm run db:generate` | Generate a new SQL migration from `src/server/db/schema.ts` (drizzle-kit) |
| `npm run db:migrate` | Apply migrations in `./drizzle` to `DATABASE_URL` |
| `npm run db:seed` | Seed the demo seller + "Hawler Bazaar" (idempotent) |

---

## 2. Environment variables

Everything is validated with Zod at first use (`src/server/env.ts`); the build never needs secrets.
See `.env.example` for a commented template.

### Required to run

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@host:5432/mymarket` | Neon/Supabase: add `?sslmode=require`. Dev/tests: `pglite://./.pglite` or `pglite://memory` |
| `APP_URL` | `https://mymarket.app` | Public base URL — used in reset links, payment return/callback URLs, notifications |

### Optional / per feature

| Area | Variables | Default |
|---|---|---|
| Core | `ROOT_DOMAIN` (storefront subdomains + allowed server-action origins), `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`, `LOG_LEVEL`, `DATABASE_POOL_MAX` | `mymarket.app`, `mm_session`, `30`, `info`, `10` |
| Storage | `STORAGE_DRIVER` (`local`\|`s3`), `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | `local`, `./uploads`, `5` |
| Email | `EMAIL_DRIVER` (`console`\|`resend`), `EMAIL_FROM`, `RESEND_API_KEY` | `console` |
| Notifications | `NOTIFY_CHANNELS` (`console,telegram,whatsapp,email`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`, `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` | `console` |
| OTP | `OTP_DRIVER` (`console` only in v1) | `console` |
| FIB | `FIB_ENABLED`, `FIB_BASE_URL`, `FIB_CLIENT_ID`, `FIB_CLIENT_SECRET` | off, sandbox `https://fib.stage.fib.iq` |
| ZainCash | `ZAINCASH_ENABLED`, `ZAINCASH_BASE_URL`, `ZAINCASH_CLIENT_ID`, `ZAINCASH_CLIENT_SECRET`, `ZAINCASH_API_KEY`, `ZAINCASH_SCOPE` | off, UAT `https://pg-api-uat.zaincash.iq`, `payment:read payment:write` |
| FastPay / Qi | `FASTPAY_ENABLED`, `QICARD_ENABLED` | stubs — always unavailable |
| AI builder | `AI_ENABLED`, `AI_PROVIDER` (`openai`\|`mock`), `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | off; `https://api.openai.com/v1`, `gpt-4o-mini` |
| Seed | `SEED_DEMO_EMAIL`, `SEED_DEMO_PASSWORD`; compose: `SEED_DEMO` | `demo@mymarket.app` / `mymarket-demo` |
| docker-compose | `POSTGRES_USER`, `POSTGRES_PASSWORD` (required), `POSTGRES_DB`, `APP_PORT` | |

**Keys you'll need for go-live:** a Postgres URL · an R2/S3 bucket + keys (`STORAGE_DRIVER=s3`) · a Resend
API key (password reset email) · FIB client id/secret (sandbox → production from integration@fib.iq) ·
ZainCash client id/secret + API key (UAT creds are public in their docs; production from your ZainCash account
manager) · optionally a Telegram bot token or WhatsApp Cloud API token for seller alerts · optionally an
OpenAI-compatible key for the photo-to-product builder.

---

## 3. Deploy

### A. Single VPS with docker-compose (recommended for Iraq-hosted or low-cost)

```bash
git clone <repo> mymarket && cd mymarket
cp .env.example .env
# edit .env: POSTGRES_PASSWORD, APP_URL=https://yourdomain, ROOT_DOMAIN, EMAIL_*, payment keys…
docker compose up -d --build
docker compose logs -f app
```

Services: `db` (Postgres 17, volume `pgdata`) → `migrate` (one-shot: `db:migrate` then the demo seed unless
`SEED_DEMO=false`) → `app` (Next.js standalone server on port 3000, volume `uploads` for local images,
container healthcheck on `/api/health`).

TLS + subdomain storefronts with Caddy (`/etc/caddy/Caddyfile`):

```caddy
mymarket.app, *.mymarket.app {
  tls you@example.com { dns cloudflare {env.CF_API_TOKEN} }   # wildcard certs need a DNS challenge
  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-Host {host}
  }
}
```

Back up with `docker compose exec db pg_dump -U mymarket mymarket > backup.sql` (cron it), and back up the
`uploads` volume — or switch to R2 (`STORAGE_DRIVER=s3`) so images live off-box.

### B. Vercel + Neon (or Supabase) + Cloudflare R2

1. Create a Neon/Supabase Postgres; copy the pooled connection string (`?sslmode=require`).
2. Run migrations from your machine or CI against the **direct** (non-pooler) URL: `DATABASE_URL=… npm run db:migrate:deploy` (and `db:seed` for the demo).
3. Create an R2 bucket with a public URL (custom domain or `r2.dev`) and an API token.
4. Import the repo in Vercel and set env vars: `DATABASE_URL`, `APP_URL`, `ROOT_DOMAIN`, `STORAGE_DRIVER=s3`,
   `R2_ACCOUNT_ID` (or `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`), `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, plus email/payment/AI keys.
5. For subdomain storefronts add the wildcard domain `*.mymarket.app` to the Vercel project.

Security: pages ship a per-request nonce CSP (no inline scripts), so every page renders dynamically.

Serverless note: the local-disk storage driver does not persist on Vercel — use `s3`. Keep `DATABASE_POOL_MAX`
low (e.g. `3`) with a pooled connection string.

---

## 4. Architecture

```
src/
  proxy.ts                    Next 16 proxy (ex-middleware): {slug}.ROOT_DOMAIN → /s/{slug}; tags storefront requests
  i18n/                       next-intl request config (cookie → store language → ku), message loading with en fallback
  app/
    (marketing)/              landing page + waitlist (saved to DB)
    (auth)/                   login, signup, forgot/reset password
    onboarding/               create store
    dashboard/                seller dashboard (mobile bottom nav, desktop sidebar)
    s/[slug]/                 storefront: grid, product page, cart+checkout, order confirmation
    api/
      health/                 liveness + DB check
      uploads/                seller image upload (session + Origin check)
      files/[...key]/         serves local-disk uploads
      ai/products-from-photos AI draft products
      payments/fib/callback   FIB status callback (re-fetches status from FIB)
      payments/zaincash/return  customer redirect back (JWT verify + inquiry)
      payments/zaincash/webhook ZainCash webhook (JWT verify, eventId dedupe)
  server/
    env.ts  logger.ts  errors.ts  http.ts  locale.ts
    db/                       Drizzle schema, client (pg | PGlite), migrator
    auth/                     scrypt passwords, DB sessions (hashed tokens), Postgres rate limiter, auth service, guards
    services/                 stores, catalog, settings (zones/payment toggles), orders (checkout/status/stats), waitlist
    payments/                 PaymentProvider interface · cod · fib · zaincash · stubs (fastpay, qicard) · service · registry
    notifications/            Notifier interface · console · telegram · whatsapp cloud · email
    email/  otp/  storage/  ai/
    actions/                  server actions (thin: auth guard → Zod → service)
  lib/                        shared pure code: i18n helpers, money, phone, slug, cities, totals, validation (Zod), wa.me
messages/                     ku.json · ar.json · en.json (identical keys, test-enforced) · kmr.json (partial)
drizzle/                      SQL migrations
scripts/                      migrate.ts · seed.ts · smoke.mjs
tests/                        vitest suites (+ support/db.ts: per-file migrated PGlite)
```

**Request flow.** Pages are server components that call services directly. Mutations are server actions:
`requireStore()` resolves the session cookie → user → their store; the action parses input with Zod and
calls a service with `store.id`. Services take `(db, storeId, …)` and scope every query by `store_id`, so
tenant isolation lives in one layer and is unit-tested against a real Postgres.

**Data model** (`src/server/db/schema.ts`): `users`, `sessions` (sha256 of the token), `password_reset_tokens`,
`rate_limits`, `stores` (slug, default locale, WhatsApp, per-store order counter, future `custom_domain`),
`categories`, `products` (jsonb `{ku,ar,en,kmr}` name/description, integer IQD `price`/`compare_at_price`,
nullable `stock` = untracked, CHECK `stock >= 0`), `product_images`, `delivery_zones` (city key → fee),
`store_payment_methods`, `customers`, `orders` (unguessable `public_id`, money snapshot), `order_items`
(name/price snapshot), `order_events` (status history), `payment_transactions` (unique `(provider, provider_ref)`),
`webhook_events`, `waitlist`.

**Checkout** (`placeOrder` in `src/server/services/orders.ts`), in one transaction: check the payment method is
enabled (and configured, for online ones) → load the zone fee → re-price every line from the DB (client prices
are ignored) → merge duplicate lines → decrement stock with `UPDATE … SET stock = stock - q WHERE stock >= q`
(zero rows → `OUT_OF_STOCK`, whole transaction rolls back) → allocate the per-store order number → upsert the
customer → insert order, items and the first status event. After the response, the seller is notified via
`after()`. The confirmation page builds a `wa.me` link to the seller pre-filled with the order summary in the
customer's language.

**Order status flow:** `new → confirmed → out_for_delivery → delivered`, and `cancelled` from any open state.
Cancelling restocks tracked items; delivering a COD order marks it paid. Updates use optimistic concurrency.

**Payments.** `PaymentProvider { isConfigured(), createPayment(ctx), fetchStatus?(ref) }`.
`startPayment` records a pending `payment_transactions` row; `applyPaymentStatus` is idempotent (only allowed
transitions change anything, a paid order is never downgraded by a stale failure) and is what every callback calls.

**i18n / RTL.** No locale in URLs (storefront links stay short for Instagram bios). Locale = visitor cookie →
the store's language on storefront pages → `ku`. `<html lang dir>` follows the locale; layouts use logical
properties (`ms-`, `me-`, `start-`, `text-end`) so RTL/LTR flip without separate styles. Numbers and phone
numbers are wrapped in `.num` (Inter, `unicode-bidi: isolate`). Fonts are self-hosted via Fontsource
(Vazirmatn + Inter) — no Google Fonts request at build or runtime.

---

## 5. Security & operations

* **Validation:** Zod on every server action, route handler and webhook (`src/lib/validation.ts`).
* **Auth:** scrypt password hashing (Node built-in, no native addon); DB-backed sessions, only the sha256 of the
  token is stored; httpOnly + SameSite=Lax (+ Secure in production) cookie; sliding expiry; all sessions revoked on
  password reset; reset tokens are single-use, 1-hour, hashed; login timing equalised for unknown emails; reset
  never reveals whether an email exists.
* **Rate limiting:** Postgres fixed-window limiter (works across instances) on login (per IP and per email),
  signup, forgot/reset password, waitlist, checkout, uploads, AI and payment checks.
* **Tenant isolation:** store id always comes from the session, never the client; covered by `tests/tenant-isolation.test.ts`.
* **CSRF:** server actions use Next's Origin check (`serverActions.allowedOrigins` = `ROOT_DOMAIN` + subdomains);
  cookie-authenticated route handlers (`/api/uploads`, `/api/ai/*`) enforce a same-origin check (`src/server/http.ts`).
* **Headers:** CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP (`next.config.ts`).
  CSP still allows `'unsafe-inline'` scripts (Next inline bootstrap) — nonce-based CSP is on the roadmap.
* **Uploads:** type detected from magic bytes (JPEG/PNG/WebP only, SVG rejected), size limit `MAX_UPLOAD_MB`,
  random keys under `stores/<storeId>/`, served with `nosniff` + sandbox CSP.
* **Logging:** JSON-lines to stdout with secret-field redaction (`src/server/logger.ts`).
* **Health:** `GET /api/health` → `200 {status:"ok",db:"ok"}` or `503`.

---

## 6. What's complete, what's stubbed

| Feature | Status |
|---|---|
| Landing page (hero, how it works, live sample, why us, who it's for, waitlist → DB) | ✅ |
| Email + password auth, logout, password reset (console / Resend), sessions, rate limits | ✅ |
| Phone / WhatsApp OTP | 🟡 `OtpProvider` interface + console stub (`src/server/otp`) |
| Stores, onboarding, settings (logo, tagline, WhatsApp, Instagram, city, language) | ✅ |
| Subdomain storefronts `{slug}.ROOT_DOMAIN` | ✅ in proxy (needs wildcard DNS/TLS) |
| Custom domains | 🟡 `stores.custom_domain` column + TODO in `src/proxy.ts` |
| Products CRUD (4-language name/description, IQD price, compare-at, stock, category, images, active) | ✅ |
| Categories, delivery zones (9 seeded Iraqi cities, editable/addable), payment toggles | ✅ |
| Orders list/detail, status flow + history, customers list, stats (orders today, 7-day revenue, open) | ✅ |
| Storefront grid, product page, cart (server-priced), checkout, confirmation, WhatsApp deep link | ✅ |
| Transactional stock decrement + restock on cancel | ✅ |
| Cash on Delivery | ✅ |
| FIB | 🟢 implemented from public docs (OAuth2 client credentials, create payment → QR/app links, status, cancel, callback re-verification). Needs sandbox credentials to validate end-to-end. `redirectUri` is marked TODO(verify). |
| ZainCash (Payment Gateway v2) | 🟢 implemented from docs.zaincash.iq (OAuth2, transaction/init → redirect, inquiry, HS256 redirect token + webhook with eventId dedupe). Response/claim field names are read defensively and marked TODO(verify) because the docs' sample JSON isn't public-readable. |
| FastPay, Qi Card | 🔴 stubs with TODOs (merchant APIs are not publicly documented) |
| Notifications (console, Telegram, WhatsApp Cloud API, email) on new order | ✅ (WhatsApp business-initiated messages need an approved template — TODO noted) |
| AI "createProductsFromPhotos" (endpoint + dashboard review/confirm UI, OpenAI-compatible vision, mock provider) | ✅ behind `AI_ENABLED` |
| Kurmanji (kmr) | 🟡 scaffold: partial strings, falls back to English; needs native translation |
| Docker, docker-compose, CI (lint, typecheck, test, build, smoke, docker build) | ✅ |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what comes next.

---

## 7. Testing

```bash
npm test                         # 63 tests, ~10 s
npm run build && npm run db:setup && (npm start &) && BASE_URL=http://localhost:3000 npm run test:smoke
```

* `tests/checkout.test.ts` — order totals (DB prices, zone fees, tampering ignored), sequential numbering, payment
  method gating, customer upsert, stock decrement, rollback on short stock, **no oversell under concurrent
  checkouts**, restock on cancel, status flow, quote, stats, Iraq-day boundaries.
* `tests/tenant-isolation.test.ts` — seller B cannot read/update/delete A's products, categories, zones, orders,
  customers, cannot buy A's products through B's storefront, cannot take A's slug.
* `tests/auth.test.ts` — hashing, signup/login, sessions, reset flow (single use, revokes sessions), rate limits.
* `tests/payments.test.ts` — FIB and ZainCash adapters against mocked HTTP, idempotent status application, JWT
  verification, webhook dedupe.
* `tests/lib.test.ts` — phone normalisation (incl. Eastern-Arabic digits), slugs, wa.me builder, i18n fallbacks,
  **ku/ar/en message key parity**, Zod schemas, image sniffing, AI draft parsing.
* `scripts/smoke.mjs` — drives the real production server over HTTP, including server actions.
