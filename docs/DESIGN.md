# Bazarga design system (Agent B)

Source of truth: `src/app/globals.css` (`@theme`). Brand: Sun Gold, Deep Ink, Mountain Green, Paper.

## Tokens
- Color: gold/ink/green/paper/line/danger; storefront remaps onto `--st-*`.
- Elevation: `shadow-e1/e2/e3`. Radius: `--radius-card`, `--st-radius`.
- Motion: `--duration-fast/base/slow` (150/200/250ms), `--ease-out-expo`, `--ease-in-out`. CSS only. `prefers-reduced-motion` neutralises all animation globally. Page transitions via CSS View Transitions.
- Utilities: `btn*` (press scale), `card`, `input` (gold focus ring), `skeleton` shimmer, `animate-sheet-in`, `animate-toast-in`.
- Rules: tap targets >=44px, 360px no overflow, AA contrast, no layout shift.

## Status
- [x] Foundation tokens, motion, skeleton, press states (this branch)
- [ ] Primitives: Select, Badge, Sheet, Toast, Empty state components
- [ ] Self-hosted Kurdish subset font + line-height tuning
- [ ] Storefront: home, product, cart, checkout, order status
