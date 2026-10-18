# Owner admin console (`/admin`)

The platform owner's control room: every account, store, product and order across Reelcart, plus runtime site
controls. It is **not** the seller dashboard (`/dashboard`) and shoppers never see it.

## Who gets in

| Source | Role | How |
|---|---|---|
| `ADMIN_EMAILS` env (comma-separated) | **owner** | Always owner while the email is listed. Change it in the host's env and redeploy. |
| `users.role = owner` (DB) | **owner** | Set in **Admin team**, or by `SEED_ADMIN_EMAIL` at deploy. |
| `users.role = admin` (DB) | **admin** | Added in **Admin team** by an owner. |

- **owner**: everything, including adding/removing admins and promoting owners.
- **admin**: everything except managing the admin team; cannot act on owners.
- Suspended/banned accounts have no admin rights even when listed.
- Anyone else (signed out included) gets a real **404** status on every `/admin` page (src/proxy.ts asks `/api/admin/check`) and on `/api/admin/export/*` (the console stays invisible);
  every server action answers `FORBIDDEN`.

### `SEED_ADMIN_EMAIL` (seeded owner)

`npm run db:seed` (part of the Vercel build) promotes existing accounts whose email is in `SEED_ADMIN_EMAIL` to
`owner`. It only promotes, never demotes, and skips emails with no account yet (sign up first, then redeploy or run
the seed). To remove a seeded owner: take the email out of `SEED_ADMIN_EMAIL`, then remove them in **Admin team**.

> The public test deploy (bazarga.vercel.app) sets `SEED_ADMIN_EMAIL=demo@mymarket.app` so the demo login can open
> the console. **The demo password is public: remove that env value (and demote the demo account in Admin team)
> before real sellers use the site or before handing the project to a buyer.**

## Security model

- **Server-side guard on everything**: `requireAdmin()` on every page (layout + each page), `currentAdmin()` on the
  export route, `requireAdminAction(perm)` inside every action (`src/server/actions/admin.ts`, all through `run()`).
  `tests/admin-console.test.ts` calls every exported action as a signed-out visitor and as a seller and expects
  `FORBIDDEN` with nothing written, and statically checks every admin page/route calls the guard.
- **Step-up for destructive actions**: suspend/ban, delete user, suspend/transfer/reset-theme/delete store, delete
  product, maintenance on, promote to owner. The admin types the target's email/slug/code (or `maintenance`) or enters
  their own password. Checked on the server (`stepUp()`), not just in the dialog.
- **Audit log** (`admin_audit`, migration 0030): actor id + email, action, target type/id/label, before/after
  snapshots (secrets redacted by `auditSnapshot`, long values cut), IP, user agent, time. Shown and filterable in
  **Audit log**, on each user and store page, and exportable as CSV. Seller-side settings changes (`audit_log`) are
  listed underneath.
- **Rate limits**: 120 admin writes/minute per admin; destructive and team actions 20 per 10 minutes; CSV exports
  30 per 10 minutes.
- **noindex**: `robots: noindex, nofollow, nocache` on the whole area; exports send `X-Robots-Tag: noindex`.
- **Impersonation ("View as this seller")**: creates a 30-minute session for the seller (`sessions.impersonated_by`),
  keeps the admin's own session in an httpOnly return cookie, shows an orange banner on every dashboard page with
  **Return to admin**, never slides its expiry, never counts as an admin session, cannot target admins or inactive
  users. Start and end are both audited.
- Suspending or banning a user deletes all their sessions at once and their next sign-in fails like a wrong password.

## Sections

| Section | What you can do |
|---|---|
| **Overview** | Accounts, sellers, stores (live), products, orders, GMV (all-time + 30 days), MRR estimate (paid stores × list price), waitlist, pending upgrades; 30-day signups vs orders chart; plan mix donut; health (DB ping, build sha, last daily cron run, integrations, feature flags, link to `/api/health`). |
| **Users** | Search (name/email/phone), filter by status/role, paginate, inline-edit names, bulk verify / sign out, CSV. Detail: edit name/email/phone, verify/unverify email, sign out everywhere, view as seller, make/remove admin (owner only), suspend / ban / reactivate, delete (with stores), sessions, owned stores, audit trail. |
| **Stores** | Search (name/slug/owner), filter by plan/state, featured toggle (optimistic), bulk feature/unfeature, CSV. Detail: edit name/slug/phone/WhatsApp/Instagram/city, published, featured, showcase opt-in, white-label; set plan + end date, +1/+12 months, comp (open-ended), plan history; limit overrides; suspend (storefront shows "This store is unavailable", checkout refuses orders) / lift; transfer ownership; reset theme; delete. |
| **Moderation** | Every product across stores: hide/unhide (hidden products vanish from the storefront whatever the seller sets), bulk hide, delete. Every order: filter by status, move along the allowed status flow (same rules and restock as the seller), CSV. |
| **Plans & limits** | Plan matrix (price, products, studio edits, AI credits, seats, stores); upgrade requests (activate/reject); every store with overrides. |
| **Site controls** | Maintenance mode (sellers and shoppers see a maintenance page, orders are refused; `/admin` and `/login` keep working; admins bypass everywhere); feature flags; announcement banner (on/off, 5 colours, link, en/ku/ar/kmr text, live preview; shown on the marketing site and every seller dashboard); featured stores; password-reset / email-confirmation subject lines. |
| **Waitlist & demand** | Waitlist with referrals, top cities, search, CSV, one-tap WhatsApp invite with the person's referral link. |
| **Payouts** | The existing online payments, payout profiles and payouts screen (read via the payments services; unchanged). |
| **Audit log** | Filter by text, action prefix, admin, target type and date range; expand a row for before/after JSON; CSV. |
| **Admin team** | Admins and owners (env-listed ones marked), add by email, remove, promote to owner; your own sessions. |

Keyboard: **Ctrl/⌘ K** opens the command palette (jump to any user, store or section); **g** then a letter jumps to a
section (g o overview, g u users, g s stores, g m moderation, g p plans, g c site controls, g w waitlist, g y payouts,
g a audit, g t team); **/** focuses the search box.

## Runtime settings

`platform_settings` (key → JSON), read through `src/server/services/platform-settings.ts` with a 15-second
per-instance cache (a write clears the local cache at once; other instances follow within 15 s). An empty table
means: every flag on, no maintenance, no announcement. A failed read falls back to those defaults.

| Flag | Effect when off |
|---|---|
| `signups` | Sign-up form answers "unavailable" |
| `waitlist` | Waitlist form answers "unavailable" |
| `aiDescriptions` | AI product copy is refused |
| `whatsappLogin` | WhatsApp login codes are not sent |
| `showcase` | `/showcase` is 404 (featured order cached up to 5 min) |
| `productStudio` | Product Studio saves and AI cut-outs are refused |
| `aiDesigner` | AI Website Designer (SF10): `designStoreWithAiAction` refuses with `ai_disabled` when off |

## Limit overrides

`store_limit_overrides` (one row per store; empty column = plan default; `0` = none allowed). Applied server-side in
`catalog.getProductUsage` (products), `studio-quota` (studio edits), `ai-quota` (AI credits, every AI feature),
`team.teamUsage` (seats) and `store-access.ownedStoreUsage` (stores per account: the highest override across the
owner's stores).

## Files

- `drizzle/0030_admin_console.sql` — roles, statuses, `impersonated_by`, store suspension/featured, product
  `hidden_by_admin_at`, `admin_audit`, `platform_settings`, `store_limit_overrides`.
- `src/lib/admin.ts` — pure rules (roles, step-up, flags, announcement, overrides, CSV, snapshots).
- `src/server/auth/admin.ts` — guard. `src/server/actions/admin.ts` — every write. `src/server/admin/` — queries,
  audit, maintenance/announcement gate.
- `src/app/admin/**`, `src/components/admin/**`, `src/app/api/admin/export/[kind]` (users, stores, products, orders,
  waitlist, audit).
- `scripts/seed-admin.ts` — `SEED_ADMIN_EMAIL`.
- Tests: `tests/admin-console.test.ts`.
