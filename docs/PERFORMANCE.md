# Performance

## Lighthouse (mobile, default simulated throttling)

Lighthouse 13.5.0, `npx lighthouse <url> --chrome-flags="--headless=new --no-sandbox"` (mobile form factor,
simulated slow 4G + 4× CPU), headless Chromium, against `next start` (production build) with the demo seed
(`npm run db:setup`). Measured 2026-10-07 on the `perf-pwa` branch before merge; local server, so TTFB is near zero.

| Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|---|---|---|
| `/s/hawler-bazaar` (store home) | 88 | 100 | 100 | 100 | 3.8 s | 0 | 110 ms | 0.8 s |
| `/s/hawler-bazaar/p/<id>` (product: natural skincare set) | 94 | 100 | 100 | 100 | 3.0 s | 0 | 100 ms | 0.8 s |

Nothing in Accessibility, Best Practices or SEO was flagged (alt text, contrast, meta description, CSP with
nonce, no `unsafe-inline` scripts all pass), so no fixes were needed there.

### What still costs points (performance only)
- **Store home LCP is the cover photo.** The cover is stored as a single URL (seed: `hero-1024.webp`, 63 KB), so
  phones download the 1024 px file with no `srcset`. Fix: keep the upload pipeline's renditions for the cover
  (as product images already do) and render it through `ResponsiveImage` with `sizes="100vw"`.
  The 320/640/1200 seed renditions already exist in `public/images/seed/`.
- **Image delivery:** product grid thumbnails at DPR 1.75 pick the 640 rendition for a ~182 px slot
  (est. 96 KB savings on home). A 480 w rendition would close most of the gap.
- **Unused / legacy JS:** ~27 KB unused and ~14 KB of polyfills Lighthouse considers legacy (from the framework
  runtime; browserslist tuning could drop some).
- **Render-blocking CSS:** the single 10 KB CSS chunk (~150–210 ms simulated). Acceptable; inlining critical
  CSS would need a nonce'd style strategy.
- **bf-cache:** 2 failure reasons, both `Cache-Control: no-store` (the HTML document, which is per-request
  because of the CSP nonce, and a client fetch). Lighthouse marks both "not actionable"; not pursued.

## Bundle budgets (`npm run budget`)

Gzipped first-load JS per route, from the build diagnostics. Budgets: storefront 155 KiB, dashboard 200 KiB.

| Route | gzip | raw |
|---|---|---|
| `/s/[slug]` | 145.2 KiB | 476.2 KiB |
| `/s/[slug]/p/[productId]` | 150.3 KiB | 489.4 KiB |
| `/s/[slug]/cart` | 148.6 KiB | 486.5 KiB |
| `/dashboard` | 158.2 KiB | 519.5 KiB |
| `/dashboard/settings` | 161.9 KiB | 531.6 KiB |
| `/dashboard/products/[id]`, `/new` | 160.3 KiB | 526.0 KiB |
| `/dashboard/delivery` | 159.3 KiB | 522.8 KiB |
| `/dashboard/ai` | 159.2 KiB | 522.0 KiB |
| `/dashboard/categories` | 158.8 KiB | 521.0 KiB |
| `/dashboard/orders/[id]` | 158.4 KiB | 519.9 KiB |
| `/dashboard/payments` | 158.2 KiB | 519.4 KiB |
| `/dashboard/products` | 158.1 KiB | 519.1 KiB |
| `/dashboard/customers`, `/more`, `/orders` | 157.6 KiB | 518.4 KiB |

Product page extras outside the first load: the thumbnail strip (≈0.7 KiB gzip, only for multi-photo
products) and the fullscreen photo viewer (≈2.1 KiB gzip, requested on the first tap / pointerdown) are
`React.lazy` chunks; the related-products strip, trust row, collapsible sections and specs table are
server-rendered with no client JS. The store-home cover now ships a `srcset` from its pipeline renditions.

## Mobile layout checks

- `npm run test:mobile` (Playwright): no horizontal overflow and no sub-16 px inputs at 360 px, ku and en, on
  11 storefront + dashboard routes.
- `npm run shots:mobile`: screenshots at 360/390/414/430 px × ku/en plus `report.json` (overflow, tap targets
  under 44 px, inputs under 16 px). Last run: 0 overflowing pages, 0 small tap targets, 0 small inputs (88 pages).
