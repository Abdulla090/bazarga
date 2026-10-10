/*
 * Demo data: seller demo@mymarket.app / mymarket-demo  →  store "Studio Hawler" (/s/hawler-bazaar; slug kept for tests)
 * with four neutral products on plain backgrounds (linen overshirt with sizes, stoneware mug set, skincare set, canvas
 * tote; 3–5 photos and a details table each), the "bazaar" theme,
 * a cover photo with renditions, delivery areas in Erbil and Sulaymaniyah, the SAVE10 and WELCOME10 discount codes
 * (SAVE10 advertised on the storefront), free delivery over 75,000 IQD, and a few past orders so the storefront
 * shows real best sellers: the mug set (3 orders) and the overshirt (2) earn the "Best seller" badge, the tote (1) joins
 * the strip, a cancelled skincare order counts for nothing. Mugs and tote are on sale; the skincare set is "New".
 * (Variable names honey/dress/scarf are the historical product slots.)
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
    console.log("[seed] Studio Hawler already exists — nothing to do");
    process.exit(0);
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  const user = existing ?? (await signUp(db, { name: "Studio Hawler", email: DEMO_EMAIL, password: DEMO_PASSWORD, locale: "ku" }));

  const store = await createStore(db, user.id, {
    name: "Studio Hawler",
    slug: "hawler-bazaar",
    defaultLocale: "ku",
    phone: "9647501234567",
    whatsapp: "9647501234567",
    instagram: "studio.hawler",
    city: "erbil",
    tagline: { ku: "کەلوپەلی ڕۆژانە، بە باشی دروستکراو", ar: "أغراض يومية، مصنوعة بإتقان", en: "Everyday goods, made well", kmr: "Tiştên rojane, baş çêkirî" },
  });

  const clothing = await createCategory(db, store.id, { name: { ku: "جلوبەرگ", ar: "ملابس", en: "Clothing", kmr: "Cil" }, sort: 0 });
  const home = await createCategory(db, store.id, { name: { ku: "ماڵ", ar: "المنزل", en: "Home", kmr: "Mal" }, sort: 1 });
  const beauty = await createCategory(db, store.id, { name: { ku: "جوانکاری", ar: "مستحضرات", en: "Beauty", kmr: "Bedewî" }, sort: 2 });

  const base = { compareAtPrice: null, isActive: true } as const;
  const origin = { ku: "شوێنی دروستکردن", ar: "بلد المنشأ", en: "Origin", kmr: "Çêbûn" };
  const material = { ku: "کەرەستە", ar: "الخامة", en: "Material", kmr: "Materyal" };
  const size = { ku: "قەبارە", ar: "المقاس", en: "Size", kmr: "Mezinahî" };
  const care = { ku: "چاودێری", ar: "العناية", en: "Care", kmr: "Lênêrîn" };

  const dress = await createProduct(db, store.id, {
    ...base,
    name: { ku: "کراسی کەتان", ar: "قميص كتان", en: "Linen overshirt", kmr: "Kirasê ketan" },
    description: {
      ku: "کراسێکی فراوان لە کەتانی شۆراو، بۆ لەسەر یەک لەبەرکردن.\n\nڕەنگی لمی نەرم، دوگمەی سروشتی، دوو گیرفانی سنگ.\nبە هەر شوشتنێک نەرمتر دەبێت.\n\nقەبارەکان S، M و L ن؛ بڕینەکەی فراوانە، قەبارەی ئاسایی خۆت هەڵبژێرە. دڵنیا نیت؟ لە واتسئاپ پێوانەکانت بنێرە و یارمەتیت دەدەین.",
      ar: "قميص واسع من الكتان المغسول، مناسب للطبقات.\n\nلون رملي ناعم، أزرار طبيعية وجيبان على الصدر.\nيزداد نعومة مع كل غسلة.\n\nالمقاسات S وM وL؛ القصّة واسعة فاختر مقاسك المعتاد. لست متأكداً؟ أرسل قياساتك على واتساب وسنساعدك.",
      en: "A relaxed overshirt in washed linen, made for layering.\n\nSoft sand colour, natural buttons, two chest pockets.\nGets softer with every wash.\n\nSizes S, M and L; the fit is relaxed, so take your usual size. Not sure? Send your measurements on WhatsApp and we'll help.",
      kmr: "Kirasekî fireh ji ketana şûştî, ji bo ser hev li xwe kirinê.\n\nRengê qûmê yê nerm, bişkojên xwezayî, du bêrîkên sîngê.\nBi her şûştinê nermtir dibe.\n\nMezinahî S, M û L; birrîn fireh e, mezinahiya xwe ya asayî hilbijêre. Ne bawer î? Pîvanên xwe li WhatsAppê bişîne, em ê alîkariya te bikin.",
    },
    price: 85000,
    stock: 12,
    categoryId: clothing.id,
    specs: [
      spec(material, { ku: "کەتانی ١٠٠٪", ar: "كتان 100٪", en: "100% linen", kmr: "Ketan 100%" }),
      spec(size, { ku: "S / M / L", ar: "S / M / L", en: "S / M / L" }),
      spec(care, { ku: "شوشتن بە ئاوی سارد", ar: "غسيل بالماء البارد", en: "Machine wash cold", kmr: "Bi ava sar bişo" }),
      spec(origin, { ku: "هەولێر، کوردستان", ar: "أربيل، كردستان", en: "Erbil, Kurdistan", kmr: "Hewlêr, Kurdistan" }),
    ],
    imageUrls: [],
    images: photos("product-shirt", "product-shirt-collar", "product-shirt-hem", "product-shirt-sleeve", "product-shirt-full"),
  });
  const honey = await createProduct(db, store.id, {
    ...base,
    name: { ku: "سێتی کوپی گڵ · ٢ دانە", ar: "طقم أكواب فخارية · قطعتان", en: "Stoneware mug set · 2 pcs", kmr: "Seta kûpên axî · 2 parçe" },
    description: {
      ku: "دوو کوپی گڵی خاڵدار لەگەڵ ژێرپیاڵەیەکی هاوشێوە، بە لووستەی سپیی نەرم.\n\n٣٥٠ مل دەگرێت. بۆ قاپشۆر و مایکرۆوەیڤ گونجاوە.",
      ar: "كوبان من الفخار المنقّط مع صحن مطابق، بطلاء أبيض ناعم.\n\nسعة 350 مل. آمن لغسالة الصحون والميكروويف.",
      en: "Two speckled stoneware mugs with a matching saucer, glazed in soft white.\n\nHolds 350 ml. Dishwasher and microwave safe.",
      kmr: "Du kûpên axî yên xalxalî bi binpiyaleyek hevreng, bi cilayê spî yê nerm.\n\n350 ml digire. Ji bo firaxşo û mîkropêlê ewle ye.",
    },
    price: 25000,
    compareAtPrice: 30000,
    stock: 40,
    sku: "SH-MUG-SET",
    categoryId: home.id,
    specs: [
      spec({ ku: "بڕی گرتن", ar: "السعة", en: "Capacity", kmr: "Kapasîte" }, { ku: "٣٥٠ مل", ar: "350 مل", en: "350 ml", kmr: "350 ml" }),
      spec(material, { ku: "گڵی سووتاو", ar: "فخار حجري", en: "Stoneware", kmr: "Axa pijandî" }),
      spec({ ku: "پارچەکان", ar: "القطع", en: "Pieces", kmr: "Parçe" }, { ku: "٢ کوپ + ژێرپیاڵە", ar: "كوبان + صحن", en: "2 mugs + saucer", kmr: "2 kûp + binpiyale" }),
    ],
    imageUrls: [],
    images: photos("product-mugs", "product-mugs-left", "product-mugs-right", "product-mugs-saucer"),
  });
  const skincare = await createProduct(db, store.id, {
    ...base,
    badge: "new",
    name: { ku: "سێتی پێستی سروشتی", ar: "مجموعة عناية طبيعية بالبشرة", en: "Natural skincare set", kmr: "Seta çermê xwezayî" },
    description: {
      ku: "سیرەم، لۆشن و کرێم بۆ ڕۆتینێکی ئارام و بێ بۆن.\n\nبۆ هەموو جۆرە پێستێک.\nبە دیاری پێچراوە.",
      ar: "سيروم ولوشن وكريم لروتين هادئ وخالٍ من العطور.\n\nلجميع أنواع البشرة.\nمغلّفة كهدية.",
      en: "Serum, lotion and cream for a calm, fragrance-free routine.\n\nFor every skin type.\nGift-wrapped.",
      kmr: "Serum, losyon û krem ji bo rûtînek aram û bê bîhn.\n\nJi bo her cureyê çerm.\nWek diyarî pêçayî.",
    },
    price: 40000,
    stock: null,
    sku: "SH-SKIN-SET",
    categoryId: beauty.id,
    specs: [
      spec({ ku: "ناوەڕۆک", ar: "المحتويات", en: "Contents", kmr: "Naverok" }, { ku: "سیرەم ٣٠ مل، لۆشن ١٠٠ مل، کرێم ٥٠ مل", ar: "سيروم 30 مل، لوشن 100 مل، كريم 50 مل", en: "Serum 30 ml, lotion 100 ml, cream 50 ml", kmr: "Serum 30 ml, losyon 100 ml, krem 50 ml" }),
      spec({ ku: "جۆری پێست", ar: "نوع البشرة", en: "Skin type", kmr: "Cureyê çerm" }, { ku: "هەموو جۆرێک", ar: "جميع الأنواع", en: "All skin types", kmr: "Hemû cure" }),
      spec(origin, { ku: "سلێمانی، کوردستان", ar: "السليمانية، كردستان", en: "Sulaymaniyah, Kurdistan", kmr: "Silêmanî, Kurdistan" }),
    ],
    imageUrls: [],
    images: photos("product-skincare", "product-skincare-serum", "product-skincare-pump", "product-skincare-jar"),
  });
  const scarf = await createProduct(db, store.id, {
    ...base,
    name: { ku: "جانتای کانڤاس", ar: "حقيبة قماش كانفاس", en: "Canvas tote", kmr: "Çenteya kanvas" },
    description: {
      ku: "جانتای کانڤاسی لۆکەی ئەستوور بە دەسکی درێژ.\nفراوان، بەهێز و ئاسان بۆ شوشتن.",
      ar: "حقيبة من قماش القطن السميك بمقابض طويلة.\nواسعة ومتينة وسهلة الغسل.",
      en: "Heavy cotton canvas tote with long handles.\nRoomy, sturdy and easy to wash.",
      kmr: "Çenteya kanvasa pembûyê stûr bi destikên dirêj.\nFireh, xurt û hêsan ji bo şûştinê.",
    },
    price: 35000,
    compareAtPrice: 42000,
    stock: 8,
    sku: "SH-TOTE-NAT",
    categoryId: home.id,
    specs: [
      spec(material, { ku: "کانڤاسی لۆکە", ar: "قماش قطني", en: "Cotton canvas", kmr: "Kanvasa pembû" }),
      spec(size, { ku: "٣٨ × ٤٢ سم", ar: "38 × 42 سم", en: "38 × 42 cm", kmr: "38 × 42 cm" }),
      spec(origin, { ku: "هەولێر", ar: "أربيل", en: "Erbil", kmr: "Hewlêr" }),
    ],
    imageUrls: [],
    images: photos("product-tote", "product-tote-handles", "product-tote-detail"),
  });

  // ---- theme + policies + promotions
  await db
    .update(stores)
    .set({
      themePreset: "bazaar",
      accentColor: null,
      about: {
        ku: "ستۆدیۆیەکی بچووکی هەولێر: کەتان، قاپی گڵ، چاودێری پێست و جانتای ڕۆژانە.",
        ar: "استوديو صغير في أربيل: كتان، فخار، عناية بالبشرة وحقائب يومية.",
        en: "A small Erbil studio: linen, stoneware, skincare and everyday bags.",
        kmr: "Stûdyoyek biçûk li Hewlêrê: ketan, firaxên axî, lênêrîna çerm û çenteyên rojane.",
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
    { storeId: store.id, code: "SAVE10", type: "percentage", value: 10, minSubtotal: 30_000, showOnStorefront: true },
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
    honey: (q: number): Line => ({ productId: honey.id, name: "سێتی کوپی گڵ · ٢ دانە", unitPrice: 25_000, quantity: q }),
    dress: (): Line => ({ productId: dress.id, variantId: dressM.id, name: "کراسی کەتان", variantTitle: "M", unitPrice: 85_000, quantity: 1 }),
    scarf: (): Line => ({ productId: scarf.id, name: "جانتای کانڤاس", unitPrice: 35_000, quantity: 1 }),
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
