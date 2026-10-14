# Bazarga pricing (v2, decided by Abdulla 2026-10-14)

Source of truth: `src/lib/plans.ts`. USD, round numbers, never .99. Yearly = 10 × monthly ("2 months free").

| Plan | Monthly | Yearly | Products (shown) | Server cap | Product Studio AI edits / month |
|---|---|---|---|---|---|
| Free | $0 | — | 10 | 10 | 0 |
| Pro | $15 (first month $1) | $150 | 100 | 100 | 10 |
| Business ("Most popular") | $50 | $500 | Unlimited | 1000 (hidden) | 100 |
| Max (premium ink card, animated gold accent) | $100 (`MAX_MONTHLY_USD`, Hark's pick — change in one place) | $1000 | Unlimited | 10000 (hidden) | 100 |

- **Never show the hidden caps (1000 / 10000)** in UI or copy; tests (`tests/plans.test.ts`, `tests/pricing-render.test.ts`) fail if they appear.
- Hooks: hero stays **START FREE**; the secondary "$1 | Try Pro →" pill stays.
- Features are cumulative ("Everything in X, plus:"). Unbuilt features carry a small **Soon** tag on /pricing and in the comparison table (`soon: true` in `PLANS[].features` / `COMPARE`). Flip the flag when a feature ships.
  - Built today: 1 store + bazarga link, COD + WhatsApp orders, starter/all themes + Theme Studio, analytics (charts, funnels, heatmaps, CSV order export), discount codes, push order notifications, Bazarga footer badge removed on Pro+ (`showsBazargaBadge`), priority support (service), early access.
  - Soon: Product Studio, online payments (Rasedi off), team members, custom domain, multi-store, bulk CSV product import/export, AI descriptions in 4 languages (current AI drafts ku/ar/en), low-stock alerts, exclusive designs, AI Website Designer, white-label, priority Product Studio processing, premium store templates library, advanced SEO tools, monthly design refresh.
- **Margin pass (Abdulla 2026-10-14):** removed features that cost money per use or per customer: API access, dedicated account manager, AI Instagram product import, WhatsApp abandoned-cart reminders (paid WhatsApp API messages). The AI Website Designer copy no longer promises "from your Instagram". No "unlimited" team: seats and stores are capped in `STORE_LIMIT` / `TEAM_LIMIT` (Free 1/0, Pro 1/2, Business 3/5, **Max 5 stores / 10 team members**); the `stores{n}` / `team{n}` feature keys must match (tested). Max keeps cheap, high-value items and adds priority Studio processing, premium templates, advanced SEO and a monthly design refresh (all Soon). Don't re-add per-message or per-seat-cost features to a flat price without re-doing the margin math.
- **Max look (Abdulla 2026-10-14):** ink card with an animated orange-gold ring (rotating conic gradient, 7s loop, transform-only) + breathing gold glow, gold "Premium" badge, gold `$100`, gold "Choose Max" button with dark text, gold checks. Same accent on the comparison-table Max header (`max-chip`), the home pricing section and the dashboard plan chip when plan = max. CSS lives in `globals.css` under "Max plan". **Gold/orange is a Max-only exception**; everything else stays blue #2563EB + ink (tests/pricing-render.test.ts checks the other cards). Reduced motion = static gradients.
- Enforcement (server-side):
  - Products: `assertWithinProductLimit` / `getProductUsage` (`src/server/services/catalog.ts`) → VALIDATION `plan_limit_products`.
  - Product Studio: `src/server/services/studio-quota.ts` — `getStudioUsage`, `consumeStudioEdit` (atomic conditional upsert, never overshoots), `refundStudioEdit`; table `product_studio_usage` (migration 0016), period = Baghdad calendar month `YYYY-MM`. Error `plan_limit_studio`. Call `consumeStudioEdit` before the paid AI call, `refundStudioEdit` if it fails.
- Dashboard: plan chip in the header (→ /dashboard/upgrade), "7 of 10 products" meter on Products (unlimited plans show the count only).
- Upgrades: /dashboard/upgrade lists Pro/Business/Max; /admin activates any of them (shows the USD amount). Online "Pay online" covers Pro/Business only (see docs/PAYMENTS.md).
