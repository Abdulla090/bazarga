# Reelcart — setup guide (no coding needed)

This guide takes you from nothing to your own live Reelcart in about 15 minutes, then shows how to switch on each
optional service. You only click and paste. Every setting Reelcart reads is listed, with comments, in
[`.env.example`](../.env.example).

**You need:** a GitHub account and a Vercel account (free; "Continue with GitHub"). A Supabase account is created
for you during step 1 if you don't have one.

Where settings live: **Vercel → your project → Settings → Environment Variables**. After adding or changing any
variable, go to **Deployments → ⋯ on the newest one → Redeploy**, because settings only apply to new deployments.

---

## 1. Deploy (the button)

1. Open the repository's README and click **Deploy with Vercel**.
   - If you received the repository by transfer and renamed it, use the button from *your* copy, or in Vercel
     choose **Add New → Project → Import** your repository (then do step 2 by hand: Storage → Supabase).
2. **Git repository:** choose your GitHub account and keep the name `bazarga` (it can be private).
3. **Supabase:** the flow asks you to add the Supabase integration. Click **Add**, accept, pick the free plan and
   the region closest to your customers (Frankfurt `eu-central-1` is closest to Iraq). This creates the database
   and photo storage and pastes their keys into Vercel for you (`POSTGRES_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, …). Do not type these yourself.
4. **Environment variables** — the form asks for four values:

   | Name | What to paste |
   |---|---|
   | `APP_URL` | `https://<project-name>.vercel.app` — the project name you chose, e.g. `https://bazarga-shop.vercel.app`. No slash at the end. You can change it later to your own domain. |
   | `CRON_SECRET` | Any long random text, 24+ characters (e.g. mash the keyboard, or a password generator). Keeps the nightly maintenance job private. |
   | `ADMIN_EMAILS` | Your email address. Several? Separate with commas. |
   | `SEED_DEMO` | `true` to include the demo store "Studio Hawler" (nice for showing people), `false` to start empty. |

5. Click **Deploy**. The build takes about 3 minutes. It creates all database tables automatically
   (`vercel.json` runs migrations, then the optional demo seed, then the app build).
6. When you see "Congratulations", click the preview to open your site.

**Check it works:** open `https://<your-site>/api/health`. You should see `"status":"ok"` and `"db":"ok"`.

## 2. Make yourself admin

1. On your site click **Start free / Sign up** and register with the email you put in `ADMIN_EMAILS`.
2. Open `https://<your-site>/admin`. You can now activate seller plans, see payments and payouts, and manage the waitlist.
3. To add another admin later: add their email to `ADMIN_EMAILS` (comma-separated) → Redeploy.

If `/admin` shows "not found": the email doesn't match exactly (check spelling/capitals), or you didn't redeploy after changing it.

## 3. Turn the demo off

- **Before the first deploy:** set `SEED_DEMO=false`. No demo seller or store is ever created.
- **Already deployed with the demo:** set `SEED_DEMO=false` in Vercel and redeploy (stops it being re-created), then
  remove the existing demo: Supabase → your project → **SQL Editor** → run
  `delete from users where email = 'demo@mymarket.app';` (this deletes the demo seller and, automatically, its store, products and orders).
- **Demo plan:** the demo store is put on `SEED_DEMO_PLAN` (default `max`) on every deploy, so visitors see every feature. Set it to `free` to demo the Free plan.
- **Keeping the demo but want it private:** set `SEED_DEMO_PASSWORD` to a new password *before the first deploy*.
  If it already exists, log in as the demo and change the password from "Forgot password", or delete it as above.

---

## 4. Optional integrations

Everything below is off (or on a free fallback) until you paste its values. Nothing breaks if you skip it.
`/api/health` → `integrations` shows which ones are live.

### 4.1 Photo storage on Cloudflare R2 (recommended when you grow)
Photos go to Supabase Storage by default (free 1 GB). R2 gives 10 GB free and costs ~$0.015/GB after.
1. <https://dash.cloudflare.com> → **R2 Object Storage** → **Create bucket** → name `bazarga-uploads`.
2. Bucket → **Settings → Public access → R2.dev subdomain → Allow**. Copy the `https://pub-….r2.dev` URL.
   (Or connect a custom domain such as `img.yourdomain.com`.)
3. R2 overview → **Manage R2 API Tokens → Create API token** → permission *Object Read & Write*, this bucket only.
   Copy the Access Key ID and Secret Access Key. Your Account ID is on the R2 overview page.
4. Paste into Vercel:

   | Env | Value |
   |---|---|
   | `R2_ACCOUNT_ID` | Cloudflare account ID |
   | `R2_BUCKET` | `bazarga-uploads` |
   | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | from the token |
   | `R2_PUBLIC_URL` | the `https://pub-….r2.dev` (or custom) URL |

5. Redeploy. `/api/health` should show `storage.driver: "s3"`. Old photos keep working; new uploads go to R2.

### 4.2 Email (password reset, email verification, notifications)
Without this, emails are only written to the Vercel log. Pick one provider:
- **Resend** (free 3,000/month): <https://resend.com> → **Domains → Add domain** → add the DNS records it shows at
  your domain registrar → wait for "Verified" → **API Keys → Create**.
- **Brevo** (free 300/day): <https://app.brevo.com> → **Senders, domains → Domains → Add** (DNS records) →
  **SMTP & API → API keys → Generate**.

| Env | Value |
|---|---|
| `EMAIL_PROVIDER` | `resend` or `brevo` |
| `EMAIL_API_KEY` | the key |
| `EMAIL_FROM` | `Reelcart <hello@yourdomain.com>` (domain must be the verified one) |

Redeploy, then test with "Forgot password" on your own account.

### 4.3 Custom domain + store subdomains
1. Buy a domain (any registrar). Vercel → project → **Settings → Domains → Add** `yourdomain.com`.
2. For store subdomains (`shop-name.yourdomain.com`) also add `*.yourdomain.com`. Wildcards need Vercel's
   nameservers: Vercel shows `ns1.vercel-dns.com` / `ns2.vercel-dns.com` — set those at your registrar.
3. Update env and redeploy:

   | Env | Value |
   |---|---|
   | `APP_URL` | `https://yourdomain.com` |
   | `ROOT_DOMAIN` | `yourdomain.com` (turns on `<store>.yourdomain.com`; leave empty to keep stores at `/s/<store>`) |
   | `STORE_SUBDOMAINS` | leave empty; set `false` only to switch subdomains off in an emergency |

Reserved names (www, app, api, admin, mail, status, cdn, img, static) never become stores.

### 4.4 Online payments (Rasedi: FIB, ZainCash, AsiaPay, NassWallet, cards)
Cash on delivery always works. Online payments are fully built but off until you have a Rasedi merchant account.
1. Apply at <https://rasedi.com> (business KYC). You receive **test** keys first.
2. In Vercel set:

   | Env | Value |
   |---|---|
   | `PAYMENTS_PROVIDER` | `rasedi` |
   | `RASEDI_MODE` | `test` (later `live`) |
   | `RASEDI_KEY_ID` | the panel secret key (`test_…` / `live_…`) |
   | `RASEDI_PRIVATE_KEY` | the private key PEM (one line with `\n` is fine) |
   | `RASEDI_WEBHOOK_SECRET` | 24+ random characters |
   | optional | `RASEDI_GATEWAYS`, `USD_IQD_RATE` (default 1310), `PLATFORM_COMMISSION_BPS` (default 0), `RASEDI_FEE_FROM_CUSTOMER` |

3. Redeploy, make a test payment (plan upgrade), then switch to live keys and `RASEDI_MODE=live`.
4. Set up the 5-minute payments cron (4.5). Full details: [docs/PAYMENTS.md](PAYMENTS.md).

### 4.5 Cron pinger (only needed once online payments are on)
The nightly job already runs from `vercel.json`. Payments need a check every 5 minutes, which Vercel's free plan
doesn't schedule, so use a free pinger:
1. <https://cron-job.org> → sign up → **Create cronjob**.
2. URL `https://<your-site>/api/cron/payments`, every 5 minutes.
3. **Advanced → Headers:** `Authorization` = `Bearer <your CRON_SECRET>`. Save, then "Test run" should return 200.

### 4.6 Error alerts (`LOG_WEBHOOK_URL`)
Get a message whenever the server hits an error:
- Discord: channel → **Edit channel → Integrations → Webhooks → New webhook → Copy URL**.
- Slack: <https://api.slack.com/apps> → create app → **Incoming Webhooks** → add to a channel → copy URL.

Set `LOG_WEBHOOK_URL` to that URL and redeploy. (Max 20 messages/minute; secrets are redacted.)

### 4.7 Other optional extras
- **Seller order alerts:** `NOTIFY_CHANNELS` (`console,telegram,whatsapp,email`) + `TELEGRAM_BOT_TOKEN` / `WHATSAPP_CLOUD_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.
- **Phone push alerts:** run `npx web-push generate-vapid-keys` once (or any online VAPID generator) → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@yourdomain.com`.
- **AI product builder:** `AI_ENABLED=true`, `AI_API_KEY` (OpenAI or any compatible API), optional `AI_MODEL`.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails at `db:migrate:deploy` | The database isn't connected. Vercel → Storage: is Supabase connected to this project for Production *and* Preview? Reconnect, then Redeploy. |
| Site shows "Application error" / 500 | Open Vercel → Deployments → newest → **Logs**. Most often `APP_URL` is not a full `https://…` address, or `CRON_SECRET` is shorter than 16 characters. Fix the env, Redeploy. |
| `/api/health` says `db: "error"` | Supabase project paused (free projects pause after a week with no traffic). Supabase dashboard → **Restore project**. |
| Photo upload fails | `/api/health` → `storage`. If `fallback: true`, an R2 value is missing or wrong; recheck all five `R2_*` values. |
| No emails arrive | `EMAIL_PROVIDER` unset or key missing (logs show `email.provider_key_missing`), or the sending domain isn't verified yet. |
| `/admin` is "not found" | `ADMIN_EMAILS` doesn't exactly match your sign-up email, or no redeploy since changing it. |
| Store subdomains don't open | `*.yourdomain.com` missing in Vercel → Domains, nameservers not switched to Vercel yet (can take hours), or `ROOT_DOMAIN` unset. |
| Links in emails/QR codes point to the old address | Update `APP_URL` and redeploy. |
| Demo store keeps coming back | `SEED_DEMO` must be exactly `false`. |
| Online payment option not shown | `PAYMENTS_PROVIDER=rasedi` and all three `RASEDI_*` keys must be set, *and* the seller must switch it on in Dashboard → Payments. |

Still stuck? Every server error is one JSON line in Vercel → Logs with a short code matching the one shown on the
error page. Operations runbook: [docs/OPS.md](OPS.md).
