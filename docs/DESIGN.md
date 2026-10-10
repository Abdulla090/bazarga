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
- [~] Primitives: Badge + EmptyState done (badge*, empty-state utilities, ui/EmptyState); Select done (`select` utility, chevron flips in RTL); Toast + Sheet utilities and ui/Toast done
- [ ] Self-hosted Kurdish subset font + line-height tuning
- [~] Storefront: product card elevation+hover done; home, product, cart, checkout, order status
- [~] Cart: line cards elevation, 80px thumbs, pill stepper; ku/ar line-height 1.75
- [~] Checkout: payment option cards (selected elevation, focus ring, press), header rule
