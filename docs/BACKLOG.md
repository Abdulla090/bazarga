# Reelcart backlog (top unfinished first)

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
- [ ] S14. Rotate/secure before handover: change demo password on the live site or set SEED_DEMO_PASSWORD; list every secret on the current Vercel project for the HANDOVER checklist (names only).
- [ ] S15. Short Kurdish (ku) + Arabic one-page versions of SETUP "Deploy" steps for local buyers (docs/sale/SETUP-ku.md, SETUP-ar.md).
- [ ] S16. Add a 1-minute narrated/captioned cut of the demo video (captions burned in, en) for listing pages.
- [ ] S17. Data-room extras: dependency licence report (npx license-checker --summary), Lighthouse report PDFs for landing/store/product, uptime history.

- [x] 0. (Do first) Variant editor nits from audit: price/stock placeholders truncated at 1280 ("Same as p", "Not cour") and new colour swatches all default blue (give each preset colour its real swatch). See docs/E2E-AUDIT.md.
- [ ] 1. Product page Lighthouse 95+ mobile (audit: fonts already subsetted/unicode-range, gallery images eager+fetchpriority by index; next measure JS bundle with lighthouse, trim shared client JS), then landing, pricing, store home
- [x] 2. (live run Oct 17 00:30 Baghdad: 25 passed, 1 skipped; `npm run test:live`) Seller-journey e2e on live site (signup → onboarding → product → share → shopper order ?src → orders by source) + plan-gating UI. Due Sun Oct 18
- [ ] 3. Market theme (6th)
- [ ] 4. axe clean on all top screens + CLS + empty/error/loading states ([x] marketing+auth loading skeletons)
- [ ] 5. Dashboard wow ([x] Cmd-K palette, [x] g-then-key shortcuts): Cmd-K, shortcuts, first-run checklist, first-order moment, optimistic edits
- [ ] 6. Shopper delight ([x] instant search, [x] recently viewed, [x] related, [x] wishlist): instant search, quick-view, wishlist, recently viewed, related, share cards
- [ ] 7. Landing $3M pass: tour, comparison table, FAQ x4, footer, real counters
- [ ] 8. Trust/ops: [x] /status (agentb/status-page), [x] rate limits on every public POST (tests/rate-limit-coverage.test.ts), [x] backups doc (OPS.md), [x] headers audit, [x] admin audit log view (/admin), [ ] legal review, [ ] cookie notice
- [ ] 9. Seller tools ([x] low-stock alerts, [x] WhatsApp order templates, [x] orders CSV export, [x] products CSV export, [x] discount codes, [x] products CSV import): CSV import/export, bulk edit, discount codes, low stock, order notes/WhatsApp templates
- [ ] 10. Polish 390 ku / 1280 en + bug bash
