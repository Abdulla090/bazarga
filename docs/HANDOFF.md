# BAZARGA — agent handoff board

Two build agents share this repo. They coordinate ONLY through this file and branches. Abdulla should never have to relay messages.

- **Hark** (Abdulla's main account): branches `hark/*`. Lane: shopper order tracking, COD status flow + packing slip, payment reconciliation + abandoned-order expiry, fake-order protection, analytics.
- **Agent B** (abdullaazizb58 account): branches `agentb/*`. Lane: seller setup checklist, share kit (bio link/QR/story image), ~480px thumbnails, shopper-specific delivery fee, product-page E2E test.

## Turn rule
Agent B ships 2 items, then Hark ships 2, repeat. Work happens in parallel inside your own lane; the turn decides who merges to `main` next.
- Push finished work as `agentb/<item>` or `hark/<item>` with all checks green.
- Hark merges into `main` after re-running every check. Never push directly to `main` (except Hark merging).
- Before pushing, rebase on latest `origin/main`.
- When you finish your 2 items, update **Current turn** and add a log entry below.

## Merge gate
`npm run typecheck`, `npm run lint`, vitest (284+), `npm run build`, `npm run budget`, smoke on fresh seed, `npm run test:mobile` (CHROMIUM_PATH=/usr/bin/chromium).

## Current turn
**Hark** — merge agentb/seller-setup-checklist, share-kit, thumbnails, shopper-delivery-fee, then COD status flow + packing slip.

## Log (newest first)
- 2026-10-08 07:15 Agent B: agentb/shopper-delivery-fee — product-page trust row shows the fee/ETA for the shopper's last checkout city (cookie bz_city_<slug>, set on city change in checkout; falls back to store city). No migration. Round 3 item 2 of 2 with agentb/thumbnails (47adbb4); both ready to merge. Gate green (typecheck, lint, vitest, build, budget, mobile, smoke). Current turn stays Hark.
- 2026-10-08 05:30 Agent B: pushed `agentb/thumbnails` (round 3, item 1, built in parallel during Hark's turn; merge after Hark's 2). Pipeline adds a 480 w WebP rendition (320/480/640/1024/1600); product-grid `sizes` subtracts container padding + gaps (`calc(50vw - 22px)` on phones) so DPR-2 phones load 480 w instead of 640 w; `npm run images:backfill` (`-- --dry`) adds 480 w to existing uploads + store covers, store-scoped, idempotent, seed rows skipped; seed renditions rebuilt (480 w files added, existing files unchanged); tests + a smoke check. No migration (renditions are jsonb). Also still waiting to merge: `agentb/seller-setup-checklist`, `agentb/share-kit`. Agent B next: shopper-specific delivery fee.
- 2026-10-08 03:50 Agent B: decision (Abdulla: "do what's best, don't ask"): the story image keeps the **store's language** as the default preview/highlighted download (it's shopper-facing), and all 4 languages stay one tap away. No code change; nothing blocks the merge. Standing rule from Abdulla: both agents make the best call themselves and log it here instead of asking him.
- 2026-10-08 03:40 Agent B: shipped agentb/seller-setup-checklist (e6a3080) and agentb/share-kit (12a5a5f, + this handoff commit); both rebased on main 7098251. Checks per branch, each on its own build: npm ci ✓, typecheck ✓, lint ✓, vitest ✓ (checklist 311, share kit 313; both together 329 expected), build ✓, budget ✓ (/dashboard 158.8 KiB, /dashboard/share 158.2 KiB of 200), smoke on fresh seed ✓ (checklist 61 checks, share kit 63), test:mobile ✓ 3/3 on a fresh seed (sandbox Chromium from apt). Notes for the merge:
  - Checklist: migration `0004_seller_setup_checklist` adds nullable `stores.link_shared_at` + `stores.delivery_confirmed_at`. Steps are derived from real data (logo, active product, delivery areas/edited zones or "fees look right", usable WhatsApp, link copied/shared or any order); card hides when all 5 are done. Actions live in `src/server/actions/setup.ts`; dashboard copy button is now `ShareLinkButtons` (copy + native share, records the share step).
  - Share kit: new dep `uqr` (MIT, zero deps, server-only) → run `npm ci`. Story PNG is rendered with sharp + Vazirmatn TTF from `src/server/share/fonts` (traced via `outputFileTracingIncludes`). `/api/share/qr` and `/api/share/story` are session-scoped GETs with `connection()` + rate limits.
  - Run test:mobile on a fresh seed BEFORE smoke (smoke adds a demo product, which breaks product-page.spec's related-count of 3).
  - Follow-up once both are on main (small, Agent B can take it): checklist "share" step → link to /dashboard/share, and share-kit copy/download buttons → `markLinkSharedAction`.
- 2026-10-08 03:05 Hark: shipped hark/order-tracking (shopper tracking page /s/[slug]/track, store-scoped lookup by order number + phone, rate limits, WhatsApp tracking link). Merged to main, 295 tests, smoke 58, budgets green. Still Agent B's turn (2 items). Hark next: COD status flow + packing slip.
- 2026-10-08 02:50 Hark: repo pushed to GitHub (main b950c86). Handoff board created. Agent B's turn.
