# Payments — Rasedi gateway architecture

Status (2026-10-14): **built, merged, OFF.** No Rasedi KYC or keys yet, so production runs with
`PAYMENTS_PROVIDER` unset (= `none`): no "Pay online" button, no online option at checkout, the payout card says
"Online payments: coming soon — waiting for gateway activation", and every gateway route answers 404.
Cash on delivery and the manual FIB / ZainCash / cash upgrade requests work exactly as before.

Rasedi facts below were read from https://rasedi.com/docs/api-references/, https://rasedi.com/docs/javascript-sdk/,
https://rasedi.com/docs/python-sdk/ and the published `rasedi-sdk@1.0.9` npm package on 2026-10-13.

## Architecture

```
                         ┌────────────────────────── Bazarga (Next.js on Vercel) ──────────────────────────┐
 Seller /dashboard/upgrade ── payOnlineForm ─┐                                                              │
                                             ├─► gateway/service.ts ── createCheckout ──► GatewayProvider   │
 Shopper /s/<slug>/cart ── placeOrderAction ─┤     (payments row: pending)                 ├ RasediProvider ─┼─► https://api.rasedi.com
 POST /api/payments/checkout ────────────────┘                                             └ MockProvider    │     /v1/payment/rest/{test|live}/…
                                                                                                             │
 Browser ◄── 302 hosted page (Rasedi) ── customer pays with FIB / ZainCash / AsiaPay / NassWallet / card       │
 Browser ──► GET /payments/return?p=<id> ── polls GET /api/payments/status ── getStatus() ──┐                │
 Rasedi  ──► POST /api/payments/webhook/rasedi?token=<secret>                               ├─► applyGatewayStatus (one tx, row locked)
               verify token (401) → payment_events claim (dedupe) → getStatus() ────────────┤      subscription → activateRequestTx (plan + history + period end)
 Cron    ──► /api/cron/payments (every 5 min) | /api/cron/daily ── reconcileGatewayPayments ┘      order        → orders.payment_status = paid + ledger_entries
                                                                                                             │
 /admin: payments list · payout profiles (verify/reject) · queue payout · mark payout paid → ledger debit    │
                                                                                                             └─────────────────────────┘
```

Code map (`src/server/payments/gateway/`):

| file | what |
|---|---|
| `config.ts` | zod-validated env, **fail-closed**: anything invalid → provider `none` + `payments.config_invalid` log (site keeps working) |
| `types.ts` | `GatewayProvider` interface: `createCheckout`, `getStatus`, `verifyWebhook`, `cancel?`, `refund?` |
| `rasedi.ts` | thin typed fetch client (no SDK dependency), Ed25519 request signing |
| `mock.ts` | in-memory provider with the same contract (tests, local dev); refused in production unless `PAYMENTS_ALLOW_MOCK=true` |
| `registry.ts` | `gateway()` → active provider or `null` |
| `state.ts` | forward-only state machine |
| `pricing.ts` | USD → IQD (`USD_IQD_RATE`, rounded to 250 IQD), Pro first-month promo, commission |
| `service.ts` | checkouts, webhook handling, status application, reconciliation, payout profiles, ledger, payouts |
| `http.ts` | `POST /api/payments/checkout` core (zod + rate limits + tenant rules) |
| `chips.ts` | gateway chips for the storefront selector (FastPay / Qi Card shown "soon") |

The older per-method code (`fib.ts`, `zaincash.ts`, `payment_transactions`) is untouched and still env-gated by
`FIB_ENABLED` / `ZAINCASH_ENABLED`; Rasedi replaces the need for it (one contract for all wallets).

## Flows

**(a) Subscriptions** (pricing v2, 2026-10-14; source of truth `src/lib/plans.ts`, see docs/PRICING.md). Pro $15/mo
($1 first month, once per store — no earlier pro/business plan history), $150/yr; Business $50/mo ($500/yr); Max $100/mo
($1000/yr). IQD = USD × `USD_IQD_RATE` (default 1310) rounded to 250 → Pro 19,750 · first month 1,250 · yearly 196,500 ·
Business 65,500 IQD. **Max is manual-only for now**: the gateway (`src/server/payments/**`, untouched by pricing v2) still
validates `plan: pro | business`; /dashboard/upgrade quotes Max in USD and Max is activated from /admin after a manual
payment. Adding Max online = widen the two `z.enum(["pro", "business"])` in `gateway/http.ts` + `gateway/service.ts`
and the first-month history check (owner: Agent B, payments lane). "Pay online" creates an upgrade request (`method = online`) and a
`payments` row, then redirects to the hosted page. The webhook (or return-page poll, or cron) confirms with Rasedi
and activates via `activateRequestTx` — the same code the admin "Activate" button uses (extends from the current
period end, writes `store_plan_history`, existing plan-expiry cron handles the end). If the seller replaced the
request meanwhile, the paid plan/months stored on the payment are honoured with a fresh request. The manual
FIB/ZainCash/cash request stays as the fallback on the same page.

**(b) Storefront orders (marketplace, platform collects).** A store offers "Pay online" only when
`PAYMENTS_PROVIDER` is on **and** its payout profile is `verified` (by an admin in /admin) **and** the seller turned
the toggle on (stored as `store_payment_methods(method = online)`; changing payout details turns it off again).
COD stays first/default. On paid: `orders.payment_status = paid` and the ledger gets
`seller +total (sale)`, `seller −commission (commission)`, `platform +commission (commission_income)`, with
commission = floor(total × `PLATFORM_COMMISSION_BPS` / 10000) (default 0). Seller balance = Σ seller entries.
Admin queues a payout (≤ balance minus pending payouts), sends the money by FIB/ZainCash/bank, then "Mark paid" →
`seller −amount (payout)`. Unpaid online orders are still cancelled by the existing abandoned-order expiry
(`PAYMENT_ORDER_TTL_MINUTES`); their pending gateway payments become `expired`, and a late "paid" still lands
(expired → paid, ledger booked, `gateway.paid_after_cancel` warning → refund manually).

## State machine (`payments.status`)

```
pending ──► paid ──► refunded
   ├──────► failed ──► paid      (late success after decline/cancel)
   └──────► expired ─► paid      (paid as the link timed out)
```
Rasedi → ours: `PENDING→pending`, `PAID→paid`, `FAILED/CANCELED→failed`, `TIMED_OUT→expired`. Changes happen only in
`applyGatewayStatus` (row `FOR UPDATE`, one transaction) and only with a status fetched from Rasedi — never from the
redirect and never from the webhook body.

## Webhook

`POST /api/payments/webhook/rasedi?token=<RASEDI_WEBHOOK_SECRET>`, body `{ referenceCode, status, payoutAmount }`.
1. token compared in constant time → **401** if missing/wrong (Rasedi's own `x-signature` scheme for callbacks is not
   documented; see questions);
2. `payment_events (provider, event_id = <referenceCode>:<STATUS>)` insert-or-skip → duplicates answer 200 and do nothing;
3. `getStatus(referenceCode)` from Rasedi, apply atomically, record the outcome;
4. always 200 once authenticated (Rasedi wants 200 within 5 s); if the lookup fails the claim is released and the
   reconciliation cron finishes it. Body capped at 16 KB.

Reconciliation: `runPaymentJobs` (used by `/api/cron/payments` and `/api/cron/daily`, Bearer `CRON_SECRET`) re-checks
payments pending > 15 min, every 10 min per payment, max 60 checks; payments with no reference after 1 h → failed.
Vercel Hobby runs `/api/cron/daily` once a day, so when live also call `/api/cron/payments` every 5 min from an
external scheduler (cron-job.org / GitHub Actions / the VPS).

## Data (migration 0014, additive)

`payments`, `payment_events`, `seller_payout_profiles`, `ledger_entries`, `payouts`, and the `online` value of the
`payment_method` enum. Every seller read/write filters by the session store id; the public checkout checks the order
belongs to the slug's store; the return page/status endpoint expose only status + next link (no PII).

## Environment variables

| var | default | notes |
|---|---|---|
| `PAYMENTS_PROVIDER` | `none` | `none` \| `rasedi` \| `mock` |
| `RASEDI_MODE` | `test` | `test` \| `live` (path segment `/v1/payment/rest/<mode>/…`); live with a `test_` key is refused |
| `RASEDI_API_BASE` | `https://api.rasedi.com` | |
| `RASEDI_KEY_ID` | — | the panel's "secret key" sent as `x-id` (`test_…` / `live_…`) |
| `RASEDI_PRIVATE_KEY` | — | private key PEM (Ed25519 per the docs); single-line with `\n` is fine |
| `RASEDI_WEBHOOK_SECRET` | — | ≥ 24 random chars, put in our callback URL; generate with `openssl rand -hex 24` |
| `RASEDI_GATEWAYS` | `FIB,ZAIN,ASIA_PAY,NASS_WALLET,CREDIT_CARD` | add `FAST_PAY` once Rasedi enables it for the account |
| `RASEDI_AMOUNT_SCALE` | `100` | docs: IQD amounts × 100 ("1,500 IQD = 150000") |
| `RASEDI_FEE_FROM_CUSTOMER` | `false` | storefront orders only |
| `USD_IQD_RATE` | `1310` | subscription prices |
| `PLATFORM_COMMISSION_BPS` | `0` | 100 = 1 % per order |
| `PAYMENTS_ALLOW_MOCK` | — | only for a staging deploy that wants the mock provider |

## How Abdulla goes live

1. Complete Rasedi KYC (business documents) at rasedi.com → dashboard access. Pricing seen 2026-10-13: from
   9,750 IQD/month + 0.90 % + gateway fee.
2. In the Rasedi panel create **test** credentials: secret key (`test_…`) and the private key PEM.
3. Vercel → Project → Settings → Environment Variables (Production): `PAYMENTS_PROVIDER=rasedi`, `RASEDI_MODE=test`,
   `RASEDI_KEY_ID`, `RASEDI_PRIVATE_KEY`, `RASEDI_WEBHOOK_SECRET` (and `USD_IQD_RATE`, `PLATFORM_COMMISSION_BPS` if
   not default). Redeploy. Check logs for no `payments.config_invalid`.
4. Webhook URL: Bazarga sends it with every payment (`callbackUrl`), so nothing to paste — if the panel also asks for
   one, use `https://<domain>/api/payments/webhook/rasedi?token=<RASEDI_WEBHOOK_SECRET>`.
5. Test payment: /dashboard/upgrade → "Pay online now" (Pro first month = 1,250 IQD) → pay with a test wallet → the
   return page shows "Payment received" and the plan is Pro in /admin. Also verify a test store's payout profile in
   /admin, turn on online payments, place a storefront order and pay it.
6. Switch to live: replace `RASEDI_KEY_ID` / `RASEDI_PRIVATE_KEY` with the live pair, `RASEDI_MODE=live`, redeploy,
   do one real 1,250 IQD payment, then set up the 5-minute `/api/cron/payments` caller.
Rollback at any time: set `PAYMENTS_PROVIDER=none` (or delete it) and redeploy.

## Questions to ask Rasedi (before taking shopper money)

1. **Licensing / model:** may Bazarga collect for sellers as a platform and pay them out (platform-collect), or must
   each seller be a sub-merchant under Rasedi's marketplace product (split payments, per-seller KYC)? If the latter,
   what API creates sub-merchants and sets per-seller commission?
2. **Payout schedule** to our account (T+?), minimums, fees per payout; is there a payouts API for paying sellers?
3. **Refund API:** is there an endpoint for full/partial refunds (none in the public docs)? Until then refunds are manual.
4. **Qi Card:** supported? (not in the SDK `Gateway` enum as of 2026-10-13) — and FastPay activation for our account.
5. **Webhook signature scheme:** how exactly are callback `x-signature` / `x-id` headers produced and which public key
   verifies them? (We authenticate by URL token + status re-fetch meanwhile.) Do callbacks retry, how often, and is
   there an event id?
6. **Amount unit:** confirm IQD × 100 (API reference) vs the SDK example "1050"; minimum amount.
7. Test-mode credentials and test wallets/cards; does `RASEDI_MODE` follow the key prefix only?
8. Do links really expire after 24 h, and can we set a shorter expiry for storefront orders?
