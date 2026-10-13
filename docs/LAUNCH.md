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
- [ ] K6 rate limits, audit log, security headers, npm audit
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
- Domain, email provider key, Contabo VPS (when paying sellers), payment method accounts (FIB/ZainCash)
