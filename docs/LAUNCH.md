# Reelcart — launch checklist

FINAL deadlines (Abdulla, Oct 15): Sun 2026-10-18 full prototype live with seller + shopper e2e. Fri 2026-10-30 production at super quality; Thu 2026-10-29 freeze and bug bash. Demand track: docs/DEMAND.md.

## Done
- [x] K1 persistent uploads (Supabase Storage driver)
- [x] K2 DB TLS with bundled Supabase root CA
- [x] K3 plans model + Free limits, demo store on Pro
- [x] Pricing v2 (Oct 14): Free $0/10 products · Pro $15 ($1 first month)/100 · Business $50/unlimited · Max $100/unlimited; yearly 2 months free; Product Studio quota 0/10/100/100 (docs/PRICING.md)
- [x] Live test deploy on Vercel (bazarga.vercel.app)
- [x] Pricing page, hero, dashboard, auth, onboarding

## Wed 14
- [x] K4 upgrade requests (/dashboard/upgrade) + /admin (ADMIN_EMAILS; needs Abdulla to set ADMIN_EMAILS on Vercel)
- [x] K5 cron: /api/cron/daily (plan expiry + payments) + vercel.json daily; CRON_SECRET set on Vercel
- [x] K6a audit log (migration 0013) for settings changes; rate limits already on auth, checkout, track, uploads
- [x] Rasedi payment gateway architecture (migration 0014, docs/PAYMENTS.md) — merged OFF (`PAYMENTS_PROVIDER` unset)
- [x] K6b sharp 0.34 → 0.35.5, `npm audit --omit=dev` = 0 vulnerabilities (7dc22d1)
- [x] Gallery design (Oct 15) · [x] Boutique (Oct 15) · [x] Mono (Oct 15) · [x] Studio design; theme thumbnails; one-click switch e2e (6ed7a07; local seeded flow + 390 ku/1280 en screenshots)

## Thu 15
- [x] /api/health (DB ping + build sha), structured logging (src/server/logger.ts) — error boundaries: see error pages
- [x] Transactional email provider interface: console | resend | brevo, env-gated (needs Abdulla: free Resend/Brevo key + EMAIL_FROM domain)
- [x] Idempotent orders (idempotency key, migration 0015), DB indexes (0015), docs/OPS.md backups + deploy runbook
- [x] Lighthouse 90+ (local prod build, mobile emulation, Oct 14): landing 90, pricing 92, store home 95; a11y 100/100/96, SEO 100, best-practices 100. Re-run against live domain on launch day. product page measured Oct 15 (local prod build, mobile emulation, noisy sandbox): perf 87–90 (LCP ~3.5 s is main-thread render delay, not the image; store home measured 88 in the same run), a11y 100, SEO 100, best-practices 100. Perf 90+ still borderline: [ ] trim shared client JS / render-blocking CSS. Oct 18 live (mobile, comparable CPU): landing 93–95, store 83–92, product 78–92 after the logo fix (was 76/76); TBT is react-dom + Next runtime hydration, LCP 3.1–3.3 s.
- [x] Plan gating UI + e2e (e2e/plan-gating.spec.mjs: Free cap 10 → add-product shows upgrade prompt → upgrade request filed)
- [x] Auth audit: hashed tokens, single-use reset (older links retired), sessions revoked on reset, rate limits per IP+email, security headers verified live; email verification (migration 0017, /verify-email, dashboard banner, localized mails)
- [x] K7a store subdomains env-gated (`ROOT_DOMAIN`, see Integrations below) · [ ] K7b seller custom domains (verified `stores.custom_domain`; needs Abdulla: root domain first)

## Agent A queue
- [x] Legal pages (terms, privacy, refund live 200) · [x] 404/500/error pages · [x] Seller journey e2e (e2e/seller-journey.spec.mjs, browser, runs vs live via BASE_URL) · [x] SEO (sitemap, robots, OG image + metadata verified live Oct 14) · [x] axe pass (Oct 15, live: landing, pricing, login, signup, terms, store home, product clean at 390 ku + 1280 en; sign-off wordmark moved to a CSS pseudo-element, struck compare-at price uses text-muted) · [x] skeletons (dashboard, 1f18d4b) · [x] translation pass (Agent A, merged e6e7a59)

## Social-first (Oct 15)
- [x] S1–S6 all shipped and live; live e2e green Oct 15 22:2x on bazarga.vercel.app: social-first (share modal, ?src order → seller sees TikTok, OG card PNG), pixels, seller-journey, plan-gating

## Thu 29 freeze / Fri 30 launch
- [x] Live e2e green Oct 15 on bazarga.vercel.app (seller-journey + plan-gating via proxy-aware Playwright config; mobile/legal/error/landing specs also pass live) · [x] Bug bash pass 1 Oct 16 (live crawl all public + dashboard routes x 4 locales x 3 widths: clean after tap-target fixes) · [ ] Thu 29: final bug bash after freeze (scripts/bugbash.mjs)

## Integrations (plug-and-play, env-gated)
Every external service is off or on a free fallback until its env is set on Vercel (Production). No code change, no
paid SDK. `GET /api/health` → `integrations` shows which driver is live (names/booleans only). Tests:
tests/integrations.test.ts (+ tests/deploy.test.ts, tests/launch-ops.test.ts). Live today (Oct 18): storage
`supabase`, email `console`, cron on, subdomains off.

### Image storage — Cloudflare R2 (or any S3)
| Env | Value |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account id (endpoint becomes `https://<id>.r2.cloudflarestorage.com`) |
| `R2_BUCKET` | bucket name, e.g. `bazarga-images` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token (Object Read & Write, this bucket only) |
| `R2_PUBLIC_URL` | public base, e.g. `https://pub-xxxx.r2.dev` or `https://img.<domain>` |
| `STORAGE_DRIVER` | optional: `r2`/`s3`, `supabase`, `local`. Unset = R2 when the four values above are complete, else Supabase on Vercel, else disk |

The S3_* names (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`) still work and win.
Fallback: `STORAGE_DRIVER=r2` with a missing value uses Supabase Storage (log `storage.fallback`, health
`storage.fallback: true`) instead of failing uploads. Existing images keep their stored URLs; only new uploads move.

### Transactional email — Resend or Brevo
| Env | Value |
|---|---|
| `EMAIL_PROVIDER` | `resend` (free 3,000/mo) or `brevo` (free 300/day); unset = `console` (mail written to the log) |
| `EMAIL_API_KEY` | the provider key (`RESEND_API_KEY` / `BREVO_API_KEY` also work) |
| `EMAIL_FROM` | `Reelcart <hello@<verified-domain>>`; the domain must be verified at the provider (SPF + DKIM) |

A provider without a key falls back to console and logs `email.provider_key_missing`. Plain `fetch`, 10 s timeout.
`EMAIL_DRIVER` is the old name of `EMAIL_PROVIDER`.

### Cron — `CRON_SECRET`
`CRON_SECRET` (16+ chars, set on Vercel) protects every cron route: unset → 404, wrong/missing
`Authorization: Bearer <CRON_SECRET>` → 401. Source of truth: `src/lib/cron-routes.ts`. External pinger list
(cron-job.org free, header `Authorization: Bearer <CRON_SECRET>`):

| URL | Method | Schedule |
|---|---|---|
| `https://bazarga.vercel.app/api/cron/daily` | GET | daily 03:00 UTC (also in vercel.json, so optional) |
| `https://bazarga.vercel.app/api/cron/payments` | GET or POST | every 5 min, only once online payments are on |

After a domain move, swap `https://bazarga.vercel.app` for the new `APP_URL`.

### Custom domain / store subdomains
| Env | Value |
|---|---|
| `APP_URL` | `https://<domain>` (canonical, emails, share links) |
| `ROOT_DOMAIN` | `<domain>`; turns on `<slug>.<domain>` → `/s/<slug>`. Unset = off (stores at `APP_URL/s/<slug>`) |
| `STORE_SUBDOMAINS` | `false` = kill switch for subdomain routing while keeping `ROOT_DOMAIN` |

Needs: domain added to the Vercel project, plus `*.<domain>` wildcard (Vercel nameservers for the wildcard cert).
Reserved labels (www, app, api, admin, static, mail, status, cdn, img) never resolve to a store. Logic:
`src/lib/domains.ts`. Before Oct 18 `ROOT_DOMAIN` defaulted to `mymarket.app`; there is no default now.

### Error + security reporting
| Env | Value |
|---|---|
| `LOG_WEBHOOK_URL` | optional HTTPS webhook; every `error` log line is also POSTed there (redacted). Discord/Slack webhooks get a one-line message, any other URL the JSON event. Max 20/min per instance. Unset = stdout only |

Every server error already logs one JSON line (`request.error`, with the digest users see on error pages) via
`src/instrumentation.ts` → `src/server/logger.ts`. CSP violations are reported by browsers to `/api/csp-report`
(`report-uri` + `report-to` with the `Reporting-Endpoints` header) and logged as `csp.violation` (origin-only URLs,
30 / 10 min per IP). Headers live: CSP (nonce + strict-dynamic, worker-src/manifest-src explicit), HSTS 2 years +
preload, X-Frame-Options SAMEORIGIN + frame-ancestors 'self', nosniff, Referrer-Policy, Permissions-Policy, COOP,
Origin-Agent-Cluster. Tests: tests/security-reporting.test.ts, tests/security-headers.test.ts.

## Needs Abdulla
- Confirm the Max price ($100/mo, Hark's pick; one constant `MAX_MONTHLY_USD` in src/lib/plans.ts).
- Rasedi: KYC → test keys → set on Vercel (Production): `PAYMENTS_PROVIDER=rasedi`, `RASEDI_MODE=test`, `RASEDI_KEY_ID`, `RASEDI_PRIVATE_KEY`, `RASEDI_WEBHOOK_SECRET` (optional: `RASEDI_GATEWAYS`, `USD_IQD_RATE`=1310, `PLATFORM_COMMISSION_BPS`=0, `RASEDI_FEE_FROM_CUSTOMER`) → test payment → live keys + `RASEDI_MODE=live`. Steps + questions for Rasedi in docs/PAYMENTS.md.
- Domain, email provider key, Contabo VPS (when paying sellers), payment method accounts (FIB/ZainCash)
- R2 (Oct 18, in progress): bucket `bazarga-uploads` + token → set on Vercel Production `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=bazarga-uploads`, `R2_PUBLIC_URL` (r2.dev public URL or custom image domain; the bucket needs public read for that URL) → redeploy → `/api/health` shows `storage.driver: "s3"` → upload one product photo.
- Email: Resend or Brevo free key + verified sending domain → `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`.
- External cron pinger (cron-job.org free) for `/api/cron/payments` every 5 min once payments are on; optional `LOG_WEBHOOK_URL` (Discord/Slack webhook).
