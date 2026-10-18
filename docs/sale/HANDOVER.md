# Reelcart — handover

What a buyer receives and how each piece moves to them. Final scope and terms are set in the written sale
agreement; this is the practical checklist.

## What transfers

| Asset | Today | How it transfers |
|---|---|---|
| Source code + full git history | GitHub `Abdulla090/bazarga` (private) | GitHub repository transfer to the buyer's account or organisation |
| Intellectual property | Copyright Abdulla Aziz Hameed, all rights reserved (LICENSE) | Assignment in the sale agreement; buyer then updates LICENSE |
| Live deployment | Vercel project `bazarga` → <https://bazarga.vercel.app> | Vercel project transfer to the buyer's team, **or** buyer deploys fresh with the Deploy button (recommended; 15 min) |
| Database | Supabase Postgres (demo data, test sellers) | Usually not transferred: buyer starts fresh (`SEED_DEMO=false`). On request: `pg_dump` handed over securely |
| Product photos | Supabase Storage bucket `uploads` | Included in a database handover if requested; demo photos also ship in the repo (`public/images/seed`) |
| Brand | Name "Reelcart" (formerly codenamed Bazarga; Kurdish/Arabic UI keeps the local name بازارگە), logo and wordmark (in repo), landing copy in 4 languages | Included with the code |
| Domain | None in use (site runs on `bazarga.vercel.app`; suggested `reelcart.app` is not registered) | Nothing to transfer; buyer adds their own domain (docs/SETUP.md §4.3) |
| Documentation | README, docs/SETUP.md, docs/sale/*, OPS, PAYMENTS, CAPACITY, PERFORMANCE, design docs | In the repo |
| Demo videos + acquisition brief | PDF brief (Reelcart); mobile and desktop walkthrough videos are a legacy codename build (old Bazarga wordmark) | Delivered as files alongside the repo |
| Third-party accounts | None with paid commitments. Rasedi payment KYC not started | Buyer opens their own (payment provider KYC is tied to the buyer's legal entity) |

Not included unless agreed: support after handover, the seller's personal accounts (GitHub, Vercel, Google), and
any live sellers' data.

## Transfer steps

1. **Agreement signed** and payment cleared (escrow recommended, e.g. via the marketplace's escrow).
2. **GitHub:** seller → repo **Settings → General → Danger Zone → Transfer ownership** → buyer's username/org.
   Buyer accepts the email. (GitHub keeps redirects from the old URL.)
3. **Deploy:** choose one:
   - *Fresh (recommended):* buyer clicks **Deploy with Vercel** in their copy of the README and follows
     docs/SETUP.md. New database, new keys, nothing shared with the seller.
   - *Transfer existing project:* seller → Vercel project **Settings → General → Transfer Project** → buyer's
     team. The Supabase integration must be reconnected on the buyer's side; then rotate every secret (step 5).
4. **Update the Deploy button URL** if the repository name or owner changed: in README.md replace
   `github.com/Abdulla090/bazarga` with the new path (two places in the button link).
5. **Rotate secrets** (only if anything was transferred, not needed for a fresh deploy): new `CRON_SECRET`, new
   Supabase project or reset its service key and DB password, `ADMIN_EMAILS` = buyer's email, demo password
   changed or demo removed (`SEED_DEMO=false` + SQL in SETUP.md §3).
6. **Licence:** buyer replaces LICENSE with their own terms once the assignment is effective.
7. **Seller cleanup:** seller removes their own access (GitHub collaborator, Vercel team), deletes the old Vercel
   project and Supabase project after the buyer confirms their deployment is live.
8. **Optional knowledge-transfer call** (if agreed): a 60-minute walkthrough of the dashboard, admin, deploy, and
   where things live in the code.

## Buyer's first-week checklist
- [ ] Live on your own Vercel + Supabase, `/api/health` shows `status: ok`
- [ ] Signed up with your admin email, `/admin` opens
- [ ] Demo off or password changed
- [ ] Your domain + `APP_URL` (and `ROOT_DOMAIN` for store subdomains)
- [ ] Email provider (Resend/Brevo) so password resets work
- [ ] R2 for photos once you pass ~700 MB
- [ ] Apply to Rasedi for online payments (FIB, ZainCash, cards) — weeks of KYC, start early
- [ ] Review legal pages (terms, privacy, refund) for your company name and jurisdiction
