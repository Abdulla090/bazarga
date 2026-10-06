import { createDb, setDb, type Db } from "@/server/db";
import { runMigrations } from "@/server/db/migrate";
import { signUp } from "@/server/auth/service";
import { createStore } from "@/server/services/stores";
import { createProduct } from "@/server/services/catalog";
import { setPaymentMethod } from "@/server/services/settings";

/** Fresh, fully-migrated in-memory Postgres (PGlite) per test file. */
export async function testDb(): Promise<Db> {
  const url = "pglite://memory";
  const database = createDb(url);
  await runMigrations(database, url);
  setDb(database);
  return database;
}

let n = 0;
export async function seller(database: Db, label = "s") {
  n++;
  const user = await signUp(database, {
    name: `Seller ${label}`,
    email: `${label}${n}-${Date.now()}@example.com`,
    password: "correct horse battery",
    locale: "ku",
  });
  const store = await createStore(database, user.id, {
    name: `Store ${label}${n}`,
    slug: `store-${label}${n}-${Math.random().toString(36).slice(2, 7)}`,
    defaultLocale: "ku",
    phone: "9647501234567",
    whatsapp: "9647501234567",
    instagram: null,
    city: "erbil",
    tagline: {},
  });
  return { user, store };
}

export async function product(database: Db, storeId: string, price: number, stock: number | null = 10) {
  return createProduct(database, storeId, {
    name: { ku: "کاڵا", en: "Item" },
    description: {},
    price,
    compareAtPrice: null,
    stock,
    categoryId: null,
    isActive: true,
    imageUrls: [],
  });
}

export async function enable(database: Db, storeId: string, method: "fib" | "zaincash") {
  await setPaymentMethod(database, storeId, method, true);
}

export const checkout = (items: { productId: string; quantity: number }[], extra: Partial<Record<string, unknown>> = {}) => ({
  items,
  customerName: "Shilan",
  phone: "9647701112233",
  cityKey: "erbil",
  address: "Near the Bazaar Mosque",
  notes: null,
  paymentMethod: "cod" as const,
  locale: "ku" as const,
  ...extra,
});
