# Sprint Day 1: foundations

Day 1 lands the whole sprint's schema in **one migration** (`drizzle/0001_day1_sprint_schema.sql`) so that later
days only write services and UI. Don't add another migration for anything listed below; add columns only if a
later day truly needs something new.

## Schema (migration 0001)

| Area | Tables / columns | Notes |
|---|---|---|
| Variants | `product_options`, `product_option_values` (label + optional `swatch` hex), `product_variants` (`option_value_ids uuid[]`, `sku` unique per store when set, `price`/`compare_at_price` nullable = product price, `stock` nullable = untracked, `image_id`) | A product with no variant rows sells as itself. `order_items.variant_id/variant_title/sku` snapshot the choice. |
| Gallery | `product_images.width/height/placeholder/dominant_color/renditions/alt` (`sort` already existed) | v1 rows keep `null` dims and `[]` renditions; UI degrades to plain `src`. |
| Store theme | `stores.theme_preset` (`bazaar`/`mountain`/`night`), `accent_color` (#RRGGBB check), `cover_image_url/key/placeholder`, `about`, `return_policy` | Presets live in `src/lib/theme.ts`. |
| Promotions | `discount_codes` (`percentage`/`fixed`/`free_delivery`, min subtotal, max uses, window, upper-case code check), `stores.free_delivery_threshold`, `orders.discount_code_id/discount_code/discount_amount` | Arithmetic in `src/lib/discounts.ts` (`applyDiscount`). **Not wired into checkout yet.** |
| COD statuses | `order_status` = pending, confirmed, shipped, delivered, postponed, refused, returned, cancelled; `orders.courier_name/tracking_number` | v1 `new` → `pending`, `out_for_delivery` → `shipped` (migrated in place). Rules are in `src/lib/order-status.ts`. Restock happens on cancelled/returned, not on refused. Returning a paid COD order marks it refunded. |
| Status history | `order_events` (alias `orderStatusHistory`) + `courier_name`, `tracking_number` snapshot | Kept the v1 table name so existing rows and code stay valid. |
| Geography | `governorates` (19 rows: 18 + Halabja), `delivery_zones.governorate_key/eta_min_days/eta_max_days`, `delivery_areas` (seller-defined, optional fee override) | v1 zones are linked: mosul → ninawa, zakho → duhok, custom zones → null. Every existing store gets the governorates it lacked, **inactive**. New stores get all 19 active. |
| Addresses | `orders.landmark/area_id/area_name/governorate_key`, `customers.landmark/area_name` | |
| Web push | `push_subscriptions` (seller: user + store; customer: order), endpoint unique, failure counter | |

Tests: `tests/migrations.test.ts` upgrades a database full of v1 data and checks every backfill and constraint. `tests/sprint-enums.test.ts` keeps the DB enums and the TypeScript lists in sync.

## Image pipeline

`src/server/storage/pipeline.ts` handles uploaded images in these steps:

1. Checks the file's magic bytes and size.
2. Applies the 50 MP pixel cap.
3. Applies EXIF orientation, then strips **all** metadata (EXIF/GPS/XMP/IPTC/ICC).
4. Writes WebP renditions at 320/640/1024/1600, never upscaling.
5. Builds a 16 px placeholder and finds the dominant colour.

Writes go through any `StorageAdapter`, so the same code covers local disk and R2/S3 (`storage/config.ts`).

- Uploads go through `POST /api/uploads`, which returns `{ url, image }`. This route was previously never committed, because the root `.gitignore` entry `uploads` also matched `src/app/api/uploads`; that entry is now `/uploads`.
- `ResponsiveImage` and `src/lib/responsive-image.ts` build the srcset/sizes, add the placeholder background, and load the first above-the-fold image eager with `fetchpriority=high` and the rest lazy. Renditions are not re-optimised by `next/image` (they're resized already).
- Demo images: `npx tsx --conditions=react-server scripts/build-seed-images.ts` regenerates `public/images/seed/*` and `scripts/seed-images.json`.

## Design foundation

- Icons: lucide-react, imported only through `src/components/ui/icons.tsx`. `ArrowForward`, `ArrowBack`, `ChevronForward` and `ChevronBack` mirror in RTL. A test blocks emoji in `.tsx` files.
- Fonts: `next/font/local`, with Vazirmatn (Arabic block) and Inter (Latin + Latin-Ext loaded on demand) self-hosted from `src/app/fonts/`. They are OFL-licensed, and no Google fetch happens at build time.
- Tokens: brand colours are in `globals.css @theme` and `BRAND`. Storefront tokens are the `--st-*` variables and the `bg-st-*` utilities. Inside `.storefront`, the house palette is remapped onto the store's preset, so existing components follow the theme.
- Sellers pick a preset, accent, about and return policy under Dashboard → Settings → "Store look".
