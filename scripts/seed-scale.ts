/*
 * E2E audit scale fixtures (docs/E2E-AUDIT.md): stores with 0 / 1 / 10 / 100 / 1000 products and, on the 1000-product
 * store, 1000 orders spread over 90 days. LOCAL ONLY (refuses anything but a pglite:// DATABASE_URL). Idempotent: an
 * existing scale store is left as is. Sellers: scale-<n>@example.com / scale-audit-pass-1 (Business plan, so no cap).
 *   npx tsx --conditions=react-server scripts/seed-scale.ts
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../src/server/db";
import { orderItems, orders, products, stores, users } from "../src/server/db/schema";
import { signUp } from "../src/server/auth/service";
import { createStore } from "../src/server/services/stores";

const url = process.env.DATABASE_URL ?? "pglite://./.pglite";
if (!url.startsWith("pglite://")) throw new Error("seed-scale is local only");
const db = createDb(url);
const SIZES = [0, 1, 10, 100, 1000];
const CITIES = [["erbil", "هەولێر"], ["sulaymaniyah", "سلێمانی"], ["duhok", "دهۆک"], ["baghdad", "بەغدا"]] as const;
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "delivered", "delivered", "cancelled"] as const;
const SOURCES = [null, "tiktok", "instagram", "whatsapp", "facebook"];

async function main() {
  for (const n of SIZES) {
    const slug = `scale-${n}`;
    if (await db.query.stores.findFirst({ where: eq(stores.slug, slug) })) { console.log(`[scale] ${slug} exists`); continue; }
    const user = await signUp(db, { name: `Scale ${n}`, email: `scale-${n}@example.com`, password: "scale-audit-pass-1", locale: "ku" });
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    const store = await createStore(db, user.id, { name: `Scale ${n}`, slug, defaultLocale: "ku", phone: "9647501234567", whatsapp: "9647501234567", instagram: null, city: "erbil" });
    await db.update(stores).set({ plan: "business" }).where(eq(stores.id, store.id));
    const rows = Array.from({ length: n }, (_, i) => ({
      storeId: store.id,
      name: { ku: `بەرهەمی ${i + 1}`, en: `Scale item ${i + 1}`, ar: `منتج ${i + 1}`, kmr: `Berhem ${i + 1}` },
      description: { ku: "وەسفی کورت 🧵", en: "Short description" },
      price: 1000 + ((i * 250) % 90000),
      compareAtPrice: i % 7 === 0 ? 2000 + ((i * 250) % 90000) : null,
      stock: i % 13 === 0 ? 0 : 5 + (i % 40),
      isActive: true,
      sort: i,
    }));
    const ids: { id: string; price: number; name: string }[] = [];
    for (let i = 0; i < rows.length; i += 200) {
      const got = await db.insert(products).values(rows.slice(i, i + 200)).returning({ id: products.id, price: products.price });
      got.forEach((g, k) => ids.push({ ...g, name: rows[i + k]!.name.ku }));
    }
    if (n === 1000) {
      const now = Date.now();
      for (let b = 0; b < 1000; b += 100) {
        const batch = Array.from({ length: 100 }, (_, k) => {
          const i = b + k;
          const p = ids[i % ids.length]!;
          const qty = 1 + (i % 3);
          const [cityKey, cityName] = CITIES[i % CITIES.length]!;
          return {
            storeId: store.id, number: 1001 + i, publicId: randomBytes(9).toString("base64url"),
            customerName: `کڕیار ${i + 1}`, customerPhone: `+96475${String(10000000 + i).slice(-8)}`,
            cityKey, cityName, address: "شەقامی 60", subtotal: p.price * qty, deliveryFee: 5000, total: p.price * qty + 5000,
            status: STATUSES[i % STATUSES.length]!, paymentMethod: "cod" as const, locale: "ku" as const,
            source: SOURCES[i % SOURCES.length], createdAt: new Date(now - (i % 90) * 86_400_000 - (i % 24) * 3_600_000),
            _p: p, _q: qty,
          };
        });
        const got = await db.insert(orders).values(batch.map(({ _p, _q, ...o }) => o)).returning({ id: orders.id });
        await db.insert(orderItems).values(got.map((o, k) => ({ orderId: o.id, productId: batch[k]!._p.id, name: batch[k]!._p.name, unitPrice: batch[k]!._p.price, quantity: batch[k]!._q, lineTotal: batch[k]!._p.price * batch[k]!._q })));
      }
    }
    console.log(`[scale] ${slug}: ${n} products${n === 1000 ? ", 1000 orders" : ""}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("[scale] failed", e); process.exit(1); });
