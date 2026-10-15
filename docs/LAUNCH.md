# Bazarga — launch checklist

FINAL deadlines (Abdulla, Oct 15): Sun 2026-10-18 full prototype live with seller + shopper e2e. Fri 2026-10-23 production at super quality; Thu 2026-10-22 freeze and bug bash.

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
- [x] Gallery design (Oct 15) · [x] Boutique (Oct 15) · [ ] Mono, Studio designs; theme thumbnails; one-click switch e2e

## Thu 15
- [x] /api/health (DB ping + build sha), structured logging (src/server/logger.ts) — error boundaries: see error pages
- [x] Transactional email provider interface: console | resend | brevo, env-gated (needs Abdulla: free Resend/Brevo key + EMAIL_FROM domain)
- [x] Idempotent orders (idempotency key, migration 0015), DB indexes (0015), docs/OPS.md backups + deploy runbook
- [x] Lighthouse 90+ (local prod build, mobile emulation, Oct 14): landing 90, pricing 92, store home 95; a11y 100/100/96, SEO 100, best-practices 100. Re-run against live domain on launch day. [ ] product page not yet measured
- [x] Plan gating UI + e2e (e2e/plan-gating.spec.mjs: Free cap 10 → add-product shows upgrade prompt → upgrade request filed)
- [x] Auth audit: hashed tokens, single-use reset (older links retired), sessions revoked on reset, rate limits per IP+email, security headers verified live; email verification (migration 0017, /verify-email, dashboard banner, localized mails)
- [ ] K7 multi-tenant domains (env-gated; needs Abdulla: root domain)

## Agent A queue
- [x] Legal pages (terms, privacy, refund live 200) · [x] 404/500/error pages · [x] Seller journey e2e (e2e/seller-journey.spec.mjs, browser, runs vs live via BASE_URL) · [x] SEO (sitemap, robots, OG image + metadata verified live Oct 14) · [~] axe pass (Oct 15: landing, pricing, login, signup, terms clean at 390 ku + 1280 en; open: store-home/product ghost wordmark contrast, flagged even with aria-hidden → move text to a CSS pseudo-element) · [x] skeletons (dashboard, 1f18d4b) · [ ] translation pass

## Thu 22 freeze / Fri 23 launch
- [x] Live e2e green Oct 15 on bazarga.vercel.app (seller-journey + plan-gating via proxy-aware Playwright config; mobile/legal/error/landing specs also pass live) · [ ] Thu 22: bug bash all routes x 4 locales x 360/390/1280

## Needs Abdulla
- Confirm the Max price ($100/mo, Hark's pick; one constant `MAX_MONTHLY_USD` in src/lib/plans.ts).
- Rasedi: KYC → test keys → set on Vercel (Production): `PAYMENTS_PROVIDER=rasedi`, `RASEDI_MODE=test`, `RASEDI_KEY_ID`, `RASEDI_PRIVATE_KEY`, `RASEDI_WEBHOOK_SECRET` (optional: `RASEDI_GATEWAYS`, `USD_IQD_RATE`=1310, `PLATFORM_COMMISSION_BPS`=0, `RASEDI_FEE_FROM_CUSTOMER`) → test payment → live keys + `RASEDI_MODE=live`. Steps + questions for Rasedi in docs/PAYMENTS.md.
- Domain, email provider key, Contabo VPS (when paying sellers), payment method accounts (FIB/ZainCash)
