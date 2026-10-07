/*
 * Demo data: seller demo@mymarket.app / mymarket-demo  →  store "Hawler Bazaar" (/s/hawler-bazaar)
 * with three products, a size-variant dress, the "bazaar" theme, Erbil delivery areas, a NEWROZ discount code and
 * free delivery over 75,000 IQD. Idempotent: re-running does nothing if the store exists.
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/server/db";
import {
  deliveryAreas,
  deliveryZones,
  discountCodes,
  productOptionValues,
  productOptions,
  productVariants,
  stores,
  users,
} from "../src/server/db/schema";
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
  const dress = await createProduct(db, store.id, {
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

  // ---- theme + policies + promotions
  await db
    .update(stores)
    .set({
      themePreset: "bazaar",
      accentColor: null,
      about: {
        ku: "دوکانێکی بچووکی هەولێر: جلی کوردیی دەستدروست، هەنگوینی چیا و بەرهەمی پێستی سروشتی.",
        ar: "متجر صغير في أربيل: ملابس كردية مصنوعة يدوياً، عسل جبلي ومنتجات طبيعية للبشرة.",
        en: "A small Erbil shop: hand-finished Kurdish clothing, mountain honey and natural skincare.",
      },
      returnPolicy: {
        ku: "دەتوانیت لە ماوەی ٣ ڕۆژدا کاڵاکە بگەڕێنیتەوە ئەگەر بەکارنەهاتبێت.",
        ar: "يمكنك إرجاع المنتج غير المستخدم خلال 3 أيام.",
        en: "Unused items can be returned within 3 days of delivery.",
      },
      freeDeliveryThreshold: 75_000,
    })
    .where(eq(stores.id, store.id));
  await db.insert(discountCodes).values({ storeId: store.id, code: "NEWROZ", type: "percentage", value: 10, minSubtotal: 30_000 });

  // ---- delivery: same-day in Erbil with a few neighbourhoods, 2–4 days elsewhere
  const erbil = await db.query.deliveryZones.findFirst({
    where: and(eq(deliveryZones.storeId, store.id), eq(deliveryZones.cityKey, "erbil")),
  });
  await db.update(deliveryZones).set({ etaMinDays: 2, etaMaxDays: 4 }).where(eq(deliveryZones.storeId, store.id));
  if (erbil) {
    await db.update(deliveryZones).set({ etaMinDays: 0, etaMaxDays: 1 }).where(eq(deliveryZones.id, erbil.id));
    await db.insert(deliveryAreas).values([
      { storeId: store.id, zoneId: erbil.id, name: { ku: "عەنکاوە", ar: "عنكاوا", en: "Ankawa" }, fee: 3000, sort: 0 },
      { storeId: store.id, zoneId: erbil.id, name: { ku: "شاوێس", ar: "شاويس", en: "Shawes" }, fee: 2000, sort: 1 },
      { storeId: store.id, zoneId: erbil.id, name: { ku: "بەختیاری", ar: "بختياري", en: "Bakhtiari" }, fee: null, sort: 2 },
    ]);
  }

  // ---- variants: the dress comes in S / M / L
  const [size] = await db
    .insert(productOptions)
    .values({ productId: dress.id, storeId: store.id, name: { ku: "قەبارە", ar: "المقاس", en: "Size", kmr: "Mezinahî" } })
    .returning();
  const values = await db
    .insert(productOptionValues)
    .values(["S", "M", "L"].map((v, i) => ({ optionId: size!.id, productId: dress.id, storeId: store.id, label: { en: v }, sort: i })))
    .returning();
  await db.insert(productVariants).values(
    values.map((v, i) => ({
      productId: dress.id,
      storeId: store.id,
      optionValueIds: [v.id],
      sku: `HB-DRESS-${v.label.en}`,
      stock: [3, 6, 3][i]!,
      price: i === 2 ? 90_000 : null,
      sort: i,
    })),
  );

  console.log(`[seed] created Hawler Bazaar → /s/hawler-bazaar  (login: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
