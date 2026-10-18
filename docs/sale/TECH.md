# Reelcart — technical overview

Counted from the repository on 2026-10-18 (`main`).

## At a glance

| Metric | Value |
|---|---|
| Application code (`src/`, TypeScript + TSX) | **29,713 lines** in 393 files (13,969 lines of TSX UI) + 1,569 lines CSS |
| Test code (`tests/`, `e2e/`) | 11,267 lines |
| Pages (routes with UI) | **42** (marketing 8, auth 5, storefront 5, dashboard 20, admin, onboarding, payment return, 404) |
| API routes | **21** (health, uploads, files, orders, payments + webhook, cron, share/QR, analytics beacon, CSP report, AI, …) |
| Server actions modules | 13 |
| React components | 100 (`src/components`) |
| Database tables | **37**, 25 SQL migrations (additive only) |
| Locales | **4** — Sorani `ku` (default, RTL), Kurmanji `kmr`, Arabic `ar` (RTL), English `en`; ~1,500 lines each, 6,049 total |
| Theme presets | **10** (Studio, Ivory, Midnight, Gallery, Boutique, Stone, Mono, Editorial, Market, Fresh) on 7 layout designs |
| Unit / integration tests | **725 Vitest tests** in 91 files, each file on a fresh migrated Postgres (PGlite) |
| End-to-end tests | **60 Playwright tests** in 17 specs (seller journey, social-first, plan gating, checkout, mobile, legal/SEO, security abuse, pixels, waitlist…); runnable against the live site |
| npm audit (production deps) | 0 known vulnerabilities (Oct 14) |

## Stack
- **Next.js 16** (App Router, React Server Components, server actions, Turbopack) · **React 19** · **TypeScript strict** (`noUncheckedIndexedAccess`)
- **PostgreSQL** via **Drizzle ORM**; PGlite (embedded Postgres) for zero-setup local dev and tests
- **Zod 4** validation for env and every input · **Tailwind CSS 4** · **next-intl 4**
- **sharp** image pipeline (WebP renditions 320/480/640/1024/1280 + blur placeholder), `uqr` for QR codes, `web-push`, `jose` (JWT for gateways)
- Only 15 runtime dependencies; no paid SDKs. Each external service is plain `fetch` behind an interface with a free fallback.

## Architecture

```
Browser (shopper / seller)
   │  HTTPS, strict CSP nonce
   ▼
Vercel (fra1) ─ src/proxy.ts: locale, store subdomains → /s/<slug>, security headers, ?src capture
   │
   ├─ Server Components pages (src/app)          ─┐
   ├─ Server actions (src/server/actions)          ├─► services (src/server/services) ─► Drizzle ─► Postgres (Supabase)
   ├─ API routes (src/app/api)                    ─┘                     │
   │                                                                      ├─► storage driver: Supabase Storage | R2/S3 | local disk
   │                                                                      ├─► email: console | Resend | Brevo
   │                                                                      ├─► notify: console | Telegram | WhatsApp Cloud | email | web push
   │                                                                      └─► payments: none | Rasedi (FIB, ZainCash, AsiaPay, NassWallet, cards)
   └─ Cron: vercel.json daily 03:00 UTC → /api/cron/daily (plan expiry, payment reconcile, pruning)
```

Multi-tenant: one database, every store-owned row carries `store_id`, and every query is scoped by the signed-in
seller's store. Stores are served at `/s/<slug>` or `<slug>.ROOT_DOMAIN`.

## Folder map

| Path | What lives there |
|---|---|
| `src/app/(marketing)` | Landing, pricing, showcase, status, legal, waitlist |
| `src/app/(auth)` | Login, signup, forgot/reset password, verify email |
| `src/app/s/[slug]` | Storefront: home, product, cart/checkout, order confirmation, tracking |
| `src/app/dashboard` | Seller dashboard (20 screens) · `src/app/admin` platform admin · `src/app/onboarding` |
| `src/app/api` | Route handlers (health, uploads, orders, payments, cron, share, analytics beacon…) |
| `src/components` | UI: `store/`, `dashboard/`, `marketing/`, `charts/`, `pricing/`, `ui/`, `pwa/` |
| `src/lib` | Pure logic: money, totals, discounts, phone, variants, theme studio, analytics math, share kit, CSV, SEO |
| `src/server` | Server-only: `db/` (schema, migrations runner), `services/`, `actions/`, `auth/`, `payments/`, `storage/`, `email/`, `notifications/`, `push/`, `ai/`, logger, env, CSP |
| `messages/` | Translations: `ku.json`, `kmr.json`, `ar.json`, `en.json` |
| `drizzle/` | 25 SQL migrations |
| `scripts/` | migrate, seed (demo store), image backfill, payment reconcile, smoke test, bug-bash crawler, load burst |
| `tests/` · `e2e/` | Vitest · Playwright |
| `docs/` | Setup, ops, payments, capacity, performance, design, roadmap, sale kit |
| `Dockerfile`, `docker-compose.yml` | Self-hosting on any VPS (app + Postgres + one-shot migrate) |

## Data model (37 tables)

| Area | Tables |
|---|---|
| Accounts & auth | `users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`, `rate_limits`, `audit_log` |
| Stores & catalog | `stores`, `categories`, `products`, `product_images`, `product_options`, `product_option_values`, `product_variants` |
| Delivery | `governorates`, `delivery_zones`, `delivery_areas` |
| Selling | `customers`, `orders`, `order_items`, `order_events`, `discount_codes`, `store_blocked_phones`, `store_payment_methods` |
| Analytics | `store_page_views` (daily aggregate counters, including `src:<platform>` arrivals) |
| Plans & growth | `store_plan_history`, `upgrade_requests`, `product_studio_usage`, `waitlist`, `testimonials`, `push_subscriptions` |
| Payments | `payments`, `payment_events`, `payment_transactions`, `webhook_events`, `seller_payout_profiles`, `payouts`, `ledger_entries` |

Localized text (product names, descriptions, specs) is stored as JSON per language. Money is integer IQD.
Migrations are additive only, so a running deployment keeps working while the next one migrates.

## Security measures
- Passwords: scrypt (memory-hard, Node built-in). Reset and verification tokens stored hashed, single-use, expiring; all sessions revoked on reset
- Sessions: random tokens, httpOnly + Secure + SameSite cookies, server-side session table
- Rate limits (Postgres-backed) on every public POST; a test fails if a new public endpoint lacks one
- CSP with per-request nonce + `strict-dynamic`, no `unsafe-inline` scripts; HSTS 2y preload; `frame-ancestors 'self'`; nosniff; Referrer-Policy; Permissions-Policy; COOP; Origin-Agent-Cluster; CSP violation reporting endpoint
- Zod validation on all inputs; tenant scoping on every store query; idempotency keys on orders; honeypot on checkout
- Payments: Ed25519-signed gateway requests, webhook secret + event dedupe, status re-verified with the gateway before marking paid, row locks in one transaction
- Upload validation (type, size), images re-encoded by sharp (strips metadata)
- Secrets only in environment variables; logs redact secrets; `/api/health` shows names/booleans only
- Audit log of settings changes; e2e security/abuse specs (`e2e/audit-security`, `e2e/audit-abuse`)

## Performance
- Lighthouse, live site, mobile (Oct 18): landing 93–95, store 83–92, product 78–92; accessibility 96–100, SEO 100, best practices 100 (docs/LAUNCH.md, docs/PERFORMANCE.md)
- JS budgets enforced by `npm run budget`: storefront ≤165 KiB, dashboard ≤200 KiB gzipped first load
- Images: browser pre-compression (a 1.35 MB phone photo → ~240 KB before upload), ~82 KB per image across all renditions, responsive `srcset`, LQIP placeholders
- Cached catalog per store with tag invalidation; DB indexes on hot paths; health check DB latency ~25 ms

## Hosting costs
| Stage | Setup | Cost |
|---|---|---|
| Launch (now) | Vercel Hobby + Supabase Free (500 MB DB, 1 GB photos) | **$0 / month** — fits roughly the first 4,000 products |
| Growth | Supabase Pro + Cloudflare R2 for photos | ~$25/month + R2 ≈ $0.23/month for 100 sellers × 1,000 products (docs/CAPACITY.md) |
| Lean at scale | One VPS (~€5.50/month, e.g. Contabo) running the Docker image + Postgres, photos on R2 | **≈ €5.50/month + R2 cents**; Vercel Pro ($20/mo) needed only if you stay on Vercel commercially |

Domain (~$10–15/year), email (free tiers: Resend 3,000/mo, Brevo 300/day) and the cron pinger (cron-job.org, free)
add little or nothing. Vercel's Hobby plan is for non-commercial use; a revenue-generating platform should move
to Vercel Pro or the VPS path.

## Tests and quality gates
- `npm test` — 725 Vitest tests (services against a real embedded Postgres, pure logic, i18n parity, security headers, rate-limit coverage, env completeness)
- `npm run test:mobile` / `npm run test:live` — 60 Playwright tests (local build or the live site)
- `npm run test:smoke` — HTTP smoke of a production build; `npm run budget` — bundle budgets
- `npm run typecheck`, `npm run lint` — strict TypeScript, ESLint (Next core-web-vitals)
