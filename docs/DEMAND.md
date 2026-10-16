# Bazarga — demand plan ("people beg for access")

Abdulla, Oct 16: "Prove everyone that people beg for access to this app." Everything here is free to run (no paid services) and every number shown is real, read from the DB. Nothing is faked; sections with no real content stay hidden.

## Slices (one per D run, in order)
- [x] **D1 Waitlist with position + referrals** — each signup gets a position number and a personal link; every friend who joins through it moves you up 5 spots (capped at 20 friends = 100 spots). Same WhatsApp number twice returns the same spot. Public status page `/waitlist/<code>`. Migration 0021. (shipped Oct 16, 218321f)
- [x] **D2 Live counters on the landing** (shipped Oct 16, 3ef47b1) — real counts of sellers, live stores, orders placed, people on the waitlist. Each counter appears only once it passes a small floor (so an empty DB never shows "0"); demo store is excluded from seller/order totals.
- [x] **D3 Founding-seller badge + perks for the first 100 stores** (shipped Oct 16) — migration 0022 `stores.founding_number` (unique, 1..100), handed out at store creation to real sellers only (demo + @example.com excluded), serialised with an advisory lock. Badge on the dashboard home and in the public store footer; perks + real "X of 100 founding spots left" bar on /pricing; one-line note in onboarding while spots remain. Perks cost nothing per use (badge, first access to themes/features, priority replies, a say in the roadmap). A locked-in price was NOT promised: needs Abdulla's decision.
- [x] **D4 Seller showcase** (shipped Oct 16) — `/showcase`: stores that opted in (Settings toggle, migration 0023, default off), active with products, founding first; demo store labelled "Demo store"; honest empty state; in sitemap + footer.
- [ ] **D5 Store-is-live share card** — after publishing, a 9:16 / 1:1 "my store is live" image + captions in all 4 locales (reuses the share kit).
- [x] **D6 Testimonials / case studies** — section component ready for real quotes; hidden until at least one approved quote exists in the DB (no placeholder text ever).

## Rules
- All 4 locales in sync; blue + ink; tap targets ≥ 44px; no paid dependencies.
- Migration journal timestamps must exceed 1791507000000 (see HANDOFF).
- Never show a number the DB can't back up.
