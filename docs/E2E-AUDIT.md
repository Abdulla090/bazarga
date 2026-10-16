# E2E audit ("0 to 1000 real test") — live results

Target: **https://bazarga.vercel.app** (production). Measured 2026-10-17 between 00:45 and 01:10 Asia/Baghdad (21:45–22:10 UTC, Oct 16).

- "Before" = production before the batch-1 audit fixes (matrix 2026-10-16 20:29 UTC; Lighthouse finished 21:43:34 UTC, before 25979d4 deployed).
- "After" = production at **25979d4** (`/api/health` sha `25979d4881b3…`) for the matrix, the screenshots and Lighthouse. `2e8cf1e` (Merge agentb/trust-rate-limits: rate limits on quote/upgrade, no UI change) went live during the last load stage.
- Tooling: `scripts/e2e-matrix.mjs`, `scripts/load-burst.mjs`, `playwright.live.config.mjs` and the audit specs in `e2e/audit-*.spec.mjs`; Lighthouse 13.5.0 mobile (default simulated throttling); a CLS probe (layout-shift observer, fresh context per run).
- Nothing on live creates orders: the load burst is GET-only, and the matrix only logs in to the demo seller and reads pages.

## 1. Route matrix (every public + dashboard route × ku/kmr/ar/en × 360/390/1280)

21 public routes + 17 dashboard routes + the demo login, ~12 checks each (http status, console errors, failed requests, broken images, horizontal overflow, 44px tap targets, 16px inputs, dir/lang, raw i18n keys, dead links, title, CLS < 0.1, load < 8 s, axe serious/critical at 390 and 1280).

| | Checks | Passed | Failed | Pass rate |
|---|---:|---:|---:|---:|
| Before (pre-fix) | 5,976 | 5,702 | 274 | 95.4 % |
| After (25979d4) | 5,976 | **5,856** | **120** | **98.0 %** |

Same 5,976 check keys in both runs, so the diff is exact: **161 checks fixed, 7 newly failing** (explained below), failures down 56 %.

Failures by type:

| Check | Before | After | Notes |
|---|---:|---:|---|
| axe-serious | 160 | 108 | All 108 left are one rule on one component (see O1) |
| tap-targets-44 | 80 | 0 | 56 real (header logo 42px, fixed in 586e628) + 24 checker false alarms (stretched card links) |
| failed-requests | 24 | 0 | Checker false alarms: the expected 404 of the 404 test routes (fixed in 81e3ba8) |
| cls<0.1 | 10 | 12 | Storefront footer jump while `<main>` streams in; fix in progress (54529fa) |

By width after: 1280 → 96, 390 → 22, 360 → 2. By locale after: ku 33, ar 30, en 29, kmr 28 (evenly spread, so not a translation problem).

Checker false alarms in the before run: 48 (24 failed-requests + 24 tap-targets on stretched links). Real before failures: 226 → after 120.

### The 7 "new" failures

- `/login` and `/signup` ar 390 axe: not a regression. Before, the checker hit these routes while logged in, got redirected to the dashboard and never really audited them (fixed in 81e3ba8). They now show the same language-button issue as every other auth page (O1).
- 5 × cls<0.1 on `/s/hawler-bazaar?offers=1` (ar 390, ku 390, ku 1280), `/cart` en 360 and `?q=` kmr 360: the same footer shift as O2. It is intermittent: the matrix navigates inside one warm browser context, and a fresh-context probe of the same pages measures 0.05–0.23 (section 3).

## 2. Issues

| # | Severity | Issue | Status | Commit |
|---|---|---|---|---|
| A1 | High | Every action form (login, signup, reset, waitlist, product, store, theme, zones, discounts, pixels…) wiped all typed values when the server rejected a submit (React 19 form reset) | **Fixed, live** (verified: wrong password at 390 ku keeps email + password) | 1a3dcbe → a89a8a3, merged in 25979d4 |
| A2 | Medium | a11y: dashboard nav contrast, landing `.dvb-seen` contrast, analytics `<dl>`, header logo tap target 42px → 44px, language-button label-in-name (partly, see O1), honest rate-limit copy | **Fixed, live** (except O1) | 586e628 (in 25979d4) |
| A3 | High | Dashboard orders hard-capped at the newest 200 (order 201+ unreachable); products rendered all 1,000 at once | **Fixed, live**: 50/page + search; verified live "1–50 of 335" → Older → "51–100 of 335", `?page=99` clamps to "301–335 of 335" | 922b63f (in 25979d4) |
| A4 | Medium | `?src=` (TikTok/Instagram attribution) lost when the shopper tapped before hydration | **Fixed, live**: the server also sets the store's source cookie | 9c6a178 (in 25979d4) |
| A5 | Low (tooling) | Checker false alarms: expected 404s counted as failed requests; /login + /signup audited while logged in; stretched card links flagged as small tap targets | **Fixed** | 81e3ba8, 586e628 (`e2e/support.mjs`), 7d96060 |
| B1 | High | Sellers could not create sizes/colours (variants) | In progress, `hark-audit/variants` | 075f2e4 |
| B2 | Medium | Storefront `?page=` past the last page rendered the whole catalogue | In progress, `hark-audit/variants` | 5ac8c13 |
| B3 | Medium | CLS on cart / search / offers (footer jumps up while `<main>` streams) | In progress, `hark-audit/variants` | 54529fa |
| B4 | High | Checkout offline/flaky network: no localized error, retry could double-submit, typed details lost | In progress, `hark-audit/variants` | 69ae57b |
| B5 | Low (tooling) | Abuse spec: markup/SQL stays text, oversized input refused politely, double submits count once | In progress, `hark-audit/variants` | b9f1af0 |

## 3. Open items (remaining failures and findings)

| # | Severity | Item | Where | Evidence / suggested fix |
|---|---|---|---|---|
| O1 | Medium | axe `label-content-name-mismatch` on the language dropdown trigger (`LanguageDropdown.tsx`, `showCode` variant): **all 108 remaining axe failures** | 5 auth routes (/login, /signup, /forgot-password, /reset-password, /verify-email) at 390 + 1280, and all 17 dashboard routes at 1280, in all 4 locales (27 per locale) | Visible text is the code (`EN`); the name is `Language: English (en)`. axe 4.14 rejects the code **inside parentheses**. Tested on live by swapping the attribute: `Language: English (en)` FAIL; `Language: English, EN`, `Language: English en` and `EN Language: English` pass. Fix: drop the parentheses, e.g. `${label}: ${current.label}, ${code.toUpperCase()}` |
| O2 | Medium | CLS > 0.1 on storefront list pages (12 matrix checks) | `/s/hawler-bazaar/cart` (1280: 0.95–1.11, en 360: 6.97), `?offers=1` (390: 3.1, 1280: 1.03), `?q=` (ku 1280: 0.82, kmr 360: 2.18), 404 pages at 1280 (0.18–0.20) | Shift sources: `div.store-page section` + `footer.store-footer` move 170–185px when content streams in. B3 (54529fa, `<main>` min-height) targets exactly this. Re-measure after it merges |
| O3 | Low | Product page has no `<meta name="description">` (Lighthouse SEO 92 on product, 100 everywhere else) | `/s/[slug]/p/[productId]` | Generate it from the product name + price + store name in `generateMetadata` |
| O4 | Low | Floating chat button covers part of the coupon/delivery line on the store home at 390 (first viewport) | `/s/hawler-bazaar`, ku 390 | Screenshot `store-home-390-ku.png`; add bottom padding/safe-area under the last block or offset the FAB |

## 4. Lighthouse (mobile, 2 runs each, Lighthouse 13.5.0)

Scores are performance / accessibility / best practices / SEO. LCP in seconds, CLS. Same machine, comparable benchmark index (2,250–2,510).

| Page | Before run 1 | Before run 2 | After run 1 | After run 2 | LCP before → after | CLS before → after |
|---|---|---|---|---|---|---|
| Landing `/` | 95/97/100/100 | 91/97/100/100 | 90/100/100/100 | 89/100/100/100 | 2.72, 2.65 → 3.01, 2.72 | 0 → 0 |
| Pricing `/pricing` | 96/100/100/100 | 97/100/100/100 | 97/100/100/100 | 96/100/100/100 | 2.60, 2.42 → 2.27, 2.59 | 0 → 0 |
| Store `/s/hawler-bazaar` | 90/100/100/100 | 94/100/100/100 | 91/100/100/100 | 92/100/100/100 | 2.87, 2.83 → 2.87, 2.82 | 0 → 0 |
| Product `/s/hawler-bazaar/p/36c61466…` | 90/100/100/92 | 89/100/100/92 | 92/100/100/92 | 90/100/100/92 | 2.97, 3.01 → 2.87, 2.86 | 0 → 0 |

- Accessibility: landing 97 → **100**; every page is now 100.
- Performance is flat within run-to-run noise (±4). The landing dip (93 → 89.5 average) comes from TBT variance (92–304 ms) and one 3.0 s LCP run. An earlier after-run of landing on a contended sandbox scored 70/78 and was discarded.
- SEO: only the product page misses 100, because it has no meta description (O3).
- Lighthouse CLS is 0 on all four pages (simulated cold load). The storefront CLS in O2 appears on cart / search / offers, which Lighthouse doesn't cover here.

## 5. CLS probe (1280, en unless noted, fresh context per run)

| Page | After (cls.mjs, 2 runs) | ku / ar (1 run) | Matrix (warm context), worst |
|---|---|---|---|
| `/s/hawler-bazaar/cart` | 0.062, 0.062 | 0.053 / 0.053 | 0.948–1.113 |
| `/s/hawler-bazaar?q=عسل` | 0.113, 0.113 | 0.054 / 0.090 | 0.816 |
| `/s/hawler-bazaar?offers=1` | 0.089, 0.089 | 0.073 / 0.073 | 1.025 |

On a cold load, search sits just over 0.1 and cart / offers sit under it. On a warm navigation (assets cached, content streams later than the shell) the footer jump grows past 0.8. Extra datapoint: offers at 390 ku measured 0.225 and then 0. Same root cause as O2.

## 6. Load burst (live, GET only, 1,002 requests, 0 errors)

Run from the sandbox through its egress proxy (us-west-2), so every request carries roughly 200 ms of extra network time. Two stages: concurrency 10, then 20.

| Endpoint | Concurrency | Requests | RPS | p50 | p95 | p99 | max | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Store home `/s/hawler-bazaar` | 10 | 150 | 9.4 | 873 ms | 1,839 ms | 3,165 ms | 3,277 ms | 0 |
| Product page | 10 | 150 | 9.4 | 964 ms | 1,149 ms | 1,533 ms | 3,827 ms | 0 |
| `/api/health` (DB round-trip) | 10 | 150 | 28.4 | 224 ms | 1,776 ms | 1,919 ms | 2,039 ms | 0 |
| Store home | 20 | 184 | 15.9 | 1,117 ms | 1,799 ms | 3,254 ms | 3,323 ms | 0 |
| Product page | 20 | 184 | 17.9 | 968 ms | 1,601 ms | 3,325 ms | 3,388 ms | 0 |
| `/api/health` | 20 | 184 | 49.9 | 282 ms | 784 ms | 1,659 ms | 1,709 ms | 0 |

**Error rate: 0 / 1,002 (0 %).** Throughput scaled with concurrency (store 9.4 → 15.9 rps, product 9.4 → 17.9 rps) and p50/p95 held roughly flat, so 20 concurrent shoppers doesn't saturate anything. `/api/health` reported DB latency of ~93 ms right after the burst. Matrix navigation times: median 1.9 s, p95 3.1 s (before: 1.8 s / 2.9 s), all under the 8 s budget.

## 7. Screenshots (live, 2026-10-17)

Kept in the audit workspace as `daily-shots/2026-10-17/`:

- `dashboard-orders-paging-1280-en.png`: orders page 2, "51–100 of 335" with Newer / Older
- `login-error-keeps-values-390-ku.png`: Sorani "wrong email or password" error with email and password still filled
- `store-home-390-ku.png`: store home, Sorani, 390 (shows O4)

## 8. Needs Abdulla

Vercel production env checked 2026-10-17. None of these is set:

1. **`ADMIN_EMAILS`**: not set, so nobody can reach the platform admin (plans, upgrades, payouts review).
2. **Domain + `ROOT_DOMAIN`**: still on `bazarga.vercel.app`. Buy or pick the domain, add it in Vercel, then set `ROOT_DOMAIN` and `APP_URL`.
3. **Email key**: `EMAIL_DRIVER` plus `RESEND_API_KEY` or `BREVO_API_KEY`, and `EMAIL_FROM` on a verified domain. Until then, verify and reset mails only go to the function log (`email.console`).
4. **Rasedi keys** (`PAYMENTS_PROVIDER` + Rasedi credentials): online payments stay off until set (docs/PAYMENTS.md).
5. **VPS**: for the Docker path, the backup cron and off-site DB copies (docs/OPS.md).

## Re-run

```
BASE_URL=https://bazarga.vercel.app LOCALES=ku,kmr OUT=/tmp/m1.json node scripts/e2e-matrix.mjs   # + LOCALES=ar,en in parallel
NODE_USE_ENV_PROXY=1 BASE_URL=https://bazarga.vercel.app N=450 C=10 PATHS=/s/hawler-bazaar,/s/hawler-bazaar/p/<id>,/api/health node scripts/load-burst.mjs
```
