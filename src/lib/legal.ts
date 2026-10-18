import "server-only";
import type { Locale } from "./i18n";
import type { LegalDoc } from "./legal-ui";

export { LEGAL_DOCS, type LegalDoc } from "./legal-ui";

/**
 * Legal pages (/terms, /privacy, /refund) in all four locales. Plain data so the pages stay server-only (no client JS)
 * and tests can check every locale has the same documents and section count. The English text is the reference;
 * the others are faithful translations. Facts here must match the product: plans in src/lib/plans.ts (month to
 * month, cancel anytime), analytics without IP/UA (src/lib/analytics.ts), rate-limit counters pruned daily.
 * Status: launch draft written 2026-10-14, to be reviewed by Abdulla before Tuesday production.
 */

export type LegalSection = { h: string; p: string[] };
export type LegalPage = { title: string; description: string; intro: string; sections: LegalSection[] };

export const LEGAL: Record<LegalDoc, Record<Locale, LegalPage>> = {
  terms: {
    en: {
      title: "Terms of Service",
      description: "The rules for using Reelcart to run an online store.",
      intro: "Reelcart is an online store builder operated by Kurdistan AI in Erbil, Kurdistan Region of Iraq. These terms apply to everyone who creates a store (sellers) and everyone who shops in one (shoppers). By using Reelcart you accept them.",
      sections: [
        { h: "Your account", p: ["You must be at least 18, or the legal age where you live, to open a store. Keep your password private; you are responsible for what happens in your account.", "Give us a real email address so we can reach you about your store."] },
        { h: "Your store and your sales", p: ["You own your store, your products and your customers. Each sale is between you and your shopper: you set prices, deliver orders, collect cash on delivery and handle returns under your own return policy.", "You are responsible for following the laws that apply to your business, including taxes, consumer rules and product safety."] },
        { h: "What you may not sell or do", p: ["No illegal, stolen or counterfeit goods, weapons, drugs, adult content, or anything that infringes someone else's rights. No fake orders, spam, scraping, or attempts to break or overload the service.", "We may hide a product or suspend a store that breaks these rules, and we will tell you why."] },
        { h: "Plans and payments", p: ["The Free plan costs nothing. Paid plans (Pro, Business and Max) are month to month or yearly, shown on our pricing page, and you can cancel any time; your store and products stay as they are on the Free plan.", "Online payment methods, when available, are provided by licensed payment companies under their own terms."] },
        { h: "Your content", p: ["You keep the rights to the photos and text you upload. You let us host, resize and show them so your store works, including in previews and share images you create."] },
        { h: "Availability and changes", p: ["We work hard to keep Reelcart online and your data safe, but the service is provided as is, without guarantees of uninterrupted operation. We may improve or change features; we will announce important changes to these terms before they apply."] },
        { h: "Liability", p: ["To the extent the law allows, Reelcart is not liable for lost profits or indirect losses, and our total liability for a claim is limited to what you paid us in the 3 months before it."] },
        { h: "Ending", p: ["You can close your store at any time. We may close accounts that seriously or repeatedly break these terms. These terms are governed by the laws applicable in the Kurdistan Region of Iraq, and disputes go to the courts of Erbil."] },
      ],
    },
    ku: {
      title: "مەرجەکانی بەکارهێنان",
      description: "ڕێساکانی بەکارهێنانی بازارگە بۆ بەڕێوەبردنی فرۆشگایەکی ئۆنلاین.",
      intro: "بازارگە دروستکەری فرۆشگای ئۆنلاینە و لەلایەن کوردستان ئەی ئای لە هەولێر، هەرێمی کوردستانی عێراق بەڕێوە دەبرێت. ئەم مەرجانە بۆ هەموو ئەوانەن کە فرۆشگا دروست دەکەن (فرۆشیاران) و ئەوانەی تێیدا دەکڕن (کڕیاران). بە بەکارهێنانی بازارگە ڕازی دەبیت پێیان.",
      sections: [
        { h: "هەژمارەکەت", p: ["بۆ کردنەوەی فرۆشگا دەبێت تەمەنت لانیکەم ١٨ ساڵ بێت، یان تەمەنی یاسایی لە شوێنی ژیانت. وشەی نهێنییەکەت بپارێزە؛ تۆ بەرپرسیاریت لەوەی لە هەژمارەکەتدا ڕوودەدات.", "ئیمەیڵێکی ڕاستەقینە بدە بۆ ئەوەی بتوانین دەربارەی فرۆشگاکەت پەیوەندیت پێوە بکەین."] },
        { h: "فرۆشگاکەت و فرۆشتنەکانت", p: ["فرۆشگاکەت، بەرهەمەکانت و کڕیارەکانت هی خۆتن. هەر فرۆشتنێک لە نێوان تۆ و کڕیارەکەتدایە: تۆ نرخ دادەنێیت، داواکاری دەگەیەنیت، پارەی کاش لە کاتی گەیاندن وەردەگریت و گەڕاندنەوە بەپێی سیاسەتی خۆت ڕێکدەخەیت.", "تۆ بەرپرسیاریت لە پەیڕەوکردنی ئەو یاسایانەی کە بەسەر کارەکەتدا جێبەجێ دەبن، لەوانە باج، مافی بەکاربەر و سەلامەتی بەرهەم."] },
        { h: "ئەوەی نابێت بیفرۆشیت یان بیکەیت", p: ["کاڵای نایاسایی، دزراو یان ساختە، چەک، مادەی هۆشبەر، ناوەڕۆکی گەورەسالان، یان هەر شتێک کە مافی کەسێکی تر پێشێل بکات قەدەغەیە. داواکاری ساختە، سپام، کۆکردنەوەی داتا بە ئۆتۆماتیکی، یان هەوڵدان بۆ تێکدانی خزمەتگوزارییەکە قەدەغەیە.", "دەکرێت بەرهەمێک بشارینەوە یان فرۆشگایەک ڕابگرین کە ئەم ڕێسایانە دەشکێنێت، و هۆکارەکەت پێ دەڵێین."] },
        { h: "پلان و پارەدان", p: ["پلانی بێبەرامبەر هیچ تێچووێکی نییە. پلانە پارەدارەکان (Pro، Business و Max) مانگانە یان ساڵانەن، لە پەڕەی نرخەکاندا نیشان دراون، و هەر کاتێک بتەوێت دەتوانیت هەڵیانبوەشێنیتەوە؛ فرۆشگا و بەرهەمەکانت وەک خۆیان لەسەر پلانی بێبەرامبەر دەمێننەوە.", "شێوازەکانی پارەدانی ئۆنلاین، کاتێک بەردەست بن، لەلایەن کۆمپانیای پارەدانی مۆڵەتدارەوە بەپێی مەرجەکانی خۆیان پێشکەش دەکرێن."] },
        { h: "ناوەڕۆکەکەت", p: ["مافی ئەو وێنە و دەقانەی بارت کردوون بۆ خۆت دەمێنێتەوە. ڕێگەمان پێ دەدەیت هەڵیانبگرین، قەبارەیان بگۆڕین و نیشانیان بدەین بۆ ئەوەی فرۆشگاکەت کار بکات، لەوانە لە پێشبینین و وێنەی هاوبەشکردندا."] },
        { h: "بەردەستبوون و گۆڕانکاری", p: ["هەوڵی زۆر دەدەین بازارگە ئۆنلاین بێت و داتاکانت پارێزراو بن، بەڵام خزمەتگوزارییەکە وەک خۆی پێشکەش دەکرێت، بێ گەرەنتی کارکردنی بێ پچڕان. دەکرێت تایبەتمەندییەکان باشتر بکەین یان بیانگۆڕین؛ گۆڕانکارییە گرنگەکانی ئەم مەرجانە پێش جێبەجێکردن ڕادەگەیەنین."] },
        { h: "بەرپرسیاریەتی", p: ["تا ئەو ڕادەیەی یاسا ڕێگە دەدات، بازارگە بەرپرسیار نییە لە قازانجی لەدەستچوو یان زیانی ناڕاستەوخۆ، و کۆی بەرپرسیاریەتیمان بۆ هەر داوایەک سنووردارە بەو بڕەی لە ٣ مانگی پێشوودا پێتداوین."] },
        { h: "کۆتاییهێنان", p: ["هەر کاتێک بتەوێت دەتوانیت فرۆشگاکەت دابخەیت. دەکرێت ئەو هەژمارانە دابخەین کە بە شێوەیەکی گەورە یان دووبارە ئەم مەرجانە دەشکێنن. ئەم مەرجانە ملکەچی ئەو یاسایانەن کە لە هەرێمی کوردستانی عێراق جێبەجێ دەکرێن، و ناکۆکییەکان دەچنە دادگاکانی هەولێر."] },
      ],
    },
    ar: {
      title: "شروط الخدمة",
      description: "قواعد استخدام بازارگە لإدارة متجر إلكتروني.",
      intro: "بازارگە منصة لإنشاء المتاجر الإلكترونية تديرها شركة كوردستان AI في أربيل، إقليم كوردستان العراق. تنطبق هذه الشروط على كل من ينشئ متجراً (البائعون) وكل من يتسوق فيه (المشترون). باستخدامك بازارگە فإنك توافق عليها.",
      sections: [
        { h: "حسابك", p: ["يجب أن يكون عمرك 18 عاماً على الأقل، أو السن القانونية في مكان إقامتك، لفتح متجر. احتفظ بكلمة المرور سرية؛ أنت مسؤول عما يحدث في حسابك.", "استخدم بريداً إلكترونياً حقيقياً حتى نتمكن من التواصل معك بشأن متجرك."] },
        { h: "متجرك ومبيعاتك", p: ["متجرك ومنتجاتك وزبائنك ملك لك. كل عملية بيع تتم بينك وبين المشتري: أنت تحدد الأسعار، وتوصل الطلبات، وتستلم الدفع عند الاستلام، وتتعامل مع الإرجاع وفق سياسة الإرجاع الخاصة بك.", "أنت مسؤول عن الالتزام بالقوانين التي تنطبق على عملك، بما فيها الضرائب وحماية المستهلك وسلامة المنتجات."] },
        { h: "ما لا يجوز بيعه أو فعله", p: ["يُمنع بيع السلع غير القانونية أو المسروقة أو المقلدة، والأسلحة، والمخدرات، والمحتوى الإباحي، أو أي شيء ينتهك حقوق الآخرين. كما يُمنع الطلبات الوهمية والرسائل المزعجة وجمع البيانات آلياً ومحاولات تعطيل الخدمة أو إثقالها.", "قد نخفي منتجاً أو نعلّق متجراً يخالف هذه القواعد، وسنخبرك بالسبب."] },
        { h: "الباقات والدفع", p: ["الباقة المجانية بلا تكلفة. الباقات المدفوعة (Pro وBusiness وMax) شهرية أو سنوية كما هو موضح في صفحة الأسعار، ويمكنك الإلغاء في أي وقت؛ ويبقى متجرك ومنتجاتك كما هي على الباقة المجانية.", "طرق الدفع الإلكتروني، عند توفرها، تقدمها شركات دفع مرخّصة وفق شروطها الخاصة."] },
        { h: "المحتوى الخاص بك", p: ["تحتفظ بحقوق الصور والنصوص التي ترفعها. وتسمح لنا باستضافتها وتغيير حجمها وعرضها ليعمل متجرك، بما في ذلك في المعاينات وصور المشاركة التي تنشئها."] },
        { h: "التوفر والتغييرات", p: ["نعمل بجد لإبقاء بازارگە متاحاً وبياناتك آمنة، لكن الخدمة مقدمة كما هي، دون ضمان للعمل دون انقطاع. قد نحسّن الميزات أو نغيّرها، وسنعلن عن التغييرات المهمة على هذه الشروط قبل سريانها."] },
        { h: "المسؤولية", p: ["في الحدود التي يسمح بها القانون، لا تتحمل بازارگە مسؤولية الأرباح الفائتة أو الخسائر غير المباشرة، وتقتصر مسؤوليتنا الإجمالية عن أي مطالبة على ما دفعته لنا خلال الأشهر الثلاثة السابقة لها."] },
        { h: "الإنهاء", p: ["يمكنك إغلاق متجرك في أي وقت. وقد نغلق الحسابات التي تخالف هذه الشروط مخالفة جسيمة أو متكررة. تخضع هذه الشروط للقوانين المعمول بها في إقليم كوردستان العراق، وتُحال النزاعات إلى محاكم أربيل."] },
      ],
    },
    kmr: {
      title: "Mercên Karûbarê",
      description: "Rêzikên bikaranîna Reelcart ji bo birêvebirina firoşgeheke online.",
      intro: "Reelcart avakerê firoşgehên online ye û ji aliyê Kurdistan AI ve li Hewlêrê, Herêma Kurdistanê ya Iraqê tê birêvebirin. Ev merc ji bo hemû kesên ku firoşgehê ava dikin (firoşkar) û kesên ku tê de dikirin (kirrîyar) derbas dibin. Bi bikaranîna Reelcart tu wan qebûl dikî.",
      sections: [
        { h: "Hesabê te", p: ["Ji bo vekirina firoşgehê divê tu herî kêm 18 salî bî, an jî temenê qanûnî yê li cihê ku tu lê dijî. Şîfreya xwe veşartî bihêle; tu berpirsiyarê tiştên di hesabê xwe de yî.", "E-nameyeke rast bide da ku em karibin derbarê firoşgeha te de bi te re têkilî daynin."] },
        { h: "Firoşgeha te û firotinên te", p: ["Firoşgeh, berhem û kirrîyarên te yên te ne. Her firotin di navbera te û kirrîyar de ye: tu bihayan datînî, siparîşan digihînî, pereyê dema gihandinê berhev dikî û vegerandinan li gorî siyaseta xwe birê ve dibî.", "Tu berpirsiyar î ku qanûnên li ser karê xwe bişopînî, di nav de bac, mafên xerîdaran û ewlehiya berheman."] },
        { h: "Tiştên ku nabe bifiroşî an bikî", p: ["Tiştên neqanûnî, dizî an sexte, çek, madeyên hişbir, naveroka mezinan, an her tiştê ku mafên kesên din binpê dike qedexe ne. Siparîşên sexte, spam, berhevkirina daneyan a otomatîk, an hewldana xerakirin an girankirina karûbarê qedexe ne.", "Dibe ku em berhemekê veşêrin an firoşgehekê rawestînin ku van rêzikan dişkîne, û em ê sedemê ji te re bibêjin."] },
        { h: "Plan û dayîn", p: ["Plana belaş bê pere ye. Planên bi pere (Pro, Business û Max) mehane an salane ne, li ser rûpela bihayan têne nîşandan, û tu dikarî her dem betal bikî; firoşgeh û berhemên te li ser plana belaş wekî xwe dimînin.", "Rêbazên dayîna online, dema hebin, ji aliyê pargîdaniyên dayînê yên destûrdar ve li gorî mercên wan têne pêşkêşkirin."] },
        { h: "Naveroka te", p: ["Mafên wêne û nivîsên ku tu bar dikî yên te dimînin. Tu destûrê didî me ku em wan bihewînin, mezinahiya wan biguherînin û nîşan bidin da ku firoşgeha te bixebite, di nav de di pêşdîtin û wêneyên parvekirinê de."] },
        { h: "Berdestbûn û guhertin", p: ["Em gelek hewl didin ku Reelcart online bimîne û daneyên te ewle bin, lê karûbar wekî xwe tê pêşkêşkirin, bê garantiya xebata bê navber. Dibe ku em taybetmendiyan baştir bikin an biguherînin; em ê guhertinên girîng ên van mercan berî ku derbas bibin ragihînin."] },
        { h: "Berpirsiyarî", p: ["Heta ku qanûn destûrê dide, Reelcart ne berpirsiyarê qezenca winda an zirarên neyekser e, û berpirsiyariya me ya giştî ji bo her daxwazekê bi pereyê ku te di 3 mehên berê de daye me sînordar e."] },
        { h: "Dawîanîn", p: ["Tu dikarî her dem firoşgeha xwe bigirî. Dibe ku em hesabên ku van mercan bi giranî an dubare dişkînin bigirin. Ev merc bi qanûnên ku li Herêma Kurdistanê ya Iraqê derbas dibin ve girêdayî ne, û nakokî diçin dadgehên Hewlêrê."] },
      ],
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy",
      description: "What data Reelcart keeps, why, and the choices you have.",
      intro: "We collect only what we need to run your store and deliver your orders. We do not sell personal data and we do not show ads.",
      sections: [
        { h: "Sellers", p: ["When you sign up we keep your name, email, a scrambled (hashed) password, and the store details you enter: name, link, logo, WhatsApp number, delivery cities and fees, products and photos."] },
        { h: "Shoppers", p: ["When you order, the store receives your name, phone number, city, area, address or landmark, order notes and what you bought. This data belongs to the store you ordered from; Reelcart stores it on the store's behalf so the seller can deliver your order and you can track it.", "Your browser may remember your cart and your delivery details on your own device so the next checkout is faster. You can clear them by clearing your browser data."] },
        { h: "Visit statistics", p: ["Stores see visitor counts, product views and orders. We count visits without cookies and without storing IP addresses or device details; only daily totals are saved."] },
        { h: "Cookies", p: ["We use a few necessary cookies: your login session, your language, and a short-lived cookie that shows an order you just tracked. No advertising or third-party tracking cookies."] },
        { h: "Security", p: ["Data travels over encrypted connections and is stored with our hosting and database providers (Vercel and Supabase). Each store can only ever see its own orders and customers. To stop abuse we keep short-lived counters of requests per IP address, deleted within a day."] },
        { h: "Who else processes data", p: ["Hosting (Vercel), database and file storage (Supabase), email delivery when enabled (Resend or Brevo), and payment companies when you choose to pay online (only what the payment needs)."] },
        { h: "How long we keep it", p: ["Seller and store data stays while the store exists. Orders and customers stay until the seller deletes them or closes the store, then they are removed. Backups roll over within a few weeks."] },
        { h: "Your choices", p: ["You can ask us for a copy of your data, to correct it, or to delete it by writing to us. Shoppers can also ask the store they ordered from directly."] },
      ],
    },
    ku: {
      title: "سیاسەتی تایبەتمەندی",
      description: "بازارگە چ داتایەک هەڵدەگرێت، بۆچی، و چ هەڵبژاردنێکت هەیە.",
      intro: "تەنها ئەوە کۆدەکەینەوە کە بۆ بەڕێوەبردنی فرۆشگاکەت و گەیاندنی داواکارییەکانت پێویستە. داتای کەسی نافرۆشین و ڕیکلام پیشان نادەین.",
      sections: [
        { h: "فرۆشیاران", p: ["کاتێک خۆت تۆمار دەکەیت، ناو، ئیمەیڵ، وشەی نهێنییەکی شێوێنراو (هاش)، و ئەو زانیارییانەی فرۆشگا کە دەینووسیت هەڵدەگرین: ناو، بەستەر، لۆگۆ، ژمارەی واتسئاپ، شار و کرێی گەیاندن، بەرهەم و وێنەکان."] },
        { h: "کڕیاران", p: ["کاتێک داوا دەکەیت، فرۆشگاکە ناو، ژمارەی مۆبایل، شار، گەڕەک، ناونیشان یان نیشانە، تێبینی و ئەوەی کڕیوتە وەردەگرێت. ئەم داتایە هی ئەو فرۆشگایەیە کە لێی کڕیوە؛ بازارگە بە ناوی فرۆشگاکەوە هەڵیدەگرێت بۆ ئەوەی فرۆشیار داواکارییەکەت بگەیەنێت و تۆش بەدوایدا بچیت.", "وێبگەڕەکەت لەوانەیە سەبەتە و زانیاری گەیاندنەکەت لەسەر ئامێرەکەی خۆت بیر بێت بۆ ئەوەی جاری داهاتوو خێراتر بێت. دەتوانیت بە سڕینەوەی داتای وێبگەڕ بیانسڕیتەوە."] },
        { h: "ئاماری سەردان", p: ["فرۆشگاکان ژمارەی سەردانکەران، بینینی بەرهەم و داواکارییەکان دەبینن. سەردانەکان بێ کووکی و بێ هەڵگرتنی ناونیشانی IP یان زانیاری ئامێر دەژمێرین؛ تەنها کۆی ڕۆژانە پاشەکەوت دەکرێت."] },
        { h: "کووکی", p: ["چەند کووکییەکی پێویست بەکاردەهێنین: دانیشتنی چوونەژوورەوە، زمانەکەت، و کووکییەکی کورتخایەن کە ئەو داواکارییە پیشان دەدات کە تازە بەدوایدا چوویت. هیچ کووکی ڕیکلام یان چاودێری لایەنی سێیەم نییە."] },
        { h: "ئاسایش", p: ["داتا بە پەیوەندی شفرەکراو دەگوازرێتەوە و لای دابینکەرانی هۆستینگ و داتابەیسەکەمان (Vercel و Supabase) هەڵدەگیرێت. هەر فرۆشگایەک تەنها داواکاری و کڕیارەکانی خۆی دەبینێت. بۆ ڕێگریکردن لە خراپ بەکارهێنان، ژمێرەری کورتخایەنی داواکاری بۆ هەر ناونیشانێکی IP هەڵدەگرین و لە ماوەی ڕۆژێکدا دەسڕدرێنەوە."] },
        { h: "کێی تر داتا مامەڵە دەکات", p: ["هۆستینگ (Vercel)، داتابەیس و هەڵگرتنی فایل (Supabase)، ناردنی ئیمەیڵ کاتێک چالاک بێت (Resend یان Brevo)، و کۆمپانیاکانی پارەدان کاتێک هەڵدەبژێریت ئۆنلاین پارە بدەیت (تەنها ئەوەی پارەدانەکە پێویستی پێیەتی)."] },
        { h: "ماوەی هەڵگرتن", p: ["داتای فرۆشیار و فرۆشگا تا ئەو کاتەی فرۆشگاکە هەیە دەمێنێتەوە. داواکاری و کڕیاران دەمێننەوە تا فرۆشیار دەیانسڕێتەوە یان فرۆشگاکە دادەخات، پاشان لادەبرێن. کۆپییە یەدەگەکان لە ماوەی چەند هەفتەیەکدا نوێ دەبنەوە."] },
        { h: "هەڵبژاردنەکانت", p: ["دەتوانیت بە نووسینی نامەیەک بۆمان، داوای کۆپییەک لە داتاکانت، ڕاستکردنەوەیان، یان سڕینەوەیان بکەیت. کڕیارانیش دەتوانن ڕاستەوخۆ داوا لەو فرۆشگایە بکەن کە لێیان کڕیوە."] },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      description: "ما البيانات التي تحتفظ بها بازارگە، ولماذا، وما خياراتك.",
      intro: "نجمع فقط ما نحتاجه لتشغيل متجرك وتوصيل طلباتك. لا نبيع البيانات الشخصية ولا نعرض إعلانات.",
      sections: [
        { h: "البائعون", p: ["عند التسجيل نحتفظ باسمك وبريدك الإلكتروني وكلمة مرور مشفّرة (مُجزّأة)، وتفاصيل المتجر التي تُدخلها: الاسم والرابط والشعار ورقم واتساب ومدن التوصيل وأجورها والمنتجات والصور."] },
        { h: "المشترون", p: ["عند الطلب، يستلم المتجر اسمك ورقم هاتفك ومدينتك ومنطقتك وعنوانك أو أقرب معلم وملاحظات الطلب وما اشتريته. هذه البيانات ملك للمتجر الذي طلبت منه؛ وتحفظها بازارگە نيابة عنه ليتمكن البائع من توصيل طلبك وتتمكن من تتبّعه.", "قد يتذكر متصفحك سلتك وبيانات التوصيل على جهازك أنت ليكون الطلب التالي أسرع. يمكنك حذفها بمسح بيانات المتصفح."] },
        { h: "إحصاءات الزيارات", p: ["ترى المتاجر عدد الزوار ومشاهدات المنتجات والطلبات. نحسب الزيارات دون ملفات تعريف الارتباط ودون حفظ عناوين IP أو بيانات الجهاز؛ ولا يُحفظ إلا المجموع اليومي."] },
        { h: "ملفات تعريف الارتباط", p: ["نستخدم عدداً قليلاً من الملفات الضرورية: جلسة تسجيل الدخول، ولغتك، وملفاً قصير الأمد يعرض الطلب الذي تتبّعته للتو. لا توجد ملفات إعلانية أو تتبّع من أطراف ثالثة."] },
        { h: "الأمان", p: ["تنتقل البيانات عبر اتصالات مشفّرة وتُخزَّن لدى مزوّدي الاستضافة وقاعدة البيانات (Vercel وSupabase). لا يرى أي متجر إلا طلباته وزبائنه. ولمنع إساءة الاستخدام نحتفظ بعدّادات قصيرة الأمد للطلبات لكل عنوان IP تُحذف خلال يوم."] },
        { h: "من يعالج البيانات أيضاً", p: ["الاستضافة (Vercel)، وقاعدة البيانات وتخزين الملفات (Supabase)، وإرسال البريد عند تفعيله (Resend أو Brevo)، وشركات الدفع عندما تختار الدفع الإلكتروني (ما يلزم للدفع فقط)."] },
        { h: "مدة الاحتفاظ", p: ["تبقى بيانات البائع والمتجر ما دام المتجر موجوداً. وتبقى الطلبات والزبائن حتى يحذفها البائع أو يغلق المتجر، ثم تُزال. وتتجدد النسخ الاحتياطية خلال بضعة أسابيع."] },
        { h: "خياراتك", p: ["يمكنك أن تطلب منا نسخة من بياناتك أو تصحيحها أو حذفها بمراسلتنا. ويمكن للمشترين أيضاً مراجعة المتجر الذي طلبوا منه مباشرة."] },
      ],
    },
    kmr: {
      title: "Siyaseta Nihêniyê",
      description: "Reelcart kîjan daneyan diparêze, çima, û bijardeyên te çi ne.",
      intro: "Em tenê tiştên ku ji bo birêvebirina firoşgeha te û gihandina siparîşên te pêwîst in berhev dikin. Em daneyên kesane nafiroşin û reklaman nîşan nadin.",
      sections: [
        { h: "Firoşkar", p: ["Dema ku tu tomar dibî, em nav, e-name, şîfreyeke şîfrekirî (hash) û agahiyên firoşgehê yên ku tu dinivîsî diparêzin: nav, girêdan, logo, hejmara WhatsAppê, bajar û bihayên gihandinê, berhem û wêne."] },
        { h: "Kirrîyar", p: ["Dema ku tu siparîş didî, firoşgeh nav, hejmara telefonê, bajar, herêm, navnîşan an nîşaneya cihê te, nîşeyên siparîşê û tiştên ku te kirîne werdigire. Ev dane yên wê firoşgehê ne ku te jê kirîye; Reelcart wan li ser navê firoşgehê diparêze da ku firoşkar siparîşa te bigihîne û tu bikarî wê bişopînî.", "Dibe ku geroka te sepet û agahiyên gihandinê li ser cîhaza te bi bîr bîne da ku siparîşa din zûtir be. Tu dikarî bi paqijkirina daneyên gerokê wan jê bibî."] },
        { h: "Statîstîkên serdanan", p: ["Firoşgeh hejmara serdanvanan, dîtinên berheman û siparîşan dibînin. Em serdanan bê cookie û bê tomarkirina navnîşanên IP an agahiyên cîhazê dijmêrin; tenê berhevokên rojane têne tomarkirin."] },
        { h: "Cookie", p: ["Em çend cookieyên pêwîst bikar tînin: rûniştina têketinê, zimanê te, û cookieyeke kurtdem ku siparîşa ku te nû şopandiye nîşan dide. Tu cookieyên reklamê an şopandina aliyê sêyem tune ne."] },
        { h: "Ewlehî", p: ["Dane bi girêdanên şîfrekirî tên veguhestin û li cem peydakerên hosting û danegeha me (Vercel û Supabase) tên hilanîn. Her firoşgeh tenê siparîş û kirrîyarên xwe dibîne. Ji bo rawestandina destdirêjiyê, em jimarkerên kurtdem ên daxwazan ji bo her navnîşana IP diparêzin, ku di nav rojekê de tên jêbirin."] },
        { h: "Kî din daneyan pêvajo dike", p: ["Hosting (Vercel), danegeh û hilanîna pelan (Supabase), şandina e-nameyan dema çalak be (Resend an Brevo), û pargîdaniyên dayînê dema ku tu dayîna online hildibijêrî (tenê tiştê ku dayîn hewce dike)."] },
        { h: "Heta kengê em diparêzin", p: ["Daneyên firoşkar û firoşgehê heta ku firoşgeh hebe dimînin. Siparîş û kirrîyar dimînin heta ku firoşkar wan jê bibe an firoşgehê bigire, paşê têne rakirin. Kopiyên yedek di nav çend hefteyan de nû dibin."] },
        { h: "Bijardeyên te", p: ["Tu dikarî bi nivîsandina ji me re kopiyek ji daneyên xwe, rastkirina wan an jêbirina wan bixwazî. Kirrîyar jî dikarin rasterast ji firoşgeha ku jê kirîne bixwazin."] },
      ],
    },
  },
  refund: {
    en: {
      title: "Refund Policy",
      description: "Refunds for Reelcart plans, and how refunds work for orders placed in a store.",
      intro: "There are two kinds of payments on Reelcart: what sellers pay us for a plan, and what shoppers pay a store for an order. They have different refund rules.",
      sections: [
        { h: "Plans (sellers)", p: ["The Free plan has nothing to refund. If you pay for Pro, Business or Max and are not happy, ask within 7 days of the payment and we refund it in full.", "After 7 days you can cancel any time: the plan stays active until the end of the period you paid for and is not renewed. We do not refund part of a period that has started, except where the law requires it."] },
        { h: "How to ask", p: ["Write to us from the email on your account with your store link. We answer within 3 working days and send the refund the same way you paid (FIB, ZainCash, card or cash), usually within 10 working days."] },
        { h: "Orders (shoppers)", p: ["Each store sells its own products, so refunds and returns for an order are decided by that store's return policy, shown at the bottom of every store page. Contact the store first; its WhatsApp button is on every page."] },
        { h: "Cash on delivery", p: ["With cash on delivery you pay only when the order reaches you. If something is wrong, you can refuse it at the door; a return after you paid follows the store's policy."] },
        { h: "Online payments", p: ["If you paid online and the store cancels the order or agrees to a return, the refund goes back to the same payment method. If a store does not answer you within 7 days about a paid order, write to us and we will help."] },
      ],
    },
    ku: {
      title: "سیاسەتی گەڕاندنەوەی پارە",
      description: "گەڕاندنەوەی پارەی پلانەکانی بازارگە، و چۆنیەتی گەڕاندنەوەی پارە بۆ داواکارییەکانی ناو فرۆشگا.",
      intro: "دوو جۆر پارەدان لە بازارگەدا هەیە: ئەوەی فرۆشیاران بۆ پلان بە ئێمەی دەدەن، و ئەوەی کڕیاران بۆ داواکاری بە فرۆشگا دەدەن. ڕێسای گەڕاندنەوەیان جیاوازە.",
      sections: [
        { h: "پلانەکان (فرۆشیاران)", p: ["پلانی بێبەرامبەر هیچی نییە بۆ گەڕاندنەوە. ئەگەر پارەت بۆ Pro، Business یان Max دا و ڕازی نەبوویت، لە ماوەی ٧ ڕۆژ لە پارەدانەکە داوا بکە و هەمووی دەگەڕێنینەوە.", "دوای ٧ ڕۆژ هەر کاتێک بتەوێت دەتوانیت هەڵیبوەشێنیتەوە: پلانەکە تا کۆتایی ئەو ماوەیەی پارەت بۆ داوە چالاک دەمێنێت و نوێ ناکرێتەوە. بەشێک لە ماوەیەک کە دەستی پێکردووە ناگەڕێنینەوە، مەگەر یاسا داوای بکات."] },
        { h: "چۆن داوا بکەیت", p: ["لە ئیمەیڵی هەژمارەکەتەوە لەگەڵ بەستەری فرۆشگاکەت بۆمان بنووسە. لە ماوەی ٣ ڕۆژی کاردا وەڵام دەدەینەوە و پارەکە بە هەمان ڕێگەی پارەدان دەگەڕێنینەوە (FIB، ZainCash، کارت یان کاش)، زۆربەی کات لە ماوەی ١٠ ڕۆژی کاردا."] },
        { h: "داواکارییەکان (کڕیاران)", p: ["هەر فرۆشگایەک بەرهەمی خۆی دەفرۆشێت، بۆیە گەڕاندنەوەی پارە و کاڵا بۆ داواکارییەک بەپێی سیاسەتی گەڕاندنەوەی ئەو فرۆشگایە دیاری دەکرێت، کە لە خوارەوەی هەموو پەڕەکانی فرۆشگا نیشان دراوە. سەرەتا پەیوەندی بە فرۆشگاکەوە بکە؛ دوگمەی واتسئاپەکەی لە هەموو پەڕەیەکدا هەیە."] },
        { h: "پارەدان لە کاتی گەیاندن", p: ["بە پارەدان لە کاتی گەیاندن، تەنها کاتێک پارە دەدەیت کە داواکارییەکە دەگاتە دەستت. ئەگەر شتێک هەڵە بوو، دەتوانیت لەبەردەم دەرگا ڕەتی بکەیتەوە؛ گەڕاندنەوە دوای پارەدان بەپێی سیاسەتی فرۆشگاکەیە."] },
        { h: "پارەدانی ئۆنلاین", p: ["ئەگەر ئۆنلاین پارەت دا و فرۆشگاکە داواکارییەکەی هەڵوەشاندەوە یان ڕازی بوو بە گەڕاندنەوە، پارەکە بۆ هەمان ڕێگەی پارەدان دەگەڕێتەوە. ئەگەر فرۆشگایەک لە ماوەی ٧ ڕۆژدا دەربارەی داواکارییەکی پارەدراو وەڵامی نەدایتەوە، بۆمان بنووسە و یارمەتیت دەدەین."] },
      ],
    },
    ar: {
      title: "سياسة الاسترداد",
      description: "استرداد رسوم باقات بازارگە، وكيف يتم الاسترداد للطلبات داخل المتاجر.",
      intro: "هناك نوعان من المدفوعات في بازارگە: ما يدفعه البائعون لنا مقابل الباقة، وما يدفعه المشترون للمتجر مقابل الطلب. ولكل منهما قواعد استرداد مختلفة.",
      sections: [
        { h: "الباقات (البائعون)", p: ["الباقة المجانية لا يوجد فيها ما يُسترد. إذا دفعت مقابل Pro أو Business أو Max ولم تكن راضياً، اطلب الاسترداد خلال 7 أيام من الدفع وسنعيد المبلغ كاملاً.", "بعد 7 أيام يمكنك الإلغاء في أي وقت: تبقى الباقة فعّالة حتى نهاية الفترة المدفوعة ولا تُجدَّد. لا نسترد جزءاً من فترة بدأت، إلا إذا ألزم القانون بذلك."] },
        { h: "كيف تطلب", p: ["راسلنا من البريد المسجّل في حسابك مع رابط متجرك. نرد خلال 3 أيام عمل ونعيد المبلغ بطريقة الدفع نفسها (FIB أو ZainCash أو البطاقة أو نقداً)، عادةً خلال 10 أيام عمل."] },
        { h: "الطلبات (المشترون)", p: ["كل متجر يبيع منتجاته الخاصة، لذلك يحدد استرداد الطلب وإرجاعه وفق سياسة الإرجاع لذلك المتجر، المعروضة أسفل كل صفحة من صفحاته. تواصل مع المتجر أولاً؛ زر واتساب موجود في كل صفحة."] },
        { h: "الدفع عند الاستلام", p: ["مع الدفع عند الاستلام تدفع فقط عندما يصلك الطلب. إذا كان هناك خطأ يمكنك رفضه عند الباب؛ أما الإرجاع بعد الدفع فيخضع لسياسة المتجر."] },
        { h: "الدفع الإلكتروني", p: ["إذا دفعت إلكترونياً وألغى المتجر الطلب أو وافق على الإرجاع، يعود المبلغ إلى طريقة الدفع نفسها. وإذا لم يرد عليك متجر خلال 7 أيام بشأن طلب مدفوع، راسلنا وسنساعدك."] },
      ],
    },
    kmr: {
      title: "Siyaseta Vegerandina Pere",
      description: "Vegerandina pereyê planên Reelcart, û çawa vegerandin ji bo siparîşên di firoşgehan de dixebite.",
      intro: "Li Reelcart du cure dayîn hene: tiştê ku firoşkar ji bo planê didin me, û tiştê ku kirrîyar ji bo siparîşê didin firoşgehê. Rêzikên vegerandina wan cuda ne.",
      sections: [
        { h: "Plan (firoşkar)", p: ["Di plana belaş de tiştek ji bo vegerandinê tune. Heke te ji bo Pro, Business an Max pere da û tu ne razî bî, di nav 7 rojan de ji dayînê bixwaze û em ê hemûyê vegerînin.", "Piştî 7 rojan tu dikarî her dem betal bikî: plan heta dawiya dema ku te pere daye çalak dimîne û nayê nûkirin. Em beşek ji demeke ku dest pê kiriye venagerînin, ji bilî dema ku qanûn wê dixwaze."] },
        { h: "Çawa bixwazî", p: ["Ji e-nameya hesabê xwe bi girêdana firoşgeha xwe ji me re binivîse. Em di nav 3 rojên kar de bersiv didin û pere bi heman rêbaza dayînê vedigerînin (FIB, ZainCash, kart an kaş), bi gelemperî di nav 10 rojên kar de."] },
        { h: "Siparîş (kirrîyar)", p: ["Her firoşgeh berhemên xwe difiroşe, ji ber vê yekê vegerandina pere û tiştan ji bo siparîşekê li gorî siyaseta vegerandinê ya wê firoşgehê tê diyarkirin, ku li binê her rûpela firoşgehê tê nîşandan. Pêşî bi firoşgehê re têkilî dayne; bişkoka WhatsAppê li ser her rûpelê heye."] },
        { h: "Dayîn dema gihandinê", p: ["Bi dayîna dema gihandinê, tu tenê dema ku siparîş digihîje te pere didî. Heke tiştek xelet be, tu dikarî li ber derî red bikî; vegerandina piştî dayînê li gorî siyaseta firoşgehê ye."] },
        { h: "Dayîna online", p: ["Heke te online pere da û firoşgeh siparîşê betal kir an bi vegerandinê razî bû, pere vedigere heman rêbaza dayînê. Heke firoşgehek di nav 7 rojan de derbarê siparîşeke bi pere de bersiva te nede, ji me re binivîse û em ê alîkariya te bikin."] },
      ],
    },
  },
};

