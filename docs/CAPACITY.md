# Capacity: can 100 Pro sellers × 1,000 products fit?

Measured 2026-10-13 (Agent B, branch `agentb/image-compress`). Short answer: **the images do not fit Supabase
Free (1 GB) but are cheap anywhere else: ~25 GB total, ≈ $0.23/month on Cloudflare R2. The database does not fit
Supabase Free (500 MB) either: ~1 GB for 100k products. Supabase Pro ($25/mo: 8 GB disk, 100 GB storage, 250 GB
egress) covers the whole scenario.**

## 1. Bytes per uploaded image (all renditions)

Method: the real `processImage()` from `src/server/storage/pipeline.ts`, run on three real 4000 px Unsplash product
photos (red knit sneaker 4000×2667 — very detailed texture; watch 4000×2906 — flat background; headphones
4000×2667 — medium). Old vs new settings on the same decoded source.

| Settings | Widths | Avg bytes / image (all renditions) | Change |
|---|---|---:|---:|
| Old: WebP q78, effort 4 | 320/480/640/1024/1600 | **122,187 B (119 KB)** | — |
| New: WebP q72, effort 6, smartSubsample | 320/480/640/1024/1280 | **83,789 B (82 KB)** | **−31%** |
| New + browser pre-compress (≤2048 px WebP 0.85 before upload) | same | 77,051 B (75 KB) | −37% |

Per rendition, new settings (avg of the 3): 320 w 3.4 KB · 480 w 6.4 KB · 640 w 10.6 KB · 1024 w 25.5 KB ·
1280 w 37.8 KB. The sneaker alone is 158 KB/image, the watch 29 KB — real seller phone photos will sit somewhere in
that range. A 2× side-by-side crop of the 1024 w file (old vs new) showed no visible difference on texture or
smooth gradients.

Browser upload: a 1.35 MB / 4000 px JPEG becomes a ~240 KB, 2048 px WebP before it leaves the phone (−82% mobile
data), and it can never hit Vercel's ~4.5 MB request body limit.

Static marketing images: `public/images/*.jpg` (448 KB) → WebP q75 (93 KB, −79%); seed renditions re-encoded with
the new settings: 406 KB → 323 KB.

## 2. Bytes per product row in Postgres

Method: `pg_column_size(row)` on the seeded PGlite DB (4 locales of name/description), plus a product_images row
rebuilt with production-shaped values (absolute Supabase public URLs for 5 renditions, 136-char LQIP placeholder —
the measured average on the photos above).

| Item | Bytes |
|---|---:|
| `products` row (avg of seed rows; ku/kmr/ar/en text) | 1,813 |
| `product_images` row, production-shaped (5 renditions jsonb = 1,768 B of it) | 2,361 |
| Product + 3 images | 8,896 |
| + index entries (pkeys, store/product idx) ~320 B, + ~10% page/fill overhead | **≈ 10.1 KB per product** |

Seed `product_images` rows are smaller (715 B avg) only because their URLs are short relative paths. The biggest
item is the `renditions` jsonb repeating the full public URL and key for each of the 5 widths. Storing only the
width list and deriving URLs from the key would save ~1.2 KB per image (~3.6 KB per product) — a possible later
optimisation, not done here.

## 3. Scenario: 100 sellers × 1,000 products × 3 images = 300,000 images, 100,000 products

| Resource | Old settings | New settings | Supabase Free | Supabase Pro ($25) | Cloudflare R2 |
|---|---:|---:|---|---|---|
| Image storage | 36.7 GB | **25.1 GB** (23.1 GB with browser pre-compress) | 1 GB ✗ (≈ 4,000 products) | 100 GB incl. ✓ | 10 GB free (≈ 40,000 products), rest $0.015/GB-mo → **≈ $0.23/mo** ✓ |
| Database (products + images) | ~1.0 GB | **~1.0 GB** | 500 MB ✗ (≈ 49,000 products) | 8 GB disk incl. ✓ | n/a (DB stays on Postgres) |
| Image egress / month, 20 visitors/store/day | — | 7.7 GB | 5 GB + 5 GB cached ⚠ | 250 GB ✓ | free ✓ |
| Image egress / month, 100 visitors/store/day | — | 38.7 GB | ✗ | 250 GB ✓ | free ✓ |
| Image egress / month, 500 visitors/store/day | — | 193 GB | ✗ | 250 GB ✓ (then $0.09/GB) | free ✓ |

Egress model (a guess, images only; HTML/JS are served by Vercel): one visitor sees ~10 grid tiles at 480 w
(6.4 KB) and opens 2 product pages (1024 w main image 25.5 KB + two 320 w thumbnails 3.4 KB) ≈ **129 KB per
visitor**; × visitors/day × 100 stores × 30 days. R2 Class B reads: 100 visitors/store/day ≈ 16 reads × 300k
visits/mo ≈ 4.8M/mo, inside the 10M free.

Free-tier figures verified 2026-10-13 on https://supabase.com/pricing (Free: 500 MB DB, 1 GB file storage, 5 GB
egress + 5 GB cached egress; Pro: 8 GB disk, 100 GB storage then $0.0213/GB, 250 GB egress then $0.09/GB) and
https://developers.cloudflare.com/r2/pricing/ (10 GB-month free, 1M Class A + 10M Class B ops free, egress free,
$0.015/GB-month after).

## Recommendation

- **Supabase Free is fine for launch (first ~4,000 products), not for 100 Pro sellers.** Plan the switch when
  storage passes ~700 MB or the DB passes ~350 MB.
- **Cheapest path at scale:** Postgres on Supabase Pro (DB ~1 GB) + images on R2 (`STORAGE_DRIVER` S3 adapter
  already exists, `S3_PUBLIC_URL` = R2 public bucket / custom domain) → zero image egress cost, ~$0.23/mo storage.
- Optional later: slim the `renditions` jsonb (keys only) to cut DB size by ~35%.

Re-measure: `npx tsx scripts/measure-images.ts a.jpg b.jpg c.jpg` (prints bytes per rendition and the average).
