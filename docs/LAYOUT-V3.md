# Bazarga Layout v3 — "Composed Commerce" (Oct 10, 2026)

Abdulla (Oct 10 22:28): "Now work on layouts and UI UX POLISHED THEORY. Make it super super creative and hyper creative. As professional as for a 200 million dollar company."

v2 (docs/REDESIGN.md) fixed the **surface**: tokens, two button styles, light display type, hairlines, one blue. v3 fixes the **composition**: where things sit, how big they are, in what order, and how the store answers a tap. It sits on top of v2 and changes none of its tokens. This file overrides older layout rules in REDESIGN.md and DESIGN.md.

## 0. Non-negotiables carried from v2
- Canvas #FAFAF9, surface #FFFFFF, ink #0A0A0A, muted = ink 60 %, faint = ink 40 %, hairline #E7E5E4, photo placeholder #F4F4F5.
- One chromatic colour: blue #2563EB (focus ring, links, selected state, Sale badge). No red, orange, yellow or green anywhere in UI chrome.
- Hugeicons only. Two buttons only: ink pill (primary) and outline pill (secondary).
- Nothing cultural or themed; minimal copy (headings 2–4 words, one supporting sentence max).
- No new JS UI/animation libraries. Storefront first-load JS stays inside its 165 KiB budget (product page is the tightest).
- Nonce CSP intact; legacy `mm_*` ids/keys kept; ku, kmr, ar, en always in sync; tap targets ≥ 44 px; no horizontal overflow at 360 px; everything respects `prefers-reduced-motion`; no layout shift (every image has its box before it loads).

## 1. What we take from the references
| Source | What we saw | What we take |
|---|---|---|
| **Aesop** (aesop.com home, fetched Oct 10) | Full-bleed film/photo moments alternating with quiet contained sections; a "Browse by category" row of square photo tiles; 60-40 image/text split blocks ("Secondary 60-40" assets); product carousels of 6+ items with one-line descriptors; a trust row (secure checkout · samples · gift wrapping) right above a multi-column footer. | Alternating full-bleed ↔ contained rhythm. Category tiles with photography instead of text chips as the primary way into a catalog. 60/40 split for the spotlight band. Trust items as one quiet row, never cards. |
| **Apple Store** (apple.com/store, fetched Oct 10) | A huge, short headline ("Store. The best way to buy the products you love.") set as one typographic statement; everything below is horizontal "shelves" that always fill the viewport width; a footer that is a dense, small-type directory. | The hero is a typographic statement, not a banner. Shelves (rails) must always run edge to edge — never a half-empty row. Small, dense, calm footer type. |
| **Linear** (linear.app, fetched Oct 10) | Strict grid, numbered figures ("Fig 0.1 / 0.2 / 0.3") as quiet editorial labels, generous rhythm, one idea per section, a closing statement ("Built for the future. Available today.") before a 5-column footer. | Numbered section labels (01 · 02 · 03) as the only ornament. A closing statement before the footer: the store name set very large as a sign-off. |
| **NN/g — "Adding an Item to a Shopping Cart: Provide Clear, Persistent Feedback"** (nngroup.com/articles/cart-feedback) | Use a badge on the cart icon AND a secondary, more noticeable confirmation (overlay that does not disappear on its own) showing image, name, price, quantity, options; change the Add to cart label but keep adding more possible. | Cart icon count bump + a slide-over "Added" drawer that stays until dismissed, with image, name, options, quantity, price and two exits (View cart / Checkout). Button flips to "Added" briefly and stays usable. |

## 2. Grid, spacing, rhythm
- **12-column grid.** Content max-width **1280 px** (`--page-max: 80rem`). Outer margins: 16 px (≤ 639), 24 px (640–1023), 40 px (≥ 1024). Column gap 24 px desktop, 16 px tablet; phone uses a 4-column grid with 12 px gaps.
- **8 px spacing scale** — every margin, padding and gap is one of: 4 (only inside text/pills), 8, 12 (phone gaps only), 16, 24, 32, 48, 64, 96, 128. Exposed as CSS custom properties `--s-1 … --s-16` (4 × n). No other values in new code.
- **Vertical rhythm.** Sections are separated by **128 px desktop / 96 tablet / 64 phone** (`.section`). Section label → heading 8; heading → content 24 desktop / 16 phone. Body text runs on a 24 px baseline (15/24 Latin, 15/26 Arabic script).
- **Full-bleed vs contained.** A full-bleed band breaks out of the page container with `.bleed` (100vw, negative inline margins, no horizontal overflow because the root clips `overflow-x: clip`). Pattern on the store home: contained → full-bleed → contained → full-bleed, never two bleeds in a row.

## 3. Type scale (modular, ratio ≈ 1.333)
| Role | Desktop | Phone | Weight / tracking |
|---|---|---|---|
| `t-hero` (store name) | clamp 64 → 128 px, lh 0.92 | 52 px | 350, −0.04em Latin; Arabic script 400, 0, lh 1.15 |
| `t-display` (section statements, product name) | 56 px, lh 1.0 | 36 px | 350, −0.03em |
| `t-headline` (section headings) | 40 px, lh 1.05 | 28 px | 350, −0.025em |
| `t-title` (tile names, drawer heading) | 24 px, lh 1.2 | 20 px | 400, −0.01em |
| body | 15/24 | 15/24 | 400 |
| `t-label` (section index, meta) | 13 px | 13 px | 500, +0.02em, tabular numerals |
| caption | 12 px | 12 px | 400 |
Display sizes never use bold. Arabic-script locales (ku → `ckb`, ar) keep zero tracking and taller leading — negative tracking breaks joined letterforms.

## 4. Composition — store home
Order (adaptive; a section with nothing to show is skipped, and the order still alternates contained/full-bleed):
1. **Asymmetric hero (contained, image bleeds to the end edge).** Desktop: 12-col grid, the photo spans columns 6–12 and bleeds to the viewport's end edge at 4:5 / max 82vh; the store name (`t-hero`) starts in column 1 and runs over the photo's start edge by one column, set on canvas-coloured plates (`box-decoration-break: clone`) so it stays legible on any photo. Below the name: tagline (one line), ink pill "Shop now", and a quiet facts line (delivery from · cash on delivery). Phone: full-bleed 4:5 photo first, then the name plate overlapping the photo's bottom edge by 32 px, then tagline + full-width pill in the thumb zone. No store photo → type-only hero at `t-hero` on the canvas.
2. **Utility strip (contained, hairline row).** Offer code + copy pill on the start, delivery on the end; one line on desktop, two stacked rows on phone.
3. **Collections bento (contained).** One photographic tile per category (cover = first product photo in that category), name + count over a bottom gradient-free plate. 1 category: hidden. 2: 6 + 6. 3: one tall tile (cols 1–6, 2 rows) + two wide tiles stacked (cols 7–12). 4+: tall + 2×2. Phone: first tile full width, the rest in two columns. Tiles link to `?c=<id>#products`.
4. **Best sellers (contained) — "count-aware set".** Never a half-empty row: n ≥ 5 → feature tile (cols 1–6, 2 rows) + 2×2 small tiles; n = 4 → 4 × 3 cols; n = 3 → 3 × 4 cols; n = 2 → two horizontal split cards (photo + text, 6 cols each); n = 1 → folded into the spotlight. Phone: a snap rail (≈ 1.6 cards visible) so the page stays short.
5. **Spotlight band (full bleed, white surface).** One product (first seller-featured, else the top best seller, else the newest). 60/40 split: photo 7 cols (start), text 5 cols (end): section index "01", name in `t-display`, price, one line of description, ink pill "View" + outline "Add to cart" for simple products.
6. **On sale (contained)** — same count-aware set.
7. **All products (contained).** Section index + `t-headline`, search field and filter chips on one row on desktop (search 4 cols, chips 8), grid `repeat(auto-fill, minmax(240px, 1fr))` desktop / 2 columns phone, 48 px row gap desktop.
8. **Sign-off (contained) + footer.** The store name very large and faint (`t-hero`, ink 8 %) as a closing statement, then the footer.

**Sparse-row rule (global):** a row on desktop is either full (n = columns), a rail that runs past the edge, or a deliberate split. A grid row with empty columns is a bug.

## 5. Product page — two-column editorial
- Desktop ≥ 1024: 12-col grid. **Gallery cols 1–7** as a vertical stack of every photo (4:5, 16 radius, 8 px gaps) — no thumbnail rail, no counter; scrolling the page *is* the gallery. **Info column cols 9–12 (with col 8 as air), sticky at top 96 px** while the photos scroll past; if the column is taller than the viewport it scrolls normally (`max-height` + own flow, never clipped). Variant pick with its own photo scrolls that photo into view.
- Tablet 768–1023: same two columns 7/5 without the air column.
- Phone: edge-to-edge swipe carousel (4:5), dots + counter, thumbnails under it; info follows; sticky buy bar after the inline buttons scroll away (v2 behaviour kept).
- Info column order (F-pattern, decisions top-down): breadcrumb-style back link → name (`t-display` 40 desktop) → price row (price, struck price, blue % pill) → short description (clamped, Read more) → options → stock + SKU (caption) → quantity → Add to cart (outline) + Buy now (ink, the one primary) full width → WhatsApp + share → trust row (one hairline row) → accordions (Details, Delivery & returns).
- Below: "More from this store" uses the count-aware set (3 → 3 × 4 cols), never a rail with an empty slot.

## 6. UX laws, applied concretely
- **Fitts.** Primary actions are full-width 48 px pills; on phones the buy actions and checkout submit live in the bottom 40 % of the screen (thumb zone) via the sticky bar; the cart icon target is 44 px with the count inside the target; drawer close is 44 px in the top-end corner, and the whole backdrop closes it.
- **Hick.** At most one primary action per view. Filters are one row of pills ("All", "Offers", categories) that scrolls horizontally on phones instead of wrapping into a wall of choices; categories also get the photographic bento so the choice is visual. Variant pickers show only valid combinations (unavailable struck through, not hidden). Checkout shows one payment choice per row, COD first.
- **Gestalt.** Proximity and common region replace boxes: groups are separated by space (24/48) and hairlines, never by card borders. Price sits within 8 px of the name; meta (stock, SKU) shares a caption size so it reads as one group. The only filled regions: the spotlight band (white) and the drawer (white sheet).
- **Progressive disclosure.** Description clamps at 4 lines; specs and delivery in accordions; discount code behind "Have a code?"; order notes behind "Add a note".
- **Feedback & micro-interactions.** Add to cart → button shows "Added ✓" for 1.4 s and stays enabled; the header count bumps (scale 1 → 1.25 → 1, 300 ms); a slide-over drawer (end side desktop, bottom sheet phone) shows the added item and stays until dismissed. All CSS keyframes; off under reduced motion.
- **Focus states.** Every interactive element shows a 2 px blue (#2563EB) outline at 2 px offset on `:focus-visible`; on photos/tiles the ring sits inside the radius. Focus moves into the drawer when it opens and returns to the trigger when it closes.
- **Loading.** Route-level skeletons (`loading.tsx`) for store home, product and cart that reserve the exact boxes of the final layout (photo ratios, heading heights) so nothing shifts when content lands; shimmer off under reduced motion.
- **Empty & error states.** Display-type statement + one action: empty cart → "Your cart is empty" + Continue shopping; no search results → statement + Clear search pill; no products → statement only; storefront error → statement + Try again. No illustrations, no colour.

## 7. Cart
- **Drawer first, page second.** Adding never navigates. The drawer (native `<dialog>`, top layer, focus trap and Escape for free) shows the added line with photo, name, options, quantity × price, the cart count, and two exits: "View cart" (outline) and "Checkout" (ink, → `/cart#checkout`). Buy now still goes straight to the cart page.
- **Cart page** keeps the full review (NN/g: a minicart is feedback, not a cart replacement): lines on the start (8 cols), summary + checkout form sticky on the end (4 cols); phone: lines, then the form, with the Place order button in the thumb zone.

## 8. Footer
Hairline top. Four columns on desktop (About · Returns · Contact · Language), two on phone; small 13 px type, muted headings; language switcher as text pills; "Made with Bazarga" bottom end. Above it the sign-off wordmark.

## 9. RTL mirroring rules
- Use logical properties only (`ms/me/ps/pe/start/end`, `inset-inline`). The hero photo bleeds to the **inline end** edge (right in LTR, left in RTL); the name plate overlaps from the inline start.
- Grids mirror automatically (column 1 = inline start). Rails scroll from the start edge; snap alignment `start`.
- Directional icons (back arrow, chevrons) flip with `rtl:-scale-x-100`; non-directional icons (cart, truck, share) never flip.
- Numbers, prices, SKUs and codes are isolated LTR runs (`.num` / `<bdi>`); the "−17%" badge keeps its minus on the left in every locale.
- Drawer slides in from the inline end; bottom sheet on phones is direction-neutral.
- Tracking/letter-spacing is never negative for Arabic-script text.

## 10. Rollout (one step per branch `agentb/v3-<step>`, each with 390 ku + 1280 en screenshots reviewed and the full gate)
1. **Foundation** — grid/spacing/type tokens (`--page-max`, `--s-*`, `t-hero/t-display/t-headline/t-title/t-label`, `.section`, `.bleed`, root `overflow-x: clip`), wider container (1280, 16/24/40 margins), section index labels, refined four-column footer + sign-off wordmark. **DONE (Oct 10)**: store-page container 1280 with 16/24/40 margins, --s-* 8px scale, --section-gap 64/96/128, t-hero/t-display/t-headline/t-title/t-label type utilities (Arabic script zero tracking), grid-12 + bleed utilities, overflow-x clip on the storefront, SectionHead with index labels, four-column footer (About/Returns/Contact + language row) and a faint store-name sign-off. Gate green.
2. **Home composition** — asymmetric hero with overlapping name plate and end-bleed photo, collections bento, count-aware Best sellers / On sale sets (no half rows), spotlight band, All products block with search + chips on one row.
3. **Product page** — desktop stacked gallery + sticky info column, phone carousel kept, related as a count-aware set.
4. **Add-to-cart feedback** — slide-over drawer (`<dialog>`), cart count bump, button state, shared event so card pills and the product page both use it.
5. **States** — skeleton `loading.tsx` for home / product / cart, empty states (cart, search, catalog), storefront error state, focus-ring audit.
6. **Cart & checkout composition** — 8/4 split with sticky summary, progressive disclosure (code, note), thumb-zone submit on phones.
