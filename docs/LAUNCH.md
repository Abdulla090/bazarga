# Bazarga — launch checklist (deadline Fri 2026-10-16, end of day Asia/Baghdad)

## Done
- [x] K1 persistent uploads (Supabase Storage driver)
- [x] K2 DB TLS with bundled Supabase root CA
- [x] K3 plans model + Free limits (15 products), demo store on Pro
- [x] Live test deploy on Vercel (bazarga.vercel.app)
- [x] Pricing page, hero, dashboard, auth, onboarding

## Wed 14
- [x] K4 upgrade requests (/dashboard/upgrade) + /admin (ADMIN_EMAILS; needs Abdulla to set ADMIN_EMAILS on Vercel)
- [x] K5 cron: /api/cron/daily (plan expiry + payments) + vercel.json daily; CRON_SECRET set on Vercel
- [x] K6a audit log (migration 0013) for settings changes; rate limits already on auth, checkout, track, uploads
- [x] Rasedi payment gateway architecture (migration 0014, docs/PAYMENTS.md) — merged OFF (`PAYMENTS_PROVIDER` unset)
- [ ] K6b npm audit review
- [ ] Themes Gallery, Boutique, Mono, Studio; theme thumbnails; one-click switch e2e

## Thu 15
- [ ] /api/health, structured logging, error boundary
- [ ] Transactional email provider interface (needs Abdulla: free Resend/Brevo key)
- [ ] Idempotent orders, DB indexes, docs/OPS.md backups
- [ ] Lighthouse 90+ (store home, product, landing, pricing)
- [ ] K7 multi-tenant domains (env-gated; needs Abdulla: root domain)

## Agent A queue
- [ ] Legal pages (4 locales) · [ ] 404/500/error pages · [ ] Seller journey e2e · [ ] SEO · [ ] a11y · [ ] skeletons · [ ] translation pass

## Fri 16 freeze
- [ ] Bug bash all routes x 4 locales x 360/390/1280 · [ ] full e2e green

## Needs Abdulla
- Rasedi: KYC → test keys → set on Vercel (Production): `PAYMENTS_PROVIDER=rasedi`, `RASEDI_MODE=test`, `RASEDI_KEY_ID`, `RASEDI_PRIVATE_KEY`, `RASEDI_WEBHOOK_SECRET` (optional: `RASEDI_GATEWAYS`, `USD_IQD_RATE`=1310, `PLATFORM_COMMISSION_BPS`=0, `RASEDI_FEE_FROM_CUSTOMER`) → test payment → live keys + `RASEDI_MODE=live`. Steps + questions for Rasedi in docs/PAYMENTS.md.
- Domain, email provider key, Contabo VPS (when paying sellers), payment method accounts (FIB/ZainCash)
