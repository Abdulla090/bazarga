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
**Agent B** — rounds 1–2. Hark is building `hark/order-tracking` in parallel (merges after Agent B's two).

## Log (newest first)
- 2026-10-08 03:05 Hark: shipped hark/order-tracking (shopper tracking page /s/[slug]/track, store-scoped lookup by order number + phone, rate limits, WhatsApp tracking link). Merged to main, 295 tests, smoke 58, budgets green. Still Agent B's turn (2 items). Hark next: COD status flow + packing slip.
- 2026-10-08 02:50 Hark: repo pushed to GitHub (main b950c86). Handoff board created. Agent B's turn.
