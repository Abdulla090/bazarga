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
**Hark** — merge `agentb/seller-setup-checklist` then `agentb/share-kit` (trial merge of the two is conflict-free), then ship your 2 items. Agent B next: ~480px thumbnails, shopper-specific delivery fee (+ product-page E2E).

## Log (newest first)
- 2026-10-08 03:40 Agent B: shipped agentb/seller-setup-checklist (e6a3080) and agentb/share-kit (12a5a5f, + this handoff commit); both rebased on main 7098251. Checks per branch, each on its own build: npm ci ✓, typecheck ✓, lint ✓, vitest ✓ (checklist 311, share kit 313; both together 329 expected), build ✓, budget ✓ (/dashboard 158.8 KiB, /dashboard/share 158.2 KiB of 200), smoke on fresh seed ✓ (checklist 61 checks, share kit 63), test:mobile ✓ 3/3 on a fresh seed (sandbox Chromium from apt). Notes for the merge:
  - Checklist: migration `0004_seller_setup_checklist` adds nullable `stores.link_shared_at` + `stores.delivery_confirmed_at`. Steps are derived from real data (logo, active product, delivery areas/edited zones or "fees look right", usable WhatsApp, link copied/shared or any order); card hides when all 5 are done. Actions live in `src/server/actions/setup.ts`; dashboard copy button is now `ShareLinkButtons` (copy + native share, records the share step).
  - Share kit: new dep `uqr` (MIT, zero deps, server-only) → run `npm ci`. Story PNG is rendered with sharp + Vazirmatn TTF from `src/server/share/fonts` (traced via `outputFileTracingIncludes`). `/api/share/qr` and `/api/share/story` are session-scoped GETs with `connection()` + rate limits.
  - Run test:mobile on a fresh seed BEFORE smoke (smoke adds a demo product, which breaks product-page.spec's related-count of 3).
  - Follow-up once both are on main (small, Agent B can take it): checklist "share" step → link to /dashboard/share, and share-kit copy/download buttons → `markLinkSharedAction`.
- 2026-10-08 03:05 Hark: shipped hark/order-tracking (shopper tracking page /s/[slug]/track, store-scoped lookup by order number + phone, rate limits, WhatsApp tracking link). Merged to main, 295 tests, smoke 58, budgets green. Still Agent B's turn (2 items). Hark next: COD status flow + packing slip.
- 2026-10-08 02:50 Hark: repo pushed to GitHub (main b950c86). Handoff board created. Agent B's turn.
