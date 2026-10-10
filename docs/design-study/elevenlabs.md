# ElevenLabs Homepage Design Breakdown
Studied 2026-10-10 at desktop (1920×1080, ~1176 px content width). Phone-width behavior inferred from Tailwind responsive tokens in the live markup (no device-width override available).

## Color palette
- **Backgrounds**
  - Page: warm off-white / "stone-50"-ish, ~#FAFAF9
  - Section bands inside page: alternating white (#FFFFFF) and very light warm gray
  - Card fills:
    - "Safety / Moderation" cards — warm cream/gray ~#F3F2F0 (no shadow, borderless)
    - Code/API cards — white with a thin light-gray border and faint shadow
    - Customer-logo logos sit on the page background; each is an absolute-link tile
    - Blog cards: full-bleed photographic gradient (no solid fill)
  - Announcement banner (top): light gray strip with the "V4" wordmark + white "Discover" pill
  - Nav: white (#FFFFFF) with a sticky position
- **Text**
  - Primary / headings / hero / button label on white: near-black, ~#0A0A0A / #111111
  - Body copy: true black #000 or #111
  - Secondary / meta / card description lines: mid-gray ~#777 / #6B6B6B
  - Tertiary / category chips ("Category", "Product", "Date"): lighter gray ~#999
  - Bracketed performance tags in text input ([sarcastically], [giggles]): gray
- **Accents**
  - No single brand accent color. Color comes from **content**: voice-gradient orbs (orange Narration, purple Characters, brown Conversational, etc.), blog-card photographic gradients, and product-header gradients (blue→red→magenta for "Eleven v4"; olive/yellow→green for "Dubbing v2").
  - Code snippets use syntax colors only (keywords red, properties/vars blue, strings navy, rest black).
  - Small accent icon on the floating Voice-chat pill (a pale blue/green orb).
  - Links: black → underline on hover (1.5 px, offset 2); footer links hover to gray-500.
- **CTA fill tokens observed in class names**
  - Primary fill: `bg-black text-white rounded-full` (Sign up, Play, Create an AI agent)
  - Secondary / outline: `bg-white text-black shadow-sm rounded-full` with a hairline border (Contact sales, Learn more, Talk to sales, Explore docs, All posts)
  - Tertiary nav pill (voice carousel prev/next): `bg-cream text-black hover:bg-gray-200 active:scale-[0.98]`
  - Logo mark in nav: `rounded-full` (pill logo container)
- **Shadows**
  - Outline pills use only `shadow-sm` (a single soft, barely-visible drop shadow — no hard border line is relied upon for definition).
  - Floating Voice-chat pill uses a shadow for lift.
  - Cream/warm-gray content cards (Safety): no shadow.
  - Code cards: faint shadow.
- **Hex caveat**: these are eyematched from the screenshot analysis. The site uses Tailwind's `tw-*` utility namespace (not raw `bg-*`), so exact canonical hex would come from the compiled CSS; the values above are the on-screen result.

## Typography
- **Font families**
  - **UI / body / nav / footer / buttons / tabs**: a neutral neo-grotesque sans. Glyph anatomy (tall x-height, double-story "a", flat-topped "t", open apertures) matches **Inter** rather than SF Pro / Söhne. Used for everything that needs legibility at small sizes (Tailwind tokens `tw-type-2xs`, `tw-type-xs`, `tw-text-sm`, `tw-text-base`, `tw-text-sm/sm`, `tw-text-base/base`).
  - **Display / marketing headings** (hero "Bringing technology to life", section H2s like "Safety, built in", "Latest updates", blog card titles): a **different, slightly more geometric/custom display face** — rounds feel slightly rounder, rhythm slightly wider, weight lighter. ElevenLabs has shipped a proprietary display type; visually consistent with what is commonly referred to as their custom heading font (often reported as "Waldenburg"-style). Not confirmed from CSS (the browser's React SPA consumed injected reads).
  - **Code**: monospace in the API cards.
  - **Logo**: custom "IIElevenLabs" logotype (not live type).
- **Sizes & weights (approx, 1920 px desktop)**
  - Hero headline ("Bringing technology to life"): large, 2-line, appears ~48–56 px, medium weight on the display face.
  - Section H2 ("Safety, built in"; "Latest updates"; "AI Communication Platform"): ~32–36 px, **regular/light weight** (not bold — a deliberate anti-bold choice), display face.
  - Section subcopy (2–3 sentence paragraphs under H2): ~15 px, gray, Inter-like, ~1.5–1.6 line-height.
  - Card titles (Safety, feature links): ~16 px, regular/medium.
  - Card descriptions: ~15 px, gray.
  - Card caption links (Music, SFX, Voices, Image & Video): ~15–16 px, medium, with a small chevron arrow.
  - Feature tabs (AI Voice Generator, Text to Speech…): small caps-style, ~13–14 px, medium, in rounded-full pill containers.
  - Product tabs (ElevenCreative / ElevenAgents / ElevenAPI): larger pill tabs, white selected state.
  - Nav items (Products, Solutions, Customers…): ~14 px, medium.
  - CTA pills:
    - Large hero/section primary "Sign up" / "Create an AI agent": `tw-h-11`, `tw-text-base` (~16 px)
    - Smaller secondary CTA "Sign up" (inside feature module): `tw-h-10`, `tw-text-sm` (~14 px)
    - Nav "Sign up": `tw-h-9`, `tw-text-xs/xs` (~12–13 px)
  - Footer group headers (ElevenCreative, ElevenAgents, ElevenAPI, Resources…): `tw-type-2xs` ~13 px, medium, gray.
  - Footer links: `tw-type-xs` ~14 px, medium, black.
  - Blog card titles below image: ~20 px; meta line "Category · Product · date" ~14 px gray.
  - Announcement banner text: small, ~13–14 px.
- **Letter-spacing**
  - UI / body: essentially `normal` (≈0); nothing looks tracked out.
  - Display headings: slightly looser than the UI face, giving them a more editorial/generous rhythm — achieved mainly through the different typeface and a touch of extra tracking, not heavy letter-spacing.
  - Feature tabs in their pills: visually tight, fitting the label with no visible tracking.
- **Line-height tokens observed**
  - `tw-text-sm/sm` and `tw-text-base/base` indicate custom line-height pairs (likely ~1.4375 for sm and ~1.5 for base — the standard Inter pairing).

## Layout
- **Max width & container**
  - Content column: **~1176 px wide** (x≈372–1548 on a 1920 px viewport), centered.
  - Bounded by **faint vertical hairline guide-rails** at the left and right edges of the content column, visible the full page height.
  - **Horizontal hairline rules** separate major sections.
  - This "ruled paper" / editorial grid is a deliberate premium signal.
- **Grid patterns**
  - Hero: asymmetric — headline column on the left, subtext column on the right, sharing the same vertical space.
  - Product showcase: 3 equal-width product tabs + a 5–6 item horizontal feature-tab row + a centered voice-orb carousel.
  - Customer logos: 6 columns × 3 rows of small square tiles (Twilio, Disney, KPN, Stripe, Telus, Cisco, Epic, Nvidia, Revolut, Meta, Zoom, Square, Ramp, IBM, Telekom, Klarna, Harvey, Salesforce).
  - Feature bento ("All-in-one AI editor" + "Ultra-realistic speech" + Music/SFX/Voices/Image&Video): asymmetric 2-wide bento, the right-top cell taller with an embedded textarea.
  - Customer-tabs (NVIDIA / Clay / Duolingo): small pill tab row + a larger testimonial panel + right-aligned CTA.
  - Research timeline: horizontal scroll/row of dated model releases (Eleven Multilingual v2 → Eleven v4).
  - Safety: 3 equal cards (~370 px each) with ~16 px gaps.
  - Blog ("Latest updates"): 3 tall cards with full-bleed gradient tops.
  - Footer CTA band: H2-left + 2-pill CTA-right.
  - Footer nav: **4 equal columns at exactly 300 px pitch**, stacked in 2 row-groups.
- **Whitespace / section spacing**
  - Sections breathe generously. Eyed from section-anchor centers, major H2-to-H2 gaps read **500–800 px** of vertical space including the content inside.
  - Internal card gaps: ~16 px (Safety, blog, customer logo rows).
  - Footer link rhythm: **28 px line pitch** (centers at 620, 648, 676…).
  - Footer top padding ~70 px; header-to-first-link ~30 px; row-group gap ~59 px; bottom whitespace >140 px.
  - Overall feel: airy, not cramped; the hairlines do the separating so heavy rules/dividers are unnecessary.

## Nav / Header style
- **Structure**: single sticky white nav, ~48 px tall (`tw-h-9` internals, wordmark centered at y≈78–80).
- **Left**: "IIElevenLabs" wordmark inside a `rounded-full` pill container (`tw-rounded-full`, focus outline).
- **Center**: 7 items — Products, Solutions (both `button[expanded]` dropdowns with React Aria menus), Customers, Resources (dropdown), Enterprise, Pricing. Spaced ~80–85 px apart.
- **Right**: "Log in" (white pill `bg-white text-black shadow-sm` with a focus `ring`) + "Sign up" (black pill, `tw-h-9`, `tw-text-xs/xs`).
- **Above the nav**: a full-width **announcement banner** (~48 px), light-gray background, "V4" logo + promo text + white "Discover" pill. This is an optional marketing strip, not part of the core nav.
- **Below / floating**: a **Voice chat** pill stuck to the bottom-right of the viewport (white, shadowed, `tw-h-12` / `sm:tw-h-14`, with a small orb icon) — a persistent conversational CTA, not a nav element.
- **No mega-nav panels observed open**, but Products/Solutions/Resources are menu buttons (chevron dropdowns), so the heavy link lists live in dropdowns rather than expanding the header.

## Hero structure
- **No hero image or gradient wash** — the hero is pure typography and whitespace on white.
- **Two-column asymmetry**: large left-aligned headline ("Bringing / technology to life", 2 lines, display face), paired with a right-aligned 2–3 sentence subtext paragraph naming the three products.
- **Two CTA pills below the headline**: "Sign up" (black fill) and "Contact sales" (white outline). Stacked/inline depending on width; both `rounded-full`.
- **Immediately below the headline** (same hero breath), a **product showcase module** starts:
  - 3 large product tabs (ElevenCreative selected, shown as a white pill; ElevenAgents / ElevenAPI ghost).
  - A horizontal **voice-orb carousel**: 5 gradient gradient orbs with names (Advertisement / Characters / Narration / Conversational / Social Media), each a playable voice preview — the center orb is the "active" voice. Prev/next cream pills at the bottom.
  - Below the orbs a row of **feature tabs** (AI Voice Generator selected, plus Text to Speech, Music, Speech to Text, Voice Cloning, Dubbing), each a `rounded-full` ghost pill.
  - A black "Sign up" pill sits at the right of this row.
- The hero therefore packs **headline → subtext → dual CTA → product-tabs → voice-carousel → feature-tabs** into one vertical run before the first section hairline — a dense-but-legible product intro rather than a traditional big-image hero.

## Buttons
- **Shape**: every CTA and interactive pill on the page is **fully rounded / `rounded-full`** (pill shape). No square or 4–8 px corners on buttons anywhere on the homepage.
- **Fill vs. outline**
  - **Primary fill**: black (`bg-black`) with white text, `rounded-full`. Used for Sign up (hero, footer), Play, Create an AI agent. This is the only "filled" state on the page.
  - **Secondary / outline**: white (`bg-white`) with black text, `rounded-full`, a hairline border and **only** `shadow-sm` for definition. Used for Contact sales, Learn more, Talk to sales, Explore docs, All posts, Get started, Discover, Read all stories.
  - **Tertiary / ghost**: no fill or border — plain text inside a `rounded-full` container (feature/product tabs, voice-carousel prev/next in `bg-cream`). Hover lifts to `bg-gray-200` (cream→light-gray).
  - **Invert context**: there is no dark background on the homepage, so the white/black duality is consistent everywhere — no context-flipped accent CTA.
- **Sizes** (three tiers, all `rounded-full`)
  - **Large** `tw-h-11` (≈44 px), `tw-text-base` / `tw-px-5` — "Sign up" hero, "Create an AI agent" footer CTA, "Learn more" (also `tw-h-11` `tw-text-base` `tw-px-5`).
  - **Medium** `tw-h-10` (≈40 px), `tw-text-sm` / `tw-px-4` — "Sign up" inside the feature module.
  - **Small** `tw-h-9` (≈36 px), `tw-text-xs/xs` / `tw-px-3.5` — nav "Sign up", nav "Log in", announcement "Discover".
- **Play button**: a small black circle (`rounded-full`, `bg-black text-white`) with hover darkening — sits inline with Language/Voice dropdowns.
- **Copy buttons** inside code cards: small `rounded-full` ghost pills, top-right of the card.
- **Active state**: `active:tw-scale-[0.98]` on the cream prev/next pills — a tiny press squish, not a color flip.
- **Transitions**: class lists show `tw-transition-[background-color,color,box-shadow,border-color]` on CTAs and `tw-transition-colors tw-duration-200` on links — so hover animates the fill/border/shadow smoothly over 200 ms.

## Cards
- **Border-radius**: consistently large. Content cards (Safety Moderation/Accountability/Provenance) read **~20 px** rounded corners. Blog cards carry the same family radius. Code/API cards: smaller but still rounded (the code block itself visually inherits the card's rounded container). Feature-caption link chips use `rounded-sm` (≈2 px) — the only sharp element, and only on micro-labels.
- **Borders**
  - Safety / cream cards: **no visible border**, no shadow — separation comes from the fill color difference.
  - Code/API cards: **thin light-gray border** + faint shadow on white.
  - Blog cards: no border — full-bleed gradient image flows to the card edge.
  - Customer logo tiles: borderless, absolute `inset-0` link overlay on the page background.
- **Shadows**
  - Only outline pills (`shadow-sm`) and the code cards and floating Voice-chat carry shadows.
  - Feature content cards deliberately avoid shadow — that's what keeps the page flat and premium rather than "card-stack" SaaS.
- **Sizing / grid**
  - Safety cards: ~370 × 445 px, 3-up, 16 px gap.
  - Blog cards: 3-up, tall, gradient header fills the top ~45–50% of the card; metadata below.
  - Feature bento cells: mixed sizes (the "Ultra-realistic speech" cell is taller to hold the textarea + Language/Voice/Play controls).
- **Interactivity on cards**
  - Many cards have a full-card click overlay (the `<span tw-absolute tw-inset-0>` elements on Music/SFX/Voices/Image&Video, and the `tw-group tw-block tw-rounded tw-absolute tw-inset-0` on every customer logo).
  - Customer logos transition to underline or a pointer on hover (React `tw-group` hover).
  - Card caption links ("Ultra-realistic speech", "Music", "SFX"…) include a tiny chevron arrow and sit on a `tw-rounded` hit area.

## Text density per section
- **Very low — a hallmark of the design.**
- **Section H2** = 2–4 words, light weight ("Safety, built in", "Latest updates", "AI Communication Platform", "Bringing technology to life").
- **Subcopy** = 1–3 short sentences, ~20–40 words, gray body. Even the longest (hero subtext naming 3 products) is a single paragraph.
- **Cards** = 1 headline (1–3 words) + 1 sentence (≈15–25 words).
- **Lists** are avoided as body. Where multiple items exist, they are expressed as **tabs, pills, carousels, or logo tiles** rather than bulleted/numbered text.
- **Exceptions / denser zones** (still controlled):
  - Research timeline: each tile is 1 short name + 1 short sentence + a month/year — dense by count but each tile is tiny.
  - ElevenAPI code cards: code blocks are inherently dense, but the explanatory copy next to each is still 1–2 sentences.
  - Footer: the highest text density on the page by far — but it's broken into 4 narrow 300 px columns with 28 px rhythm so it reads as a directory, not a wall.
- **Practical rule the page follows**: *one idea, one sentence, one card.* If there are six ideas, they become six tabs or six logo tiles — never six paragraphs.

## Imagery / illustration style
- **No photography of people, no stock scenes, no 3D mockups of laptops.** The homepage contains almost zero literal "images of things."
- **What IS shown instead:**
  - **Voice gradient orbs**: each voice (Narration, Characters, etc.) is a soft, colorful radial gradient disc — the "character" of the voice is communicated through a color + a play button, not a photo.
  - **Photographic grainy gradients** on blog cards and product headers: multi-stop gradients (lavender→coral→orange; blue-gray→amber→rust; pale blue→deep green; olive/yellow→green; blue→red→magenta) with a faint wavy-line texture overlaid. Titles sit in white over them. These feel like abstract art, not product shots.
  - **Thin black line-art illustrations** inside the Safety cards: cones (Moderation), wireframe cube (Accountability), nested circles (Provenance). Single-stroke, dotted-accent, geometric, no shading, no color — the line weight is the only style.
  - **App UI screenshots** for the two workhorse product proofs: the "All-in-one AI editor" card shows the ElevenCreative editor; the ElevenAgents omnichannel card shows call stats with severity alerts. Real product UI, not a retouched mockup.
  - **Isometric/light 3D graphics** for product comparisons: the Speech-to-Text "Scribe vs Gemini 2.0 Flash vs Whisper Large v3" comparison is a small isometric illustration.
  - **Research timeline** is expressed as text tiles dated month/year, not as images.
  - **Customer logos** are brand marks (Twilio, Disney, Nvidia, Meta, Salesforce…), each a small link tile — trust signals, not imagery.
- **Summary**: illustration vocabulary is **gradient fields + thin line-art + real app screenshots + brand marks**. No character art, no drop-shadow device mockups, no hero photo.

## Motion and hover effects observed
- **Hover on links**: color transition 200 ms + underline (1.5 px thickness, offset 2). Footer links hover to `text-gray-500` instead of underlining.
- **Hover on outline pills**: the `transition-[background-color,color,box-shadow,border-color]` group animates the fill/border/shadow smoothly — a subtle "lift into presence," not a hard state change.
- **Hover on cream prev/next pills**: `hover:bg-gray-200` via both mouse and React's `data-[hover]` (so hover works on touch/pointer too).
- **Active press**: `active:scale-[0.98]` on prev/next pills — a 2 % press-squish, very tactile.
- **Tab carousels**: the voice-orb carousel has prev/next; the featured customer row (NVIDIA / Clay / Duolingo) cross-fades the testimonial panel when tabs switch — a fade transition rather than a hard swap.
- **Disabled preview orbs**: non-center voices in the carousel show `disabled=true` on their play buttons, implying a **snap-scroll / center-active carousel** where only the center voice is playable.
- **Customer logo grid**: `tw-group` hover — the logo/link likely brightens or underlines; the absolute `inset-0` makes the whole tile clickable.
- **Sectioning**: the vertical/horizontal hairline rules are static (not animated in), but the consistency of section breathing as you scroll gives a slow, editorial rhythm.
- **Floating Voice-chat pill**: stays fixed to the bottom-right while scrolling (a persistent affordance, not an animation, but it behaves as a sticky companion).
- **No parallax, no scroll-triggered fade-ins observed in the element state** (the page favors static premium composition over motion). Where there is motion, it's micro: hover 200 ms, press 0.98 scale, tab cross-fade.

## Phone-width view (inferred from markup, no device override available)
I could not shrink the viewport — the browser stayed at 1920 and a `?prefers-mobile-ui` param was ignored. However, the **live Tailwind responsive tokens** make the mobile contract explicit and reliable:

- **Breakpoint in use**: `sm` (640 px). Everything below 640 px uses the non-`sm:` default.
- **Nav**: collapses the heavy menu. "Products", "Solutions", "Resources" are already `button[expanded]` dropdowns in the desktop DOM (chevron menus), and on phone they would be replaced by a single menu trigger — the nav CTA pair ("Log in" / "Sign up") survives. The announcement banner stacks above it.
- **Hero buttons**: the floating Voice-chat control ships with `py-1.5 / h-12 / pl-12` as the default and `sm:py-2.5 / sm:h-14 / sm:pl-14` — so on phone it's a smaller, tighter pill. Hero "Sign up" / "Contact sales" drop from the larger `h-11` band to the `h-10`/`h-9` stack.
- **Hero two-column → single column**: the headline + subtext stack vertically. The product-tabs row (ElevenCreative / ElevenAgents / ElevenAPI) would likely become a vertical or horizontally scrollable tab strip; the feature-tabs row (AI Voice Generator … Dubbing) almost certainly becomes a **horizontally scrollable pill strip** (the current `rounded-full` tabs with a selected white pill are the standard mobile pattern).
- **Voice-orb carousel**: already a prev/next carousel on desktop — on phone it becomes a single-orb full-bleed snap-carousel (the center-active pattern generalizes to one-at-a-time).
- **Bento / 3-up grids collapse to 1-up**: the Safety 3-card row, the blog 3-card row, the feature bento, and the customer 6-column logo grid all stack vertically. Card heights (~370 px wide tiles) become full-bleed width with the same ~20 px radius.
- **1176 px content column → edge-to-edge**: the vertical hairline rails disappear under `sm`; sections use the device's padding edge instead.
- **Footer**: the 4×300 px columns stack into a single column (or 2-up at intermediate widths), preserving the 28 px link rhythm and `type-2xs` / `type-xs` sizes.
- **Net effect on phone**: same components, same pill radii, same black/white duality — just restacked. The design system is already mobile-ready; the phone view is a **vertical restacking of the identical pill-and-gradient vocabulary**, not a redesign.

## 5 most distinctive techniques that make it feel premium
1. **Ruled-paper editorial grid** — faint vertical hairline rails at the content edges plus horizontal hairline section dividers, on a warm off-white page. It borrows from print magazine layout, not SaaS, and it's the single strongest "premium" signal on the page. Almost nothing else relies on heavy rules, boxes, or backgrounds for separation.
2. **Anti-bold, light-weight display headings** — every H2 ("Safety, built in", "Latest updates", "AI Communication Platform") and the hero are set in a slightly different, lighter display face at a light/regular weight rather than bold. Big + light reads as confident and expensive; big + bold reads as loud. Paired with a neutral Inter-like UI face for everything else, the two-type hierarchy is unmistakable.
3. **Monochromatic CTA system — black pill / white pill, nothing else** — the entire homepage uses only two CTA states (black fill and white outline), both `rounded-full`, with no brand-color button anywhere. Color is deliberately reserved for content (voice gradients, blog gradients, line-art), so the CTAs never compete with the product. The result is a luxury-watch kind of restraint.
4. **Color as content, not as chrome** — there is no accent-blue button, no green success state, no purple highlight. Every saturation on the page belongs to a voice orb, a gradient header, or a syntax color. The design communicates the product's actual variety (voices, languages, models) through the imagery system instead of through UI color, which keeps the interface itself serene.
5. **One-idea-per-section discipline + pill/tab UI instead of lists** — text density is aggressively low (2–4 word H2, 1–3 sentence subcopy, 1-sentence cards). Where there are many items, they become pill tabs, carousels, gradient orbs, or logo tiles — never paragraphs, never bullets. Combined with the generous whitespace and the hairline grid, the page feels curated rather than catalogued.

## Extra signals worth stealing for Bazarga (Kurdish-first store builder)
- **Keep CTAs to two states** (a single dark fill + a white outline), both fully rounded. Let color come from merchant storefront previews, not from UI chrome.
- **Use a light display weight for big headings** paired with a highly legible Kurdish-capable UI sans (e.g., a Noto/Naskh-family workhorse for body) — the contrast between a light editorial display and a tight body face reads premium in any script.
- **Replace section dividers with hairlines**, not heavy colored bands. A thin warm rule on warm off-white is more expensive-looking than any gradient divider.
- **Express choice through pills and carousels** (template picker, plan tabs, feature tabs) instead of feature comparison tables. ElevenLabs proves a 6+ option row can be scannable when each option is a rounded pill with one word.
- **Use gradient fields + thin line-art** for category/feature cards instead of stock photography. A "voice orb" equivalent for Bazarga could be a soft gradient swatch per industry vertical (fashion, grocery, crafts) with a one-line caption — instantly more ownable than another Shopify-style template gallery.
- **Cap text at one sentence per card.** The homepage's restraint is the easiest single lever to pull a Kurdish storefront builder away from "marketplace clutter" toward "studio."