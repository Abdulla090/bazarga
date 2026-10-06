/*
 * Demo data: seller demo@mymarket.app / mymarket-demo  →  store "Hawler Bazaar" (/s/hawler-bazaar)
 * with three products. Idempotent: re-running does nothing if the store exists.
 */
import { eq } from "drizzle-orm";
import { createDb } from "../src/server/db";
import { stores, users } from "../src/server/db/schema";
import { signUp } from "../src/server/auth/service";
import { createStore } from "../src/server/services/stores";
import { createCategory, createProduct } from "../src/server/services/catalog";

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "mymarket-demo";

async function main() {
  const url = process.env.DATABASE_URL ?? "pglite://./.pglite";
  const db = createDb(url);

  if (await db.query.stores.findFirst({ where: eq(stores.slug, "hawler-bazaar") })) {
    console.log("[seed] Hawler Bazaar already exists — nothing to do");
    process.exit(0);
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  const user = existing ?? (await signUp(db, { name: "Hawler Bazaar", email: DEMO_EMAIL, password: DEMO_PASSWORD, locale: "ku" }));

  const store = await createStore(db, user.id, {
    name: "Hawler Bazaar",
    slug: "hawler-bazaar",
    defaultLocale: "ku",
    phone: "9647501234567",
    whatsapp: "9647501234567",
    instagram: "hawler.bazaar",
    city: "erbil",
    tagline: { ku: "جل، هەنگوین و جوانکاری", ar: "ملابس، عسل ومستحضرات", en: "Clothing, honey and skincare" },
  });

  const clothing = await createCategory(db, store.id, { name: { ku: "جلوبەرگ", ar: "ملابس", en: "Clothing" }, sort: 0 });
  const food = await createCategory(db, store.id, { name: { ku: "خواردن", ar: "طعام", en: "Food" }, sort: 1 });
  const beauty = await createCategory(db, store.id, { name: { ku: "جوانکاری", ar: "مستحضرات", en: "Beauty" }, sort: 2 });

  const base = { compareAtPrice: null, isActive: true } as const;
  await createProduct(db, store.id, {
    ...base,
    name: { ku: "کراسی کوردی", ar: "فستان كردي", en: "Kurdish dress", kmr: "Kirasê kurdî" },
    description: {
      ku: "کراسی کوردیی دەستدروست بە ڕەنگی گەش، گونجاو بۆ نەورۆز و ئاهەنگەکان.",
      ar: "فستان كردي مصنوع يدوياً بألوان زاهية، مناسب لنوروز والمناسبات.",
      en: "Hand-finished Kurdish dress in bright colours — made for Newroz and celebrations.",
    },
    price: 85000,
    stock: 12,
    categoryId: clothing.id,
    imageUrls: ["/images/product-dress.jpg"],
  });
  await createProduct(db, store.id, {
    ...base,
    name: { ku: "هەنگوینی چیا · ١ کیلۆ", ar: "عسل جبلي · 1 كغ", en: "Mountain honey · 1 kg", kmr: "Hingivê çiya · 1 kg" },
    description: {
      ku: "هەنگوینی سروشتیی چیاکانی کوردستان، ڕاستەوخۆ لە مێشەوانەوە.",
      ar: "عسل طبيعي من جبال كردستان، مباشرة من النحّال.",
      en: "Natural honey from the Kurdistan mountains, straight from the beekeeper.",
    },
    price: 25000,
    stock: 40,
    categoryId: food.id,
    imageUrls: ["/images/product-honey.jpg"],
  });
  await createProduct(db, store.id, {
    ...base,
    name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية بالبشرة", en: "Natural skincare set", kmr: "Seta çermê xwezayî" },
    description: {
      ku: "سابوون، کرێم و ڕۆنی سروشتی — بێ مادەی کیمیایی.",
      ar: "صابون وكريم وزيت طبيعي — بدون مواد كيميائية قاسية.",
      en: "Soap, cream and oil made from natural ingredients — no harsh chemicals.",
    },
    price: 40000,
    stock: null,
    categoryId: beauty.id,
    imageUrls: ["/images/product-cosmetics.jpg"],
  });

  console.log(`[seed] created Hawler Bazaar → /s/hawler-bazaar  (login: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
