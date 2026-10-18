# Bazarga — full feature inventory

Status as of 2026-10-18. "Built" means merged on `main` and live on <https://bazarga.vercel.app> unless marked
**off until keys** (code complete, switched on by an environment variable) or **soon** (see ROADMAP.md).

## 1. Positioning
Social-first: sellers keep posting on TikTok, Instagram and WhatsApp; Bazarga turns those views into structured
orders and tells the seller which platform sold. Built for Iraq and the Kurdistan Region: Sorani Kurdish first,
IQD prices, cash on delivery, delivery by city/area, Iraqi phone formats, WhatsApp as the hand-off.

## 2. Marketing site
- Landing page in 4 languages: hero ("Keep posting on TikTok. Bazarga turns views into orders."), DMs-vs-Bazarga comparison, product tour, FAQ, live counters, footer
- Pricing page (Free / Pro / Business / Max, monthly and yearly with 2 months free), comparison table
- Showcase of real stores (opt-in), founding-seller badge, waitlist with referral ranking (`/waitlist/<code>`)
- Status page (`/status`), legal pages (terms, privacy, refund), localized 404/500 pages
- SEO: sitemap, robots, Open Graph images, structured data (Product JSON-LD), canonical URLs

## 3. Storefront (shopper side)
- Store home `/s/<store>` or `<store>.yourdomain.com`: cover hero, logo, tagline, about, category chips, "show more" pagination
- Instant search across all languages with Arabic/Kurdish letter folding (ي/ی, ك/ک, ه/ە …), works without JavaScript
- Product page: swipe gallery with counter, thumbnails, fullscreen viewer with pinch/double-tap zoom; compare-at price with % off; stock status; SKU; quantity stepper; trust row (COD, delivery fee + ETA, returns, WhatsApp); description, specs table, delivery & returns; related products
- Variants (size, colour, …) with per-variant price, stock and SKU; real colour swatches
- Cart drawer and cart page; wishlist; recently viewed; quick add
- Checkout: structured cash-on-delivery form, Iraqi mobile normalisation and operator validation (Korek 75, Asiacell 77, Zain 78/79), city → delivery area with its own fee or free text, landmark, notes, discount codes (percentage / fixed / free delivery), free-delivery threshold nudge, honeypot anti-spam
- Order confirmation with WhatsApp hand-off to the seller (prefilled message with items, total, tracking link)
- Order tracking page `/track` (order number + phone), status timeline in Baghdad time
- Short product links `/p/<code>`, per-product 1200×630 link-preview cards for WhatsApp/Telegram/Instagram
- Floating WhatsApp button; "Made with Bazarga" badge on the Free plan
- Installable PWA with Kurdish offline page; responsive images (WebP renditions + blur placeholders)
- Seller TikTok Pixel and Meta Pixel events (PageView, ViewContent, AddToCart, Purchase), respecting Do-Not-Track/GPC

## 4. Seller dashboard
- Sign up, email verification, login, password reset; onboarding wizard (store name, link, theme)
- Overview: KPIs with trends, latest orders, running-low products, first-run setup checklist
- Cmd-K command palette and "g then key" keyboard shortcuts; skeleton loading states; mobile tab bar
- Products: create/edit with photos (browser compression before upload, server renditions), variants editor, specs editor, categories, low-stock alerts, CSV export
- Orders: list with filters and search, detail with status timeline, history notes, courier + tracking number, printable slip, courier sheet, WhatsApp reply templates, quick replies, order source ("From TikTok"), risk flags, CSV export, block abusive phone numbers
- Customers list; delivery zones and areas per city; discount codes screen
- Settings: store info, cover photo, contact/WhatsApp, pixels, showcase opt-in, push notifications toggle
- Payments: cash on delivery; online payment methods toggle (when the platform has a gateway); payout profile
- Plan usage meter and upgrade requests (`/dashboard/upgrade`), pay online (**off until keys**) or manually
- AI store builder: photos + a message → draft products (**off until keys**)

## 5. Theme Studio (10 presets)
- Presets: Studio, Ivory, Midnight, Gallery, Boutique, Stone, Mono, Editorial, Market, Fresh
- 7 layout designs behind them (classic, editorial, market, gallery, boutique, mono, studio)
- Live preview in phone or desktop frame; colours (accent, background, surface, text), type scale, button shape/style, card radius/style/ratio, background (solid/gradient/pattern), header layout, announcement bar
- Undo/redo, "surprise me", draft autosave, publish; low-contrast warning

## 6. Analytics
- Visitors, store views, product views, orders, conversion, revenue for 7 / 30 / 90 days with trend vs previous period
- By-day charts and table; best sellers; most viewed
- Orders by source (TikTok, Instagram, WhatsApp, Facebook, Telegram, Snapchat, QR, direct) with conversion per platform
- Funnel: visited → opened a product → opened checkout → ordered; WhatsApp-tap rate
- Sales by city; new vs returning customers; "when orders arrive" weekday × hour heatmap
- Privacy-light: same-origin counting, no cookies for analytics, aggregate counters only

## 7. Social / share kit
- Store share kit `/dashboard/share`: store link, bio text, ready-to-post captions, QR code (PNG/SVG download), Instagram story image
- Per-product share modal: 9:16 story and 1:1 post images drawn in the browser (photo, name, IQD price, store name, QR), download or Web Share
- Caption generator in Kurdish / Arabic / English with hashtags; copy link per platform, each tagged `?src=<platform>` for attribution

## 8. Notifications
- Seller new-order alerts by email, Telegram bot, WhatsApp Cloud API or web push (each **off until keys**; console fallback)
- Transactional email via Resend or Brevo (**off until keys**; console fallback), localized templates

## 9. Languages
- Sorani Kurdish `ku` (default, RTL), Kurmanji `kmr` (Latin), Arabic `ar` (RTL), English `en`
- ~1,500 message lines per language, parity tested; each store picks its default shopper language; Kurdish/Arabic fonts subset and self-hosted

## 10. Payments
- Cash on delivery: everywhere, always
- Rasedi gateway (FIB, ZainCash, AsiaPay, NassWallet, cards) for seller subscriptions and storefront orders: hosted checkout, signed requests (Ed25519), webhook with secret + dedupe, status polling, reconciliation cron, expiry of abandoned orders with stock release, platform commission, payouts ledger and admin payout flow — **built, tested, off until keys**
- Manual upgrade path (FIB / ZainCash / cash transfer → admin activates)

## 11. Plans and billing
- Free $0 (10 products) · Pro $15/month with $1 first month (100 products) · Business $50 (unlimited) · Max $100 (unlimited); yearly = 2 months free
- Limits enforced server-side; Product Studio quota per plan (Product Studio itself is **soon**); plan history and expiry handled by the daily cron

## 12. Platform admin (`/admin`)
- Upgrade requests → activate plans; payments list; payout profiles (verify/reject), queue and mark payouts; waitlist; restricted to `ADMIN_EMAILS`

## 13. Security and operations
- scrypt password hashing; hashed single-use reset and verification tokens; sessions revoked on reset
- Postgres-backed rate limits on every public POST (auth, checkout, tracking, uploads, waitlist, share)
- Strict Content-Security-Policy with per-request nonces, HSTS (2 years, preload), frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, COOP; CSP violation reporting
- Tenant isolation on every query; idempotent order creation; audit log for settings changes
- Health endpoint with integration status; structured JSON logs; optional error webhook (Discord/Slack)
- Daily cron: plan expiry, payment reconciliation, rate-limit pruning; backups runbook (docs/OPS.md)
