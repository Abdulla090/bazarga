# Reelcart backlog (top unfinished first)

## OWNER ADMIN CONSOLE (Abdulla Oct 18 21:01, subagent; docs/ADMIN.md)
- [x] A1. Security + audit + overview: DB roles (owner/admin) + ADMIN_EMAILS guard on every page/route/action, step-up confirmations, admin_audit (0030), admin rate limits, noindex, time-limited audited impersonation; Overview KPIs/charts/health
- [x] A2. Users: search/filter/paginate, inline edit, verify, force logout, suspend/ban/unban, delete, promote/demote, view-as
- [x] A3. Stores + plans: edit settings, plan grant/extend/comp, overrides (products/studio/AI/seats/stores) enforced server-side, suspend page, transfer, feature, reset theme, delete; plan matrix + upgrade requests
- [x] A4. Moderation + site: products hide/delete, orders status, CSV exports; maintenance mode, feature flags, 4-locale announcement, featured stores, email subjects
- [x] A5. Palette (Ctrl/⌘ K, g-shortcuts, /), toasts, optimistic toggles, bulk actions, 412 px
- [ ] A6. SF9/SF10 owners: gate Product Studio and the AI Website Designer on `flagOn(db(), "productStudio")` / `flagOn(db(), "aiDesigner")` (src/server/services/platform-settings.ts); the flags already exist in Admin → Site controls
- [ ] A7. Before sale / real launch: remove SEED_ADMIN_EMAIL=demo@mymarket.app from Vercel and demote the demo account in Admin → Admin team (its password is public)

## SOON FEATURES (Abdulla Oct 18 18:35, owned by subagent until marked done)
Hourly loop: do NOT take these items; a dedicated subagent ships them easiest first (branches agentb/soon-<name>).
- [x] SF1. Bulk CSV import: verify live, drop "Soon" tag (pricing + plan features, 4 locales), gate to Business+
- [x] SF2. Advanced SEO + white-label (Max): per-store meta title/description, OG image, product meta, per-store sitemap, JSON-LD Product/Store; "hide Made with Reelcart badge" toggle (Max)
- [x] SF3. Multiple stores per account (Business 3 / Max 5): store switcher, create-store flow, server-side limits, current-store context
- [x] SF4. Team members (Pro 2 / Business 5 / Max 10): store_members migration, owner/staff roles, email/copy-link invites, accept, remove, permission checks, seat limits
- [x] SF5. AI product descriptions (Business+): title/description/tags in store language, env-gated provider, monthly quota + rate limit
- [x] SF6. Premium templates / exclusive designs (Max): 2-3 premium Theme Studio presets with upgrade preview
- [x] SF7. Custom domain per seller (Business+): DNS instructions, verify, optional Vercel API, SETUP.md
- [x] SF8. Sign in with WhatsApp (phone OTP): env-gated OtpProvider + mock provider (live stays "coming soon" until WHATSAPP_* or TWILIO_* is set)
- [x] SF9. Product Studio (photo cleanup, quota 10/100/100): in-browser cleanup + optional remove.bg (REMOVE_BG_API_KEY), product_studio_usage quota server-side; "Soon" tag removed (priority Studio on Max stays Soon)
- [ ] SF10. AI Website Designer (Max): brand brief -> Theme Studio draft, preview, publish (owned by subagent)
Out of scope: online payments (src/server/payments/**, migration 0014, Rasedi env).

## SALE-READY (Abdulla Oct 18 — top priority)
Goal: a buyer who barely codes can understand, run and launch Reelcart with their own keys. Hourly loop: take the top unchecked item.
- [x] S1. docs/BACKLOG.md sale section (this list)
- [x] S2. README.md rewritten buyer-facing (what it is, live demo + login, grouped features, stack, Deploy in 15 minutes); old dev README moved to docs/DEVELOPERS.md
- [x] S3. Real Deploy-to-Vercel button (env APP_URL, CRON_SECRET, ADMIN_EMAILS, SEED_DEMO + Supabase Marketplace store); vercel.json buildCommand = migrate + seed + build so a fresh project self-initialises
- [x] S4. docs/SETUP.md no-code guide: deploy, Supabase, required env, R2, email, domain + wildcard, Rasedi, cron pinger, LOG_WEBHOOK_URL, ADMIN_EMAILS, SEED_DEMO, troubleshooting
- [x] S5. Complete .env.example (required / optional, commented) + tests/env-example.test.ts keeps it complete
- [x] S6. SEED_DEMO=false really skips the demo (scripts/seed.ts + seed-analytics)
- [x] S7. docs/sale/: FEATURES.md, TECH.md, HANDOVER.md, ROADMAP.md with real repo stats
- [x] S8. 12 curated screenshots in docs/sale/screenshots (webp, <400 KB each)
- [x] S9. Demo videos — legacy codename build, show the old Bazarga wordmark; not re-recorded after the rename (mobile 412x915 ku, desktop 1440x900 en, ~90 s, H.264; 1.8 MB + 3.5 MB) in docs/sale/video/ (also /workspace/work/sale/; recorder script /workspace/work/sale/record-demo.mjs)
- [x] S10. Acquisition brief PDF (/workspace/work/sale/Reelcart-Acquisition-Brief.pdf)
- [x] S18. Rebrand Bazarga → Reelcart (Abdulla Oct 18; reels/social views → cart): en brand, Latin name in ku/kmr/ar (بازارگە stays local), wordmark, R icon, OG, manifest, mail copy, share kit, legal, docs, LICENSE, package name; brief PDF re-rendered as Reelcart-Acquisition-Brief.pdf. DB/env/cookies/routes/Vercel URL unchanged.
- [x] S11. LICENSE proprietary, all rights reserved (Abdulla Aziz Hameed); package.json "license": "UNLICENSED"
- [ ] S12. Verify the Deploy button end-to-end on a throwaway Vercel + Supabase account (fresh DB → migrations → seed → /api/health ok → sign up → /admin). Needs a second Vercel account; the repo must be public or the tester must have access.
- [ ] S13. Fresh-DB dry run locally: empty pglite → db:migrate:deploy → SEED_DEMO=false db:seed → build → smoke; confirm no demo rows and signup + onboarding work on an empty platform.
- [x] S14 (seed warns when demo password unset on prod; set SEED_DEMO_PASSWORD on Vercel). Rotate/secure before handover: change demo password on the live site or set SEED_DEMO_PASSWORD; list every secret on the current Vercel project for the HANDOVER checklist (names only).
- [ ] S15. Short Kurdish (ku) + Arabic one-page versions of SETUP "Deploy" steps for local buyers (docs/sale/SETUP-ku.md, SETUP-ar.md).
- [ ] S16. Add a 1-minute narrated/captioned cut of the demo video (captions burned in, en) for listing pages.
- [ ] S17. Data-room extras: dependency licence report (npx license-checker --summary), Lighthouse report PDFs for landing/store/product, uptime history.

- [x] 0. (Do first) Variant editor nits from audit: price/stock placeholders truncated at 1280 ("Same as p", "Not cour") and new colour swatches all default blue (give each preset colour its real swatch). See docs/E2E-AUDIT.md.
- [ ] 1. Product page Lighthouse 95+ mobile (audit: fonts already subsetted/unicode-range, gallery images eager+fetchpriority by index; next measure JS bundle with lighthouse, trim shared client JS), then landing, pricing, store home
- [x] 2. (live run Oct 17 00:30 Baghdad: 25 passed, 1 skipped; `npm run test:live`) Seller-journey e2e on live site (signup → onboarding → product → share → shopper order ?src → orders by source) + plan-gating UI. Due Sun Oct 18
- [ ] 3. Market theme (6th)
- [ ] 4. axe clean on all top screens + CLS + empty/error/loading states ([x] marketing+auth loading skeletons; landing renders inline for no-JS)
- [ ] 5. Dashboard wow ([x] Cmd-K palette, [x] g-then-key shortcuts): Cmd-K, shortcuts, first-run checklist, first-order moment, optimistic edits
- [ ] 6. Shopper delight ([x] instant search, [x] recently viewed, [x] related, [x] wishlist): instant search, quick-view, wishlist, recently viewed, related, share cards
- [ ] 7. Landing $3M pass: tour, comparison table, FAQ x4, footer, real counters
- [ ] 8. Trust/ops: [x] /status (agentb/status-page), [x] rate limits on every public POST (tests/rate-limit-coverage.test.ts), [x] backups doc (OPS.md), [x] headers audit, [x] admin audit log view (/admin), [ ] legal review, [x] cookie notice (diacritic-safe line-height)
- [ ] 9. Seller tools ([x] low-stock alerts, [x] WhatsApp order templates, [x] orders CSV export, [x] products CSV export, [x] discount codes, [x] products CSV import): CSV import/export, bulk edit, discount codes, low stock, order notes/WhatsApp templates
- [ ] 10. Polish 390 ku / 1280 en + bug bash
