# Reelcart — roadmap for a new owner

What is marked "Soon" in the product today, then the growth ideas with the most leverage. Each item notes the code
seam that already exists, so a developer can pick it up quickly. Detailed engineering notes: docs/ROADMAP.md.

## "Soon" in the product today (shown on the pricing page)

| Feature | Plan | Seam already in the code |
|---|---|---|
| Online payments (FIB, ZainCash, AsiaPay, NassWallet, cards) | Pro and up | Rasedi gateway built and tested; needs merchant KYC + keys (docs/PAYMENTS.md) |
| Product Studio (photo clean-up/enhancement, monthly quota 10/100/100) | Pro, Business, Max | Quota table + plan limits (`product_studio_usage`, `src/lib/plans.ts`) |
| Custom domain per seller (`shop.yourbrand.com`) | Business, Max | `stores.custom_domain`, subdomain routing in `src/proxy.ts` + `src/lib/domains.ts` |
| AI product descriptions | Business | AI builder (`src/server/ai`) behind `AI_ENABLED` |
| AI Website Designer, exclusive designs, premium templates, monthly design refresh | Max | Theme Studio schema + 7 layout designs (`src/lib/theme-studio`) |
| Priority processing | Max | Queue/ordering for Product Studio once it ships |
| Sign in with WhatsApp (phone OTP) | All | `OtpProvider` interface (`src/server/otp`) |

## Shipped from the "Soon" list (Oct 18, 2026)

| Feature | Plan | Where it lives |
|---|---|---|
| Bulk CSV import (preview, per-row validation, plan product cap) | Business, Max | `/dashboard/products/import`, `src/lib/products-csv-import.ts`; gate `assertFeature(store, "bulkCsv")` (`src/server/plan-gate.ts`) |
| Advanced SEO + white-label (store + product meta title/description, share image, per-store sitemap, JSON-LD Store/Product, white-label switch) | Max | `/dashboard/settings/seo`, `src/lib/seo.ts`, `src/server/actions/seo.ts`, `/s/<slug>/sitemap.xml`; migration 0025 |
| Multiple stores per account (store switcher, add-store flow, stores share and renew with the plan) | Business 3, Max 5 | `/dashboard/stores`, header switcher, `src/server/services/store-access.ts` (limits, current-store cookie `rc_store`) |
| Team members (owner + staff, email or copy-link invites, accept, remove, owner-only areas) | Pro 2, Business 5, Max 10 seats | `/dashboard/team`, `/invite/<token>`, `src/server/services/team.ts`, `requireOwner` / `requireOwnerPage`; migration 0026 |

## Growth ideas (highest leverage first)

1. **Switch on online payments and take a commission.** `PLATFORM_COMMISSION_BPS` already exists: a 1–2% fee on
   card/wallet orders adds revenue on top of subscriptions.
2. **WhatsApp-first onboarding.** A seller sends product photos + prices to a WhatsApp number in Kurdish or Arabic;
   the existing AI builder drafts the products; one tap publishes. This is the core differentiator in Iraq.
3. **Courier integrations.** Create shipments and sync status with local delivery companies (the courier sheet and
   tracking fields are already there); charge per shipment or include in Business.
4. **Instagram / TikTok catalogue sync.** Import products from a seller's posts; push the catalogue to Meta and
   TikTok Shops where available.
5. **Agency / reseller channel.** Social-media agencies in Erbil, Sulaymaniyah, Baghdad and Duhok set up stores for
   their clients; white-label on Max is the hook.
6. **Expand regionally.** The stack already speaks Arabic and Kurmanji; adding Turkish and Persian covers
   neighbouring diaspora markets (the landing already shows stores "from Erbil to Berlin").
7. **Marketplace / showcase.** Turn the existing showcase page into a discovery directory of Reelcart stores with
   search by city and category.
8. **Retention tools.** Abandoned-cart WhatsApp reminders, repeat-customer discounts, loyalty points — the customer
   and discount tables already exist.
9. **Native wrapper.** The PWA is installable today; a thin Android wrapper on Google Play would help discovery.

## Known gaps to close early
- Kurmanji translation needs a native-speaker review
- Lighthouse performance on store/product pages is 78–92 (mobile); trimming shared client JS is the next step
- Final legal review of terms/privacy for the buyer's entity; cookie notice
- Manual verification of the Deploy button on a fresh account (tracked in docs/BACKLOG.md, SALE-READY S12)
