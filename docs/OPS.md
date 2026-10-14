# Bazarga — operations runbook

Who this is for: whoever deploys, restores or gets paged. Keep it short and true; update it in the same PR as the change.

## 1. What runs where

| Piece | Where | Notes |
| --- | --- | --- |
| App (Next.js 16, standalone) | Vercel project `bazarga` (prj_5u6PQayEDQPQ6BqAuft4v00IRcYW) | Every push builds; `main` is promoted to production. A Docker/VPS path also exists (`Dockerfile`, `docker-compose.yml`). |
| Database | Supabase Postgres (Vercel integration injects `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`) | TLS verified with the bundled Supabase root CA (`src/server/db/supabase-ca.ts`). |
| Uploads | Supabase Storage bucket `uploads` (auto-selected on serverless) | R2/S3 driver available (`STORAGE_DRIVER=s3`). |
| Cron | `vercel.json` → `GET /api/cron/daily` 03:00 UTC (06:00 Baghdad) | Bearer `CRON_SECRET`. Plan expiry, payment reconcile/expiry, rate-limit pruning. |
| Email | `EMAIL_DRIVER` = console (default) / resend / brevo | Missing key → console (mail is written to the function log). |
| Payments | `PAYMENTS_PROVIDER` unset = off | Never set Rasedi keys from a runbook; see docs/PAYMENTS.md. |

## 2. Deploy runbook (Vercel)

Build command on the project (set in Vercel, not in the repo):

```
npm run db:migrate:deploy && npm run db:seed && npm run build
```

So **every build — preview builds of branches too — applies pending migrations to the shared Supabase database** before
`next build`. That is why migrations must be additive only (new tables/columns/indexes; never drop/rename/retype): the
running production code must keep working against the migrated schema while the new build is still building.
`db:seed` only (re)creates the demo store when `SEED_DEMO` is set.

Steps for a normal release:

1. Branch `agentb/<topic>` or `hark/<topic>`; full gate green (`/workspace/work/gate/gate5.sh`: typecheck, lint, vitest,
   build, budget, fresh seed, Playwright mobile/e2e, smoke).
2. `git rebase origin/main`, push the branch (a preview deploy builds; watch it go READY).
3. `git merge --no-ff` into `main`, push `main`. Vercel builds and promotes production.
4. Poll until READY:
   `GET https://api.vercel.com/v6/deployments?projectId=prj_5u6PQayEDQPQ6BqAuft4v00IRcYW&teamId=team_ns9mU4eqpiLwwsegGG5z6H6e&limit=5`
   (pick the entry whose `meta.githubCommitSha` is the merge commit and `target` is `production`). On `ERROR`, read
   `GET https://api.vercel.com/v3/deployments/<uid>/events?teamId=…` — the failing step is near the end.
5. Post-deploy checks, all must be 200:
   ```
   for p in / /pricing /s/hawler-bazaar /api/health; do curl -s -o /dev/null -w "%{http_code} $p\n" https://bazarga.vercel.app$p; done
   curl -s https://bazarga.vercel.app/api/health   # {"status":"ok","db":"ok","sha":"<merge commit>",…}
   ```
   `sha` in the health response must equal the merge commit — that proves the new build is the one serving.
6. Append to `docs/HANDOFF.md` and tick `docs/LAUNCH.md`.

### Rollback

- **Code:** Vercel → Deployments → previous production deployment → *Promote* (instant, no rebuild). Or
  `git revert -m 1 <merge>` and push `main`. Then check `/api/health` reports the old sha.
- **Schema:** never roll back a migration by hand. Migrations are additive, so the previous build runs fine on the newer
  schema; fix forward with the next numbered migration.

## 3. Environment

Required in production: `POSTGRES_URL` (or `DATABASE_URL`), `APP_URL` (https), `CRON_SECRET` (≥16 chars).
Recommended before real sellers: `ADMIN_EMAILS`, `EMAIL_DRIVER` + `RESEND_API_KEY` or `BREVO_API_KEY`, `EMAIL_FROM` on a
verified domain, `ROOT_DOMAIN` once a domain is bought. Never commit secrets; `.env.example` lists every variable.

## 4. Backups

### What Supabase does for you
- Free plan: daily backups kept a short time, **not downloadable** and no point-in-time recovery. Treat them as a last
  resort, not as our backup.
- Pro plan: daily downloadable backups (7 days); PITR is a paid add-on.

### Our own backup (do this — it is free)
A logical dump of the whole database, taken with the **direct** (non-pooler) URL:

```
# needs pg_dump 17 (matches Supabase Postgres); the URL is POSTGRES_URL_NON_POOLING from Vercel env
pg_dump "$POSTGRES_URL_NON_POOLING" \
  --format=custom --no-owner --no-privileges --schema=public \
  --file=bazarga-$(date -u +%Y%m%dT%H%MZ).dump
```

- Schedule: daily (GitHub Actions cron or the VPS crontab), keep 14 daily + 8 weekly. Store the file **outside**
  Supabase (R2 bucket with object lock, or the VPS + an off-site copy). Encrypt at rest (`age`/`gpg`) — it holds
  customer names, phones and addresses.
- Uploads: product images live in Supabase Storage. Mirror the `uploads` bucket weekly
  (`rclone sync supabase:uploads r2:bazarga-uploads-backup`) — renditions can be regenerated (`npm run images:backfill`),
  originals cannot.
- Before every risky change (a migration that backfills data, a bulk script): take a manual dump first.

### Restore (practise this once before launch)

1. Create an empty Postgres (a new Supabase project, or local `docker run postgres:17`).
2. `pg_restore --no-owner --no-privileges --dbname="$TARGET_URL" bazarga-<stamp>.dump`
3. `DATABASE_URL="$TARGET_URL" npm run db:migrate:deploy` — applies anything newer than the dump (no-op if current).
4. Point a preview deployment's `POSTGRES_URL` at it, open `/api/health` (db ok), log in as a test seller, open a store,
   place a COD order. Only then switch production env and redeploy.
5. Restore of a single store's rows: restore into a scratch DB, then copy rows with `\copy … where store_id = '<id>'`
   table by table (stores → categories → products → … → orders → order_items). Tenant data is always keyed by
   `store_id`.

RPO with the daily dump: ≤24 h. RTO: ~30 min for the whole DB at launch size.

## 5. Monitoring and logs

- **Uptime:** point a free monitor (UptimeRobot / Better Stack free) at `https://<host>/api/health` every 5 min; alert on
  non-200. `503 {"status":"degraded"}` means the DB did not answer within 3 s.
- **Logs:** the app writes one JSON line per event to stdout (`src/server/logger.ts`, secrets redacted). Vercel →
  Logs, filter by `"level":"error"`. Useful messages: `order.created`, `order.replayed` (idempotent retry or double tap),
  `health.db_failed`, `cron.daily_failed`, `email.provider_key_missing`, `payment.start_failed`.
- **Errors in the UI** show a reference (`error.digest`); search the logs for that digest.

## 6. Incidents (first five minutes)

| Symptom | Check | Action |
| --- | --- | --- |
| Site 5xx everywhere | `/api/health` | 503 → Supabase status page / connection limits; 200 → roll back the last deploy. |
| Build failing on Vercel | deployment events | Usually a migration error → fix forward in a new numbered migration. |
| Orders not arriving | logs `order.created` | Rate limits (`RATE_LIMITED`) or a payment method disabled by the seller. |
| Password reset mail missing | logs `email.console` | No provider key set → mail only in logs; set `EMAIL_DRIVER` + key. |
| Cron did nothing | logs `cron.daily_failed`, Vercel → Cron Jobs | `CRON_SECRET` missing → the route answers 404. |

## 7. Data retention and privacy

Rate-limit counters older than a day are pruned daily. Analytics store aggregates only (no IP/UA). Customer data stays
until the seller deletes it or closes the store (cascade by `store_id`). See /privacy for the public policy.
