/*
 * Demo data: seller demo@mymarket.app / mymarket-demo  →  store "Hawler Bazaar" (/s/hawler-bazaar)
 * with four products (3–5 photos and a details table each, one on sale, a size-variant dress), the "bazaar" theme,
 * a cover photo with renditions, delivery areas in Erbil and Sulaymaniyah, the NEWROZ and WELCOME10 discount codes
 * (NEWROZ advertised on the storefront), free delivery over 75,000 IQD, and a few past orders so the storefront
 * shows real best sellers: honey (3 orders) and the dress (2) earn the "Best seller" badge, the scarf (1) joins the
 * strip, a cancelled skincare order counts for nothing. Honey and the scarf are on sale; the skincare set is "New".
 * Idempotent: re-running does nothing if the store exists.
 */
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../src/server/db";
import {
  deliveryAreas,
  deliveryZones,
  customers,
  discountCodes,
  orderEvents,
  orderItems,
  orders,
  productOptionValues,
  productOptions,
  productVariants,
  stores,
  users,
} from "../src/server/db/schema";
import { signUp } from "../src/server/auth/service";
import { createStore } from "../src/server/services/stores";
import { createCategory, createProduct } from "../src/server/services/catalog";
import type { ProductImageInput } from "../src/lib/validation";
import type { LocalizedText } from "../src/lib/i18n";
import seedImages from "./seed-images.json";

/** Pre-built pipeline renditions of the demo photos and their derived detail shots (scripts/build-seed-images.ts). */
const IMG = seedImages as Record<string, ProductImageInput>;
const photos = (...names: string[]) =>
  names.map((n) => {
    const img = IMG[n];
    if (!img) throw new Error(`seed image ${n} missing — run npx tsx scripts/build-seed-images.ts`);
    return img;
  });
const spec = (label: LocalizedText, value: LocalizedText) => ({ label, value });

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
  const origin = { ku: "شوێنی دروستکردن", ar: "بلد المنشأ", en: "Origin", kmr: "Çêbûn" };
  const material = { ku: "کەرەستە", ar: "الخامة", en: "Material", kmr: "Materyal" };
  const size = { ku: "قەبارە", ar: "المقاس", en: "Size", kmr: "Mezinahî" };
  const weight = { ku: "کێش", ar: "الوزن", en: "Weight", kmr: "Giranî" };
  const care = { ku: "چاودێری", ar: "العناية", en: "Care", kmr: "Lênêrîn" };

  const dress = await createProduct(db, store.id, {
    ...base,
    name: { ku: "کراسی کوردی", ar: "فستان كردي", en: "Kurdish dress", kmr: "Kirasê kurdî" },
    description: {
      ku: "کراسی کوردیی دەستدروست بە ڕەنگی گەش، گونجاو بۆ نەورۆز و ئاهەنگەکان.\n\nقوماشی مەخمەری سەوز بە چنینی زێڕین لە سنگ، قۆڵ و داوێن.\nهەر پارچەیەک لە بازاڕی هەولێر تەواو دەکرێت.\n\nقەبارەکان S، M و L ن؛ قەبارەی L درێژترە. ئەگەر دڵنیا نیت لە قەبارەکەت، لە واتسئاپ پێوانەکانت بنێرە و یارمەتیت دەدەین.",
      ar: "فستان كردي مصنوع يدوياً بألوان زاهية، مناسب لنوروز والمناسبات.\n\nمخمل أخضر مع تطريز ذهبي على الصدر والأكمام والذيل.\nكل قطعة تُنهى يدوياً في سوق أربيل.\n\nالمقاسات S وM وL؛ مقاس L أطول. إن لم تكن متأكداً من مقاسك أرسل قياساتك على واتساب وسنساعدك.",
      en: "Hand-finished Kurdish dress in bright colours — made for Newroz and celebrations.\n\nGreen velvet with gold embroidery on the chest, sleeves and hem.\nEvery piece is finished by hand in the Erbil bazaar.\n\nSizes S, M and L; the L is cut longer. Not sure about your size? Send your measurements on WhatsApp and we'll help.",
    },
    price: 85000,
    stock: 12,
    categoryId: clothing.id,
    specs: [
      spec(material, { ku: "مەخمەر، چنینی زێڕین", ar: "مخمل، تطريز ذهبي", en: "Velvet, gold embroidery", kmr: "Qedîfe, neqşê zêrîn" }),
      spec(size, { ku: "S / M / L", ar: "S / M / L", en: "S / M / L" }),
      spec(care, { ku: "تەنها شوشتنی وشک", ar: "تنظيف جاف فقط", en: "Dry clean only", kmr: "Tenê paqijkirina hişk" }),
      spec(origin, { ku: "هەولێر، کوردستان", ar: "أربيل، كردستان", en: "Erbil, Kurdistan", kmr: "Hewlêr, Kurdistan" }),
    ],
    imageUrls: [],
    images: photos("product-dress", "product-dress-collar", "product-dress-hem", "product-dress-sleeve", "product-dress-full"),
  });
  const honey = await createProduct(db, store.id, {
    ...base,
    name: { ku: "هەنگوینی چیا · ١ کیلۆ", ar: "عسل جبلي · 1 كغ", en: "Mountain honey · 1 kg", kmr: "Hingivê çiya · 1 kg" },
    description: {
      ku: "هەنگوینی سروشتیی چیاکانی کوردستان، ڕاستەوخۆ لە مێشەوانەوە.\n\nبێ شەکر و بێ گەرمکردن، لە شووشەی سەرقەپاغ دارین.",
      ar: "عسل طبيعي من جبال كردستان، مباشرة من النحّال.\n\nبدون سكر مضاف وبدون تسخين، في برطمان زجاجي بغطاء فلين.",
      en: "Natural honey from the Kurdistan mountains, straight from the beekeeper.\n\nNo added sugar, never heated — packed in a glass jar with a cork lid.",
    },
    price: 25000,
    compareAtPrice: 30000,
    stock: 40,
    sku: "HB-HONEY-1KG",
    categoryId: food.id,
    specs: [
      spec(weight, { ku: "١ کیلۆ", ar: "1 كغ", en: "1 kg", kmr: "1 kg" }),
      spec(origin, { ku: "چیاکانی سۆران", ar: "جبال سوران", en: "Soran mountains", kmr: "Çiyayên Soranê" }),
      spec({ ku: "جۆر", ar: "النوع", en: "Type", kmr: "Cure" }, { ku: "هەنگوینی گوڵە کێوی", ar: "عسل زهور برية", en: "Wildflower honey", kmr: "Hingivê kulîlkên çolê" }),
    ],
    imageUrls: [],
    images: photos("product-honey", "product-honey-jar", "product-honey-dipper", "product-honey-pot"),
  });
  const skincare = await createProduct(db, store.id, {
    ...base,
    badge: "new",
    name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية بالبشرة", en: "Natural skincare set", kmr: "Seta çermê xwezayî" },
    description: {
      ku: "سابوون، کرێم و ڕۆنی سروشتی — بێ مادەی کیمیایی.\n\nبۆ هەموو جۆرە پێستێک.\nبە دیاری پێچراوە.",
      ar: "صابون وكريم وزيت طبيعي — بدون مواد كيميائية قاسية.\n\nلجميع أنواع البشرة.\nمغلّفة كهدية.",
      en: "Soap, cream and oil made from natural ingredients — no harsh chemicals.\n\nFor every skin type.\nGift-wrapped.",
    },
    price: 40000,
    stock: null,
    sku: "HB-SKIN-SET",
    categoryId: beauty.id,
    specs: [
      spec({ ku: "ناوەڕۆک", ar: "المحتويات", en: "Contents", kmr: "Naverok" }, { ku: "ڕۆن ٣٠ مل، کرێم ٥٠ مل، سابوون", ar: "زيت 30 مل، كريم 50 مل، صابون", en: "Oil 30 ml, cream 50 ml, soap", kmr: "Rûn 30 ml, krem 50 ml, sabûn" }),
      spec({ ku: "جۆری پێست", ar: "نوع البشرة", en: "Skin type", kmr: "Cureyê çerm" }, { ku: "هەموو جۆرێک", ar: "جميع الأنواع", en: "All skin types", kmr: "Hemû cure" }),
      spec(origin, { ku: "سلێمانی، کوردستان", ar: "السليمانية، كردستان", en: "Sulaymaniyah, Kurdistan", kmr: "Silêmanî, Kurdistan" }),
    ],
    imageUrls: [],
    images: photos("product-cosmetics", "product-cosmetics-serum", "product-cosmetics-cream", "product-cosmetics-flowers"),
  });
  const scarf = await createProduct(db, store.id, {
    ...base,
    name: { ku: "لەچکی چنراوی کوردی", ar: "وشاح كردي منسوج", en: "Hand-woven Kurdish scarf", kmr: "Şala kurdî ya destçêkirî" },
    description: {
      ku: "لەچکی سووری چنراو بە دەست لە بازاڕی هەولێر.\nگەرم و سووک، بۆ زستان و بەهار.",
      ar: "وشاح أحمر منسوج يدوياً في سوق أربيل.\nدافئ وخفيف، للشتاء والربيع.",
      en: "Red scarf hand-woven in the Erbil bazaar.\nWarm and light, for winter and spring.",
    },
    price: 35000,
    compareAtPrice: 42000,
    stock: 8,
    sku: "HB-SCARF-RED",
    categoryId: clothing.id,
    specs: [
      spec(material, { ku: "خوری و لۆکە", ar: "صوف وقطن", en: "Wool and cotton", kmr: "Hirî û pembû" }),
      spec(size, { ku: "١٨٠ × ٧٠ سم", ar: "180 × 70 سم", en: "180 × 70 cm", kmr: "180 × 70 cm" }),
      spec(origin, { ku: "بازاڕی هەولێر", ar: "سوق أربيل", en: "Erbil bazaar", kmr: "Bazara Hewlêrê" }),
    ],
    imageUrls: [],
    images: photos("product-scarf", "product-scarf-seller", "product-scarf-shelf"),
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
      coverImageUrl: IMG.hero!.url,
      coverImagePlaceholder: IMG.hero!.placeholder ?? null,
      coverImageRenditions: IMG.hero!.renditions,
    })
    .where(eq(stores.id, store.id));
  await db.insert(discountCodes).values([
    { storeId: store.id, code: "NEWROZ", type: "percentage", value: 10, minSubtotal: 30_000, showOnStorefront: true },
    { storeId: store.id, code: "WELCOME10", type: "percentage", value: 10, minSubtotal: 30_000, maxUses: 100, isActive: true },
  ]);

  // ---- delivery: same-day in Erbil and next-day in Sulaymaniyah with named neighbourhoods, 2–4 days elsewhere
  const zone = (cityKey: string) =>
    db.query.deliveryZones.findFirst({ where: and(eq(deliveryZones.storeId, store.id), eq(deliveryZones.cityKey, cityKey)) });
  const [erbil, sulaymaniyah] = await Promise.all([zone("erbil"), zone("sulaymaniyah")]);
  await db.update(deliveryZones).set({ etaMinDays: 2, etaMaxDays: 4 }).where(eq(deliveryZones.storeId, store.id));
  if (erbil) {
    await db.update(deliveryZones).set({ etaMinDays: 0, etaMaxDays: 1 }).where(eq(deliveryZones.id, erbil.id));
    await db.insert(deliveryAreas).values([
      { storeId: store.id, zoneId: erbil.id, name: { ku: "شاوێس", ar: "شاويس", en: "Shawes", kmr: "Şawês" }, fee: 2000, sort: 0 },
      { storeId: store.id, zoneId: erbil.id, name: { ku: "عەنکاوە", ar: "عنكاوا", en: "Ankawa", kmr: "Enkawa" }, fee: 3000, sort: 1 },
      { storeId: store.id, zoneId: erbil.id, name: { ku: "بەختیاری", ar: "بختياري", en: "Bakhtiyari", kmr: "Bextiyarî" }, fee: null, sort: 2 },
      { storeId: store.id, zoneId: erbil.id, name: { ku: "شەقامی ١٠٠ مەتری", ar: "شارع 100 متري", en: "100m Street", kmr: "Kolana 100 metreyî" }, fee: 3000, sort: 3 },
      { storeId: store.id, zoneId: erbil.id, name: { ku: "ئیسکان", ar: "إسكان", en: "Iskan", kmr: "Îskan" }, fee: 2500, sort: 4 },
    ]);
  }
  if (sulaymaniyah) {
    await db.update(deliveryZones).set({ etaMinDays: 1, etaMaxDays: 2 }).where(eq(deliveryZones.id, sulaymaniyah.id));
    await db.insert(deliveryAreas).values([
      { storeId: store.id, zoneId: sulaymaniyah.id, name: { ku: "سەرچنار", ar: "سرجنار", en: "Sarchinar", kmr: "Serçinar" }, fee: null, sort: 0 },
      { storeId: store.id, zoneId: sulaymaniyah.id, name: { ku: "شەقامی سالم", ar: "شارع سالم", en: "Salim Street", kmr: "Kolana Salim" }, fee: null, sort: 1 },
      { storeId: store.id, zoneId: sulaymaniyah.id, name: { ku: "ئازادی", ar: "آزادي", en: "Azadi", kmr: "Azadî" }, fee: null, sort: 2 },
      { storeId: store.id, zoneId: sulaymaniyah.id, name: { ku: "ڕاپەڕین", ar: "رابرين", en: "Raparin", kmr: "Raperîn" }, fee: 6000, sort: 3 },
    ]);
  }

  // ---- variants: the dress comes in S / M / L
  const [sizeOpt] = await db
    .insert(productOptions)
    .values({ productId: dress.id, storeId: store.id, name: size })
    .returning();
  const values = await db
    .insert(productOptionValues)
    .values(["S", "M", "L"].map((v, i) => ({ optionId: sizeOpt!.id, productId: dress.id, storeId: store.id, label: { en: v }, sort: i })))
    .returning();
  const variants = await db.insert(productVariants).values(
    values.map((v, i) => ({
      productId: dress.id,
      storeId: store.id,
      optionValueIds: [v.id],
      sku: `HB-DRESS-${v.label.en}`,
      stock: [3, 6, 3][i]!,
      price: i === 2 ? 90_000 : null,
      sort: i,
    })),
  ).returning();

  // ---- past orders (last three weeks) → real best sellers on the storefront and in analytics
  const day = 86_400_000;
  type Line = { productId: string; variantId?: string; name: string; variantTitle?: string; unitPrice: number; quantity: number };
  const dressM = variants[1]!;
  const L = {
    honey: (q: number): Line => ({ productId: honey.id, name: "هەنگوینی چیا · ١ کیلۆ", unitPrice: 25_000, quantity: q }),
    dress: (): Line => ({ productId: dress.id, variantId: dressM.id, name: "کراسی کوردی", variantTitle: "M", unitPrice: 85_000, quantity: 1 }),
    scarf: (): Line => ({ productId: scarf.id, name: "لەچکی چنراوی کوردی", unitPrice: 35_000, quantity: 1 }),
    skin: (): Line => ({ productId: skincare.id, name: "سێتی پێستی سروشتی", unitPrice: 40_000, quantity: 1 }),
  };
  const past: { name: string; phone: string; daysAgo: number; status: "delivered" | "cancelled"; lines: Line[] }[] = [
    { name: "ئاڤان عومەر", phone: "+9647701000101", daysAgo: 18, status: "delivered", lines: [L.honey(2)] },
    { name: "شیلان کەریم", phone: "+9647701000102", daysAgo: 12, status: "delivered", lines: [L.honey(1), L.scarf()] },
    { name: "ڕێباز ئەحمەد", phone: "+9647701000103", daysAgo: 9, status: "delivered", lines: [L.dress()] },
    { name: "هێمن عەلی", phone: "+9647701000104", daysAgo: 5, status: "delivered", lines: [L.dress(), L.honey(1)] },
    { name: "دلنیا حەسەن", phone: "+9647701000105", daysAgo: 3, status: "cancelled", lines: [L.skin()] },
  ];
  for (const o of past) {
    const at = new Date(Date.now() - o.daysAgo * day);
    const subtotal = o.lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
    const deliveryFee = subtotal >= 75_000 ? 0 : 3_000;
    const [seq] = await db
      .update(stores)
      .set({ orderSeq: sql`${stores.orderSeq} + 1` })
      .where(eq(stores.id, store.id))
      .returning({ n: stores.orderSeq });
    const [customer] = await db
      .insert(customers)
      .values({
        storeId: store.id,
        name: o.name,
        phone: o.phone,
        cityKey: "erbil",
        address: "هەولێر",
        ordersCount: 1,
        totalSpent: o.status === "delivered" ? subtotal + deliveryFee : 0,
        lastOrderAt: at,
      })
      .returning({ id: customers.id });
    const [order] = await db
      .insert(orders)
      .values({
        storeId: store.id,
        number: seq!.n,
        publicId: randomBytes(12).toString("base64url"),
        customerId: customer!.id,
        customerName: o.name,
        customerPhone: o.phone,
        cityKey: "erbil",
        cityName: "هەولێر",
        governorateKey: erbil?.governorateKey ?? null,
        address: "هەولێر",
        landmark: "نزیک قەڵا",
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        status: o.status,
        paymentMethod: "cod",
        paymentStatus: o.status === "delivered" ? "paid" : "unpaid",
        locale: "ku",
        restockedAt: o.status === "cancelled" ? at : null,
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: orders.id });
    await db.insert(orderItems).values(
      o.lines.map((l) => ({
        orderId: order!.id,
        productId: l.productId,
        variantId: l.variantId ?? null,
        name: l.name,
        variantTitle: l.variantTitle ?? null,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        lineTotal: l.unitPrice * l.quantity,
      })),
    );
    const steps = o.status === "delivered" ? (["pending", "confirmed", "shipped", "delivered"] as const) : (["pending", "cancelled"] as const);
    await db.insert(orderEvents).values(
      steps.map((to, i) => ({
        orderId: order!.id,
        fromStatus: i === 0 ? null : steps[i - 1]!,
        toStatus: to,
        createdAt: new Date(at.getTime() + i * 6 * 3_600_000),
      })),
    );
  }

  console.log(`[seed] created Hawler Bazaar → /s/hawler-bazaar  (login: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
