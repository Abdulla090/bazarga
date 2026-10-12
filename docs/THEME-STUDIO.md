# Theme Studio (Shopify-style store designer)

Goal: sellers design their store (colors, fonts, buttons, cards, background, header, sections) with presets + live preview. Seller presets may use any colors; Bazarga's own UI keeps blue/black rules.

Model: versioned zod theme JSON (`src/lib/theme-studio/schema.ts`), draft + published per store; storefront reads published only; emitted as CSS custom properties (`--t-*`) on the store root, server-rendered, nonce-CSP safe. Old stores fall back to DEFAULT_THEME.

## Steps
- [x] 1. Schema, 8 presets, contrast/derivation (AA guard), CSS var mapping + unit tests (lib only).
- [x] 2. Migration 0010 (theme_draft, theme_published jsonb); storefront applies published vars (+ --st bridge). Write helpers come with step 3.
- [x] 3. (shell: presets + live iframe preview + autosave + publish; controls come in 4-7) Editor route /dashboard/theme: split view, iframe live preview via postMessage, preset gallery, publish, unpublished dot.
- [x] 4. Colors (swatches, custom picker, AA warning) + text size controls, 4 locales. (Font pairs still to wire via next/font.)
- [x] 5a. Buttons shape/style/size controls + storefront consumption. [x] 5b cards + background kind controls (storefront consumes).
- [ ] 6. Header/footer, homepage sections reorder + variants, product page options.
- [~] 7 (undo/redo + Surprise me done). Undo/redo, reset, autosave, Surprise me, phone bottom sheet.
- [ ] 8. e2e: preset change + publish changes storefront CSS vars; polish.
