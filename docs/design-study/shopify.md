# Shopify + Dawn Theme Design Study

Sources:
- shopify.com homepage (Oct 2026)
- Dawn theme preview iframe at themes.shopify.com/themes/dawn → https://theme-dawn-demo.myshopify.com/
- Dawn product PDP: /products/louise-slide-sandal

---

## 1. shopify.com (Marketing site)

### Color palette (approx., from rendered screenshot)
- Background / overall: `#02090A` near-black with a teal tint; the whole hero and upper sections are dark.
- Primary text (headlines, nav): `#FFFFFF`.
- Body / secondary text: muted gray-green ~`#8A9696` / `#A8B5B2` (the CSS variable class is `text-shade-50`).
- Inactive tab text: same `shade-50` ~`#8A9696`; active tab forced `!text-white`.
- Primary button: white fill `#FFFFFF`, text near-black `#02090A`.
- Secondary button (ghost): transparent fill, ~1.5px white `#FFFFFF` border, white text.
- Shopify logo bag: two-tone green ~`#95BF47` / `#5E8E3E` (Shopify brand green).
- "Your brand has entered the chat" gradient card: dark teal-green ~`#0B2E2A` fading to ~`#04191B`.
- Lower "sell everywhere" cards: each card image masked with `mask-image: radial-gradient(white, black)`, background inherits near-black.
- Accent underlines / AI section: subtle near-white; no bright accent palette — Shopify lets merchant imagery provide color.

### Typography
- Font family: Shopify's custom grotesk sans-serif (Shopify Sans — a tightly-controlled, neutral humanist-grotesk variable font).
- Hero headline: **~100–110px**, **light/thin weight**, tight line-height ~1.0–1.05, slightly negative letter-spacing, white.
- Hero subhead: **~22–24px**, regular, white, two short lines.
- Section heading (e.g. "Sell everywhere people shop."): **~56px**, light weight.
- Nav links: **~16px**, regular; on mobile class shows `font-[330]` — a light custom weight from the variable font, `text-2xl`/`text-3xl` responsive.
- Tab labels: ~18–20px, white / `shade-50`.
- Body text: ~16–18px, `shade-50` gray.
- Letter-spacing: near 0 on body; slightly negative on the hero headline; tracking on buttons is set by a custom `--button-tracking` token.

### Layout
- Max-width / container: the page uses a wide `container` utility. Visually content stretches edge-to-edge in the hero; the "Sell everywhere" card rail is centered at ~1920px in a `xl:overflow-hidden` container, with ~250px side margins at wider breakpoints. Nav and hero text rail runs x≈250 to ~1670 (≈1420px content).
- Grid: full-bleed sections stacked vertically; inside, a 3-column horizontal-scrolling card carousel (merchant sites).
- Section spacing: generous. Hero ~767px tall. Sections flow with large rounded top-corner cutouts (~40px) creating a soft "wave" between dark bands.
- Responsive: heavy use of `max-lg:` / `md:max-lg:` responsive breakpoints; the nav collapses into stacked blocks on medium and below.

### Header / nav
- Transparent nav overlaid on the dark hero (no background color, no bottom border).
- Left: Shopify logo (green bag + white "Shopify" wordmark), then "Why Shopify" (dropdown), "Products" (dropdown), Pricing, Enterprise.
- Right: "Log in" text link, then a white pill "Start for free" button.
- Mega-menu panels (Sidekick, App Store, Shopify.dev) are in the DOM off-screen and slide in on hover.
- Hover effect: `group-hover:opacity-50` dims siblings when you hover one link (a very Shopify move).

### Hero
- Full-bleed, dark, with an autoplaying lifestyle video background under a dark overlay.
- Left-aligned, stacked headline + subhead + dual CTAs.
- Dual CTAs: filled "Start for free" pill (primary) + ghost "Why we build Shopify" pill with a ▶ play circle (secondary → opens a dialog).
- Tagline pattern: "Be the next / household name" — large broken-into-words stacked display type that Shopify rotates.

### Buttons
- Primary (pill): `rounded-component-button` / `rounded-button` — fully rounded (radius = half height). Hero pill ~56px tall → **~28px radius**. Nav pill ~44px → **~22px radius**. White fill, near-black text, medium weight ~500–600 (controlled by `--button-weight`), ~17–18px.
- Secondary (ghost pill): same radius, transparent fill, ~1.5px white border, white text.
- Transitions: `transition-all duration-150` on hover/focus; focus ring via `outline-state-focus` with `outline-2 outline-offset-2`.
- Padding set by `px-button-px` / `py-button-py` CSS variables.

### Hero motion / micro
- `transition-opacity duration-3` (300ms) on nav link opacity.
- Hero background is a live video.
- "Why we build Shopify" FAB: `animate-slide-up-fade-in` + `transition-all duration-500 ease-out` — slides up with a shadow-xl on scroll.
- Tab carousel auto-rotates with gradient/opacity fill transition.

### Amount of text per section
- **Very tight.** Every section is: one short headline (1–6 words), one 10–20-word paragraph, one link/button. Examples:
  - "Your brand has entered the chat / Get discovered across AI channels. Shoppers check out right in the chat. You don't lift a finger." + "Agentic Storefronts" link.
  - "Get a store that's built to sell / Build your online store instantly with AI. Or use prebuilt themes."
- Numbers / social proof are presented as big stats, not paragraphs: "15% HIGHER CONVERSIONS", "250M+ HIGH-INTENT SHOPPERS", "$5B US loaned out", "0% equity".
- The mega-menu / product directory section is the longest (a 4-column link list) but is just labels, no descriptions.

### 5 distinctive "premium-feel" techniques on shopify.com
1. **Variable-font, light-weight massive display type** — ~100px headlines in 250–330 weight with tight line-height and slight negative tracking. Feels editorial, not SaaS.
2. **Dark-first palette with near-monochrome restraint** — the page is near-black with white + one gray; color comes only from merchant imagery and the signature green bag. Zero gratuitous gradient buttons.
3. **Sibling-dimming nav hover** — hovering any nav link fades the others to 50%. Subtle, expensive-looking interaction that says "we control every pixel."
4. **Rounded-section "wave" cutouts** — the ~40px radius top-corners where dark sections overlap create a soft, organic, editorial rhythm instead of hard section boxes.
5. **Radial-gradient-masked merchant card rail** — the `mask-image: radial-gradient(white, black)` fade on the Steve Madden / Glossier / Stanley cards makes the infinite carousel feel photographic and expensive, not a slider widget.

---

## 2. Dawn theme storefront (theme-dawn-demo.myshopify.com)

Dawn is Shopify's default free Reference theme — what a baseline Shopify store is expected to look like.

### Color palette (approx.)
- Background: `#FFFFFF`.
- Primary text: `#121212` (the CSS token `--color-foreground`).
- Muted body / secondary: `#121212` at ~75% opacity → visually ~`#555` (Dawn uses opacity, not a separate gray variable, for muted text).
- Announcement bar border / light dividers: ~`#E6E6E6`.
- Card / media placeholder background: ~`#F3F3F3` (light gray behind product images).
- Sale badge accent: blue ~`#334FB4` / `#3A4FB0` (the only chromatic accent on the theme; Dawn intentionally has NO brand color in the default).
- Sold-out / Sale badges: pill in near-black `#121212` or the blue above, white text.
- Buttons (secondary = Add to cart): white fill, 1px `#121212` border, `#121212` text.
- Buttons (primary = Buy it now): solid `#121212` fill, white text.
- Hero banner: dusty-blue photography; text sits on a ~30–40% black overlay.

### Typography
- Font family: **Assistant** (a Google-font humanist sans, Dawn's default). Light, slightly warm, very legible — deliberately neutral so the merchant's photos carry the brand.
- Heading (PDP title / intro section): **~40px**, regular weight (400), `#121212`.
- Hero banner heading: **~52px**, regular weight, white.
- Collection heading / section heading: **~40px**.
- Body text: **16px**, regular, line-height ~1.6–1.8, gray via opacity.
- Caption / small utility size: **13px** (Dawn's `caption-large`), used for "Shop all" mega-menu sublinks and product card titles.
- Product card title: **13px**, `#121212`.
- Price: **~15px** current; **~11–12px** compare-at strikethrough.
- Letter-spacing: slight positive tracking throughout (~0.06em / `0.06rem`) on body and captions; tighter on the logo.
- Logo "DAWN": bold, wide tracking ~0.2em, ~24px.

### Layout
- Max-width container: **~1200px** centered (the demo iframe renders the store at 1200px wide; content rail x≈410–1510 = ~1100px of content inside, with ~100px outer gutters to the 1200px edge).
- Header container: ~1100px wide (410–1510) on a 1920 viewport → side margins ~410px.
- Grid (product cards): **4 columns** inside the container, each card ~269px, gutter **8px**.
- Section spacing: modest. Hero banner is full-bleed ~720px tall. Intro text section sits ~60–70px below. Collection grid ~60px below the intro heading.
- Responsive: at smaller breakpoints Dawn collapses to 2 then 1 column; the header collapses to a hamburger with the logo centered.
- Sticky announcement bar on top (38px).

### Header / nav
- 3 rows stacked:
  1. Announcement bar ("Free shipping available on all orders!") ~13px, centered, white, thin bottom border.
  2. Main header (~85px tall): logo left ("DAWN" bold, wide tracking), nav center (Bags, Shoes, Lookbook — ~14px, ~30px gaps, Bags/Shoes have chevron megamenu expander), icons right (Search, Account, Cart — thin outline icons ~20px, ~44px apart).
  3. On hover, Bags/Shoes expand a small horizontal "Quick list" mega row ("Shop all, Tote bags, Shoulder bags…") in `caption-large` (13px).
- Search opens a **full-screen modal**, not a dropdown.
- Cart icon is a simple bubble (no count shown when empty).

### Hero
- **Image-banner section**: full-bleed, height ~720px. Default preset shows a **split 50/50 image pair** (two photos side by side).
- Dark ~30–40% overlay; text block anchored **lower-middle**, centered horizontally.
- H1 "Industrial design meets fashion." ~52px white. Subtext "Atypical leather goods" ~16px white at ~75% opacity. Single "Shop now" button below.

### Buttons
- **All square corners (border-radius 0)** — that's the most distinctive Dawn trait. Every button, input, and variant pill is rectangular.
- Secondary (default Add to cart, "Shop now"): white fill, 1px `#121212` border, `#121212` text, **full-width** on PDP, ~46px tall, ~15–16px text, slight letter-spacing.
- Primary ("Buy it now", Shop Pay): solid `#121212`, white text, same size, stacked 10px below Add to cart.
- Both are `button--full-width` on the product page.
- No hover color change on screenshot (Dawn's default hover is a slight opacity shift via CSS).

### Product cards
- Image: **square 1:1** (card image area is ~269×269), **no border radius**, light-gray `#F3F3F3` background behind the photo.
- Badges: positioned **bottom-left of the image**, offset ~10px. Fully rounded pill, ~22px tall. "Sale" in blue, "Sold out" in near-black. There's no "New" / "Bestseller" by default.
- Title: **13px** `#121212`, regular weight, ~24px below the image. The whole card is a single link (`full-unstyled-link`) — only the title is visible, the image itself is the click target.
- Price row: current price **~15px** with slight tracking; if on sale, the compare-at price shows first as an **11–12px strikethrough** in gray, ~14px gap, then the current price. "From $X.XX" pattern for multi-variant starting prices.
- **Almost no text**: title + price only. No description, no rating stars, no swatches, no "Quick add" button on the card.

### Cart / Add-to-cart treatment
- **On product cards**: no Add-to-cart button. Cards are product links only. Add-to-cart lives on the PDP.
- **On the PDP**: stacked, full-width, same-width controls:
  1. Variant selectors (Color, Size) as **fully rounded pill radio buttons**: selected = black fill / white text; unselected available = white fill + 1px dark border; sold-out variants = light-gray border, gray strikethrough text.
  2. Quantity stepper: ~140×46px, 1px dark border, "− [1] +" with disabled state on minus at quantity 1.
  3. "Add to cart" (secondary, white + 1px dark border) — full width, ~46px.
  4. "Buy it now" / Shop Pay (primary, solid black) — full width, 10px below.
- Cart icon in header → full cart drawer page (`/cart`).
- Cross-sell / "you may also like" and dynamic checkout buttons are present in the theme but not in this demo preset.

### Amount of text per section
- Minimal. Dawn is built around imagery.
- Hero: 1 headline + 1 short subtext + 1 button.
- Rich-text section: 1 heading (~40px) + 1 paragraph (2–3 sentences), centered.
- Collection: heading (often omitted in the demo) + grid of image + title + price only.
- Testimonials / quote sections are just a caption + italic quote.
- Footer: 2-column quick links + 3-sentence brand blurb + "Subscribe to our emails" + payment icons.

### Motion / hover effects
- Very restrained. Dawn's default motion budget is small:
  - Card hover: a subtle **opacity transition** on the image overlay and a slight **scale on the quick-view** (in the default preset mostly nothing visible — the card is just a link).
  - Product image: `image-magnify-hover` class → a **lens/zoom magnifier** on the PDP hero image on hover.
  - Header: the nav chevron mega-menus expand with a simple display toggle (no animation in the default; some Dawn presets add a slide).
  - Buttons: `transition` on opacity only (no transform, no shadow).
  - Announcement bar is static.
  - Scroll: **no parallax, no scroll-triggered animations** in the default Dawn preset.
- Philosophy: motion is present only where it aids shopping (image zoom, variant state), not for decoration.

### 5 distinctive "premium-feel" techniques in Dawn
1. **Radical typographic minimalism — only title + price on cards, 13px/15px, no ratings, no descriptions, no quick-add.** The grid breathes. Luxury retailers do the same (e.g. A-Cold-Wall*, Acne).
2. **Zero border-radius everywhere (buttons, inputs, cards, images) except the variant/select pills which are fully rounded.** The intentional contrast between sharp and pill shapes is a mature design decision, not an oversight.
3. **Muted text via opacity on `#121212`, not a separate gray palette.** Body, captions, and prices all derive from one foreground token — guarantees perfect contrast ratios and a unified tonal family.
4. **Assistant humanist sans + slightly positive tracking (~0.06em) on everything.** Warm, editorial, highly legible at 13px — the anti-grotesk choice that signals "we trust the photography."
5. **Announcement-bar → header → icon-only utility row as a 3-tier information hierarchy**, with the search opening a full-screen modal and the cart as a silent bubble. It scales from a $50 drop-ship store to a fashion label without looking cheap.

---

## Cross-reference: what to steal for Bazarga

- From Shopify.com marketing: light-weight variable-font display type, dark mode as default homepage, sibling-dimming nav, soft rounded section cutouts, one-paragraph-per-section discipline, stats-as-heroes (big numbers, small caption).
- From Dawn storefront: sharp-corner UI discipline, opacity-derived grays, 13/15/16/40/52 six-size type scale, square product cards with bottom-left pill badges, pill variant selectors contrasting with rectangular buttons, Add-to-cart only on the PDP, lens-zoom on product photos, Assistant-like humanist sans as the safe default (swap for a Kurdish-localized humanist later).
- Contrast to push for Bazarga: Shopify is editorial-dark + warm-video for the builder landing (trust); Dawn is editorial-light + photography-forward for the storefront (conversion). Bazarga's builder landing should behave like shopify.com (authority), the generated stores should behave like Dawn (quiet, image-led, Kurdish typography carried cleanly at 13–16px).
