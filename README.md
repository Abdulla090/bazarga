# Bazarga · بازارگە

**Turn TikTok, Instagram and WhatsApp views into real orders.** A Kurdish-first online store builder for sellers in Iraq and the Kurdistan Region.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAbdulla090%2Fbazarga&project-name=bazarga&repository-name=bazarga&env=APP_URL%2CCRON_SECRET%2CADMIN_EMAILS%2CSEED_DEMO&envDescription=APP_URL%20%3D%20https%3A%2F%2F%3Cproject-name%3E.vercel.app%20%C2%B7%20CRON_SECRET%20%3D%20any%20long%20random%20text%20%2824%2B%20chars%29%20%C2%B7%20ADMIN_EMAILS%20%3D%20your%20email%20%C2%B7%20SEED_DEMO%20%3D%20true%20to%20keep%20the%20demo%20store%2C%20false%20for%20an%20empty%20site&envLink=https%3A%2F%2Fgithub.com%2FAbdulla090%2Fbazarga%2Fblob%2Fmain%2Fdocs%2FSETUP.md&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%7D%5D)

> The button creates your own copy of the code, a Vercel project and a free Supabase database in one flow.
> Full no-code guide: **[docs/SETUP.md](docs/SETUP.md)**.

---

## What Bazarga is

Sellers in Iraq already get attention on TikTok, Instagram and WhatsApp. What they lose is everything after the
view: DMs pile up, "how much?" gets answered a hundred times a day, there is no order record, no tracking, and no
idea which platform actually sold.

Bazarga gives every seller a mobile store in minutes: one link for the bio, every product with a visible price,
structured cash-on-delivery orders (name, phone, city, area), the order handed to WhatsApp, and analytics that
show **which platform sold**. Sorani Kurdish is the default language; Kurmanji, Arabic and English are built in,
with full right-to-left support.

It is a multi-tenant SaaS: you run the platform, sellers sign up, and you charge them monthly plans
(Free / Pro / Business / Max).

## Live demo

| | |
|---|---|
| Landing page | <https://bazarga.vercel.app> |
| Demo store ("Studio Hawler") | <https://bazarga.vercel.app/s/hawler-bazaar> |
| Seller dashboard | <https://bazarga.vercel.app/login> — `demo@mymarket.app` / `mymarket-demo` |
| Pricing | <https://bazarga.vercel.app/pricing> |
| Health check | <https://bazarga.vercel.app/api/health> |

Screenshots: [docs/sale/screenshots](docs/sale/screenshots) · 90-second walkthrough videos: [mobile, Kurdish](docs/sale/video/bazarga-demo-mobile.mp4) · [desktop, English](docs/sale/video/bazarga-demo-desktop.mp4).

## Features

**Storefront**
- Mobile-first store at `/s/<store>` (or `<store>.yourdomain.com`), cover hero, categories, instant search with Kurdish/Arabic letter folding
- Product pages: swipe gallery, fullscreen zoom, variants (size/colour) with per-variant stock, compare-at prices, specs, related products
- Cart drawer, wishlist, recently viewed, delivery fee per city and area, free-delivery threshold, discount codes
- Order confirmation, shopper order tracking (`/track`), WhatsApp hand-off, installable PWA with offline page

**Seller dashboard**
- Overview with KPIs and a first-run setup checklist; Cmd-K command palette and keyboard shortcuts
- Products (variants, photos auto-compressed and resized, CSV export), categories, low-stock alerts
- Orders: status timeline, courier sheet, printable slips, WhatsApp reply templates, CSV export, block abusive phone numbers
- Customers, delivery zones and areas, discount codes, payments settings, plan upgrade requests

**Theme Studio (10 presets)**
- Studio, Ivory, Midnight, Gallery, Boutique, Stone, Mono, Editorial, Market, Fresh — one click to switch
- Live phone/desktop preview, colours, type scale, buttons, cards, header, announcement bar, undo/redo, "surprise me"
- Draft autosave + publish; contrast checker

**Analytics**
- Visitors, views, orders, conversion, revenue (7/30/90 days), by-day charts, best sellers, most viewed
- Orders by source (TikTok / Instagram / WhatsApp / Facebook / Telegram / Snapchat / QR) with conversion per platform
- Funnel (visit → product → checkout → order), sales by city, new vs returning customers, when orders arrive heatmap
- Cookie-free, privacy-light counting; optional seller TikTok Pixel + Meta Pixel

**Social / share kit**
- Per-product share modal: 9:16 story and 1:1 post images (photo, price, QR) drawn in the browser, ready to download
- Caption generator in Kurdish / Arabic / English with hashtags; copy link per platform (auto-tagged `?src=`)
- Short links `/p/<code>`, rich link-preview cards for WhatsApp/Telegram/Instagram, store QR code (PNG/SVG), bio text

**Orders / WhatsApp**
- Structured cash-on-delivery checkout with Iraqi phone validation (Korek, Asiacell, Zain)
- WhatsApp message to the seller with the full order and tracking link; seller alerts via email, Telegram, WhatsApp Cloud API or web push
- Idempotent orders (no double orders on retry), order risk flags

**4 languages + RTL**
- Sorani Kurdish (default), Kurmanji, Arabic, English across the whole app; RTL layouts, Kurdish fonts, localized emails

**Security**
- scrypt password hashing, hashed single-use reset/verification tokens, email verification
- Rate limits on every public form, strict CSP with nonces, HSTS, frame protection, audit log, 0 known npm vulnerabilities

**Payments-ready**
- Cash on delivery works everywhere today
- Rasedi gateway integration (FIB, ZainCash, AsiaPay, NassWallet, cards) is **built and tested, switched off until you add keys** — subscriptions and storefront orders, webhooks, reconciliation, payouts ledger

**Platform admin**
- `/admin` for plan activation, payments, payouts and the waitlist; plans and limits enforced server-side

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · PostgreSQL + Drizzle ORM · Zod · Tailwind CSS 4 ·
next-intl · sharp (image pipeline) · Vitest + Playwright. Hosted on Vercel + Supabase (free tiers), or one
Docker container on any VPS. No paid SDKs; every external service is optional and switched on by an env var.

## Deploy in 15 minutes

1. **Click "Deploy with Vercel"** above (sign in with GitHub). It copies the code to your GitHub and adds a free Supabase database.
2. **Fill 4 values** when asked: `APP_URL` (`https://<project-name>.vercel.app`), `CRON_SECRET` (any long random text), `ADMIN_EMAILS` (your email), `SEED_DEMO` (`true` to keep the demo store, `false` for an empty site).
3. **Wait for the build** (about 3 minutes; it creates the database tables for you), open your site, and sign up with your admin email.

Optional later: your own domain, Cloudflare R2 for photos, email sending, online payments. Each is a few
clicks; see [docs/SETUP.md](docs/SETUP.md). Every setting is listed in [.env.example](.env.example).

## Documentation

| | |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | No-code setup, integrations, troubleshooting |
| [docs/sale/FEATURES.md](docs/sale/FEATURES.md) | Full feature inventory |
| [docs/sale/TECH.md](docs/sale/TECH.md) | Architecture, data model, tests, security, costs |
| [docs/sale/HANDOVER.md](docs/sale/HANDOVER.md) | What transfers to a buyer and how |
| [docs/sale/ROADMAP.md](docs/sale/ROADMAP.md) | Coming-soon features and growth ideas |
| [docs/DEVELOPERS.md](docs/DEVELOPERS.md) | Developer guide (local dev, scripts, Docker/VPS) |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) · [docs/OPS.md](docs/OPS.md) · [docs/CAPACITY.md](docs/CAPACITY.md) | Payments, operations, capacity |

## License

Proprietary. Copyright © 2026 Abdulla Aziz Hameed. All rights reserved. See [LICENSE](LICENSE).
