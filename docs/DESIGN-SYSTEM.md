# Storefront design system v2

Goal (Abdulla, Oct 19 2026): every theme is a different, professional design, not a colour swap, by hand and with AI.
Bar: strip the colours from screenshots and a viewer still tells every theme apart.

## 1. Audit (before v2, live demo store, 412 ku + 1440 en)

Screenshots: `daily-shots/2026-10-19/audit-<design>-{home,product}-{412,1440}.png` (9 designs).

What already differed: the hero (9 variants), the product grid (9), the card (9), the footer (9), section order.

What was shared by every design (why it read as "colours only"):

| Shared | Detail |
| --- | --- |
| Typography | One face for everything: Inter + Vazirmatn. Fraunces only on Editorial/Atelier display in Latin. Theme Studio's "font pair" was saved but never rendered (THEME-STUDIO step 4 note). Kurdish pages looked identical in every design. |
| Product page | One layout for all designs: gallery start + buy box end. Identical at 412 and 1440. |
| Cart / checkout | One layout (still shared in v2, on purpose: checkout should be boring). |
| Header | Logo + search icon + cart in every design except Market; centered/minimal were CSS tweaks. |
| Spacing / density | One rhythm (`--section-gap`, `--grid-gap`) except small overrides in Editorial/Mono/Pulse. |
| Surfaces | Flat colour everywhere; card radius/shadow from tokens only. |
| Buttons | Pill unless a design forced square via CSS; product-page buttons ignored the theme's shape. |
| Motion | One fade-up `.reveal` for all. |
| Theme Studio | Preset tiles were colour swatches (bg / surface / accent chips), so the picker itself said "these are palettes". 4 of 12 presets (ivory, midnight, stone, fresh) really were classic + a palette. |

## 2. Architecture

A store's look = **design** (base composition) + **layout overrides** (per-axis variants) + **tokens** (colours, buttons,
cards) + **type pair**. All of it lives in the versioned theme JSON (`src/lib/theme-studio/schema.ts`, still `v: 1`;
`layout` is an optional additive key, so every theme saved before v2 parses unchanged).

`composeDesign(theme, allowPremium)` (`src/lib/theme-studio/designs.ts`) folds them into one `DesignSpec`:

| Axis | Variants |
| --- | --- |
| header | split, centered, minimal, search (sticky bar with a search field), ticker (announcement marquee) |
| hero | split, masthead, banner, fullbleed, arch, type, stage, runway*, pulse* (bento), spotlight (one real product) |
| grid | auto, magazine, dense, tiles, soft, rows, masonry, lookbook*, bento* |
| card | classic, editorial, compact, tile, soft, row, float, frame*, glow* |
| product page | split, wide, stacked, reverse |
| footer | classic, editorial, dense, minimal, soft, ledger, band, colophon*, ticker* |
| density | compact, regular, airy |
| surface | flat, paper (grain + hairlines), glass, blocks (2 px borders + offset shadow), glow (accent light) |
| motion | none, fade, slide (scroll-driven CSS, off under reduced motion, no JS) |
| sections | offers, collections, best, spotlight, sale, story, social, whatsapp (any order) |
| type pair | see below |

\* premium variants: a store below Max never renders them (falls back to its design's own), whatever its theme asks.

The storefront root carries every axis as a data attribute (`data-type`, `data-density`, `data-surface`, `data-motion`,
`data-header`, `data-product`, `data-card`, `data-radius`); `globals.css` "Design system v2" styles them, placed last so
the theme wins over older per-design rules.

### Typography

Self-hosted with next/font, `preload: false`, `display: swap`, unicode-range limited: a store downloads only the faces
its theme names, only for the scripts on the page.

| Pair | Display (Latin / Arabic script) | Body |
| --- | --- | --- |
| sans-clean | Inter / Vazirmatn | Inter / Vazirmatn |
| serif-editorial | Fraunces / Noto Naskh Arabic | Inter / Vazirmatn |
| luxe-serif | Playfair Display / Noto Naskh Arabic, spaced caps labels | Inter / Vazirmatn |
| rounded-soft | Nunito / Vazirmatn | Nunito / Vazirmatn |
| playful | Nunito Black / Noto Kufi Arabic | Nunito / Vazirmatn |
| mono-bold | JetBrains Mono / IBM Plex Sans Arabic | Inter / Vazirmatn |
| tech-mono | Space Grotesk / IBM Plex Sans Arabic, mono labels | Space Grotesk / IBM Plex Sans Arabic |
| grotesk | Space Grotesk / IBM Plex Sans Arabic | Inter / Vazirmatn |
| condensed | Oswald caps / Noto Kufi Arabic | Inter / Vazirmatn |

Arabic-script partners were checked glyph by glyph for ڕ ڵ ۆ ێ ە ڤ ھ and harakat (fontTools). Rubik and Readex Pro were
rejected (no ڕ/ڵ). On ckb/ar pages display text never uppercases or tracks and gets a 1.45 line box, so marks never clip.

### Preview

- Theme Studio iframe: the editor writes the unsaved composition to the cookie `bz_pv_<slug>` as
  `v2.<design>.<hero>.<grid>.<card>.<footer>.<header>.<product>.<density>.<surface>.<motion>.<type>.<sections>`
  (a bare design id from older editors still works) and reloads the iframe when it changes; colours stay live via postMessage.
- Theme gallery thumbnails: `/s/<slug>?pv=1&pvt=<flagship id>` renders that whole flagship (colours too). The proxy
  forwards `pvt` as `x-bz-preview-theme` only with `pv=1` (client copies stripped); only flagship ids are honoured.

### Old themes

No data migration. Stored themes keep their design and tokens; every legacy preset composes to exactly its design's old
hero/grid/card/footer/sections (tested), Market keeps its search header and Pulse its ticker. What changes for an old
store: its saved font pair now actually renders (it was ignored before). `LEGACY_PRESET_TO_FLAGSHIP` maps each legacy
preset to the flagship that carries its look, for Theme Studio.

## 3. Flagship themes (`src/lib/theme-studio/themes.ts`)

| Id | Name | Group | One line |
| --- | --- | --- | --- |
| luxe | Minimal Luxe (Max) | minimal | Ivory paper, Playfair, framed runway cover, lookbook grid, framed cards, one centred product column, colophon. |
| street | Bold Streetwear (Max) | bold | Black blocks, Oswald/Kufi caps, ticker header, bento hero + grid, captions on photos, hard square buttons. |
| blush | Soft Boutique | soft | Blush, Nunito, arched cover, roomy soft cards, pill buttons, story + WhatsApp band. |
| folio | Editorial Magazine | editorial | Fraunces masthead, staggered magazine grid, numbered sections, info-first product page, paper grain. |
| circuit | Tech Gadget | bold | Dark glass, Space Grotesk + mono labels, search bar, product spotlight hero, uniform spec grid, ledger footer. |
| bazaar | Market Bazaar | catalogue | Dense six-up catalogue, search bar, deals banner, sticky category chips, deals first. |
| canvas | Gallery Art | minimal | Image first: minimal header, full-bleed cover, edge-to-edge tiles, stacked product page. |
| glow | Cosmetics Glow | soft | Accent light, Playfair, stage hero, masonry of floating cards, spotlight band, Instagram strip. |
| hearth | Food & Home | editorial | Warm paper, Fraunces, split cover, story near the top, cozy landscape cards, WhatsApp ordering. |
| play | Kids & Playful | bold | Nunito Black / Kufi, giant type hero, hard-bordered blocks with offset shadows, colour band footer. |

Tests (`tests/design-system-v2.test.ts`): any two flagships differ on at least 4 structural axes (colours aside), every
palette passes contrast (text 4.5:1 on bg and surface, accent 3:1), premium gating, legacy compatibility, cookie
round-trip, CSS/font wiring.

Screenshots: `daily-shots/2026-10-19/design-<theme>-{home,product}-{412,1440}.png`, contact sheet
`design-contact-sheet.png`.

## 4. Status

- [x] (a) Architecture (layout overrides, composition, type pairs + fonts, density/surface/motion, header/product
  variants, story/social/WhatsApp sections, spotlight hero) + all 10 flagship themes renderable via preview.
- [x] (c) Theme Studio: "Themes" tab = gallery of the 10 flagships grouped by style (minimal / editorial / bold / soft /
  catalogue), each with a live thumbnail of the seller's own store in that theme (lazy mini-iframe, `pvt`), name, one
  line, Max badge, one-click apply (keeps the seller's announcement and AI tagline). Legacy palettes sit under "More
  palettes". "Layout" tab = mix and match: cover, grid, card, product page, footer, spacing, surface, motion, and the
  home sections (reorder, hide, add story / Instagram / WhatsApp). "Type" tab = the 9 font pairs with a live "Aa ئا"
  sample. "Header" tab = all 5 header variants. "Surprise me" = a random flagship with three parts swapped. Publishing
  needs Max for a premium design or any premium variant (`usesPremium`, server-side).
- [ ] (d) AI Website Designer composes full designs (3 options side by side).
