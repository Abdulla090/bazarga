# Bazarga Redesign v2 — "Editorial Commerce" (Oct 10, 2026)

Abdulla: "super creative, hyper professional, absolute professional sleek. Study ElevenLabs and Shopify."
Raw studies: docs/design-study/elevenlabs.md, docs/design-study/shopify.md. This file is the spec; it overrides older visual rules in DESIGN.md.

## What we take
- ElevenLabs: quiet off-white canvas with hairline rules instead of boxed bands; big LIGHT display type (anti-bold); exactly two CTA styles (ink pill, outline pill); color only inside content, never in chrome; one idea per section, 2–4 word headings.
- Shopify.com: variable-font light display with tight tracking; generous section rhythm; 150ms transitions; slide-up-fade reveals.
- Dawn (Shopify storefront): photos carry the brand; product card = image + title + price, nothing else; one badge max, bottom-start pill; Add to cart outline + Buy now solid, full width; muted text via opacity, not extra grays; the only chromatic accent is a calm blue for "Sale".

## Tokens
- Canvas #FAFAF9, surface #FFFFFF, ink #0A0A0A, muted = ink at 60%, faint = ink at 40%, hairline #E7E5E4 (1px), image placeholder #F4F4F5.
- Accent blue #2563EB: focus ring, links, selected state, Sale badge. Nothing else is colored. No red, orange, yellow; WhatsApp button becomes outline pill with icon (no green fill). Success/error only in toasts/forms.
- Type: display = Inter / Vazirmatn variable at weight 350 (ku/ar 400), tracking -0.025em (Latin only; 0 for Arabic script), line-height 1.05. Scale: 56/40/28 desktop, 36/28/22 phone. UI 15px/400, labels 13px/500, prices tabular-nums 500.
- Radius: pills full; cards and images 16; inputs 12. Shadows: none on cards; one soft shadow only for sheets/popovers.
- Spacing: 4px grid; section gap 96 desktop / 56 phone; content max 1200px, 24px gutters (16 at 360px).
- Motion: 150ms ease-out for hover/press; image hover scale 1.03 over 500ms; section reveal = fade + 8px rise via CSS `animation-timeline: view()` with no-op fallback; View Transitions between product grid and product page (shared image). All off under prefers-reduced-motion.

## Components
- Button: two variants only — `primary` ink fill/white text, `secondary` white/1px ink border. Height 48 (44 min), rounded-full, 15px/500. Remove every other button colour.
- Header: 64px, hairline bottom, logo mark + store name at 15px/500 left, cart icon button with count dot right. No tagline. Becomes translucent (backdrop-blur, 80% canvas) on scroll.
- Hero: store name as huge light display, one-line tagline, single primary pill; photo below or beside at 16 radius. No duplicated logo.
- Product card: 4:5 image on placeholder, 16 radius, no border/shadow; title 14/400, price 14/500 (old price faint, strikethrough); one badge max (Sale blue, Sold out ink) bottom-start; no Add-to-cart button on the card on desktop (hover reveals a small outline pill), phone keeps tap-to-open.
- Grids: `repeat(auto-fill, minmax(240px,1fr))` desktop; 2 columns phone. Rows with fewer than 4 items on desktop become a horizontal scroll-snap rail, never a half-empty grid.
- Product page: gallery left (thumbnails under on phone), right column: title (display 40), price, variant pills, quantity, Add to cart (secondary) + Buy now (primary) full width, then ONE hairline row of three small items (COD · delivery · returns) and accordions (Details, Delivery & returns). Remove: "you save" line, duplicate coupon card, free-delivery banner, 4 trust tiles, WhatsApp question tile (keep one WhatsApp outline pill). Sticky bar on phone only after the main buttons scroll out, with page padding so it never covers content.
- Coupon: single hairline row "10% off with SAVE10" + copy button; no icon tile.
- Category chips: outline pills, selected = ink fill. No coloured chips.
- Footer: hairline top, two short columns, language switcher as text pills.

## Copy rules
- Headings 2–4 words. Max one sentence of supporting text per section. Delete helper text that repeats a label. No emoji, no cultural/themed wording.

## Demo content
- Replace seed photos with neutral modern product shots (ceramics, candles, headphones, tote, skincare, tees) on plain backgrounds, and a neutral store name (e.g. "Hawler Studio" → "Studio Hawler" is fine; avoid "Bazaar"). Keep slug for tests or update tests.

## Rollout order (one per loop run, each with 390 ku + 1280 en screenshots reviewed)
1. Tokens + Button (two variants) + chips + badge colours.
2. Header + hero.
3. Product card + grids/rails.
4. Product page declutter + sticky bar fix.
5. Neutral demo photos/seed.
6. Motion: reveals + View Transitions.
7. Cart, checkout, order status on the same system.
8. Seller dashboard on the same tokens (Hark lane; Agent B if Hark silent 6h).
