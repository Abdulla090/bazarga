import type { LegalByLocale } from "./types";

/** Privacy Policy. Same 10 sections in every language, in the same order. Needs a lawyer's read before real launch. */
export const PRIVACY: LegalByLocale = {
  en: {
    title: "Privacy Policy",
    intro: "This page explains what information Bazarga keeps, why, and what you can ask us to do with it. We keep it short on purpose.",
    sections: [
      { h: "1. What we collect", p: ["From sellers: name, email, password (stored scrambled, never readable), phone or WhatsApp number, store details, products, photos and your orders.", "From customers who order from a store: name, phone number, city, address and landmark, the items ordered and any note.", "From everyone: language choice, a login cookie for sellers, and simple visit counts and device information (such as browser type) that keep the service working and safe."] },
      { h: "2. Who decides what", p: ["When you order from a store, the seller decides how to use your order details, and Bazarga handles them for the seller to run the store. For seller accounts, Bazarga is responsible."] },
      { h: "3. How we use it", p: ["To run stores and take orders, show customers their order status, email password-reset links, send notifications you turned on, show sellers simple statistics, stop fake orders and abuse, and give support."] },
      { h: "4. Who sees it", p: ["The seller whose store you order from sees your name, phone and address, because they need them to deliver. We use trusted providers for hosting, database and file storage. If you pay online, the payment provider (such as FIB or ZainCash) gets what it needs to take the payment. If you choose to send an order on WhatsApp, WhatsApp handles that message.", "We never sell personal data, and one seller never sees another seller's customers. We share data with authorities only when the law requires it."] },
      { h: "5. Cookies and your device", p: ["We use a login cookie for sellers and a cookie that remembers your language. If you choose to save your details at checkout, your name, phone and landmark stay on your own device only. We use no advertising trackers."] },
      { h: "6. Where it is stored", p: ["Data is stored on cloud servers that may be outside Iraq. We choose providers that protect data with encryption in transit and access controls."] },
      { h: "7. How long we keep it", p: ["We keep seller data while the account is open. We keep orders so sellers have their records. When you ask us to delete data, we do, unless the law or a fraud check needs us to keep it a little longer."] },
      { h: "8. Your choices", p: ["You can ask to see, correct or delete your data. Sellers can edit or delete their products and settings in the dashboard. Customers can ask the seller, or us, to delete their order details."] },
      { h: "9. Security and children", p: ["We use tenant separation between stores, scrambled passwords and encrypted connections. No system is perfectly safe, so tell us at once if you suspect a problem. Bazarga is not meant for children under 16."] },
      { h: "10. Changes and contact", p: ["We may update this policy and will show the date at the top. For any privacy request, use the contact details on this page."] },
    ],
  },
  ku: {
    title: "سیاسەتی نهێنیێتی",
    intro: "ئەم پەڕەیە ڕوون دەکاتەوە بازارگە چ زانیارییەک هەڵدەگرێت، بۆچی، و تۆ دەتوانیت داوامان لێ بکەیت چی پێ بکەین. بە ئەنقەست کورتمان کردووە.",
    sections: [
      { h: "1. چی کۆدەکەینەوە", p: ["لە فرۆشیارانەوە: ناو، ئیمەیل، وشەی نهێنی (شێوێنراو هەڵدەگیرێت و هەرگیز ناخوێنرێتەوە)، ژمارەی مۆبایل یان واتسئاپ، زانیاری دوکان، بەرهەم، وێنە و داواکارییەکانت.", "لەو کڕیارانەی لە دوکانێک داواکاری دەکەن: ناو، ژمارەی مۆبایل، شار، ناونیشان و نیشانەی نزیک، ئەو شتانەی داوات کردووە و هەر تێبینییەک.", "لە هەمووان: زمانی هەڵبژێردراو، کووکی چوونەژوورەوە بۆ فرۆشیاران، و ژمارەی سەردانی سادە و زانیاری ئامێر (وەک جۆری وێبگەڕ) کە خزمەتگوزارییەکە کارا و پارێزراو دەهێڵێتەوە."] },
      { h: "2. کێ بڕیار دەدات", p: ["کاتێک لە دوکانێک داواکاری دەکەیت، فرۆشیار بڕیار دەدات زانیاری داواکارییەکەت چۆن بەکاربهێنێت، و بازارگە ئەو زانیاریانە بۆ فرۆشیار بەڕێوە دەبات تا دوکانەکە کار بکات. بۆ هەژماری فرۆشیار، بازارگە بەرپرسە."] },
      { h: "3. چۆن بەکاری دەهێنین", p: ["بۆ بەڕێوەبردنی دوکانەکان و وەرگرتنی داواکاری، نیشاندانی دۆخی داواکاری بە کڕیار، ناردنی بەستەری گۆڕینی وشەی نهێنی بە ئیمەیل، ناردنی ئاگادارکردنەوەکانی خۆت چالاکت کردوون، نیشاندانی ئامارێکی سادە بە فرۆشیار، ڕێگرتن لە داواکاری ساختە و خراپ بەکارهێنان، و پشتگیری."] },
      { h: "4. کێ دەیبینێت", p: ["ئەو فرۆشیارەی لە دوکانەکەی داواکاری دەکەیت ناو و مۆبایل و ناونیشانت دەبینێت، چونکە بۆ گەیاندن پێویستی پێیانە. ئێمە دابینکەری متمانەپێکراو بۆ هۆستینگ و داتابەیس و هەڵگرتنی فایل بەکاردەهێنین. ئەگەر ئۆنلاین پارە بدەیت، دابینکەری پارەدان (وەک FIB یان ZainCash) ئەوەی پێویستیەتی بۆ وەرگرتنی پارەکە وەریدەگرێت. ئەگەر هەڵبژێریت داواکاری بە واتسئاپ بنێریت، واتسئاپ ئەو پەیامە بەڕێوە دەبات.", "هەرگیز زانیاری کەسی ناپارێزین بۆ فرۆشتن، و هیچ فرۆشیارێک کڕیارانی فرۆشیارێکی تر نابینێت. تەنها کاتێک یاسا داوا بکات زانیاری دەدەینە دەسەڵاتدارانی یاسایی."] },
      { h: "5. کووکی و ئامێرەکەت", p: ["کووکییەک بۆ چوونەژوورەوەی فرۆشیاران و کووکییەک بۆ بیرهێنانەوەی زمانەکەت بەکاردەهێنین. ئەگەر لە کاتی داواکاریدا هەڵبژێریت زانیارییەکانت هەڵبگیرێن، ناو و مۆبایل و نیشانەکەت تەنها لەسەر ئامێری خۆت دەمێننەوە. هیچ تراکەرێکی ڕیکلام بەکارناهێنین."] },
      { h: "6. لە کوێ هەڵدەگیرێت", p: ["داتا لەسەر سێرڤەری کلاود هەڵدەگیرێت کە لەوانەیە لە دەرەوەی عێراق بن. دابینکەرانێک هەڵدەبژێرین کە داتا بە کۆدکردن لە کاتی گواستنەوە و کۆنترۆڵی دەستگەیشتن دەپارێزن."] },
      { h: "7. تا کەی هەڵیدەگرین", p: ["داتای فرۆشیار تا کاتێک هەژمارەکە کراوە بێت هەڵدەگیرێت. داواکارییەکان هەڵدەگرین تا فرۆشیار تۆماری خۆی هەبێت. کاتێک داوامان لێ دەکەیت داتا بسڕینەوە، دەیسڕینەوە، مەگەر یاسا یان پشکنینی فێڵ پێویستی بکات کەمێک زیاتر بیهێڵینەوە."] },
      { h: "8. هەڵبژاردنەکانت", p: ["دەتوانیت داوا بکەیت داتاکەت ببینیت، ڕاستی بکەیتەوە یان بیسڕیتەوە. فرۆشیاران دەتوانن بەرهەم و ڕێکخستنەکانیان لە داشبۆرد دەستکاری بکەن یان بیسڕنەوە. کڕیاران دەتوانن لە فرۆشیار یان لە ئێمە داوا بکەن زانیاری داواکارییەکەیان بسڕدرێتەوە."] },
      { h: "9. پاراستن و منداڵان", p: ["جیاکردنەوەی دوکانەکان، وشەی نهێنی شێوێنراو و پەیوەندی کۆدکراو بەکاردەهێنین. هیچ سیستەمێک بە تەواوی پارێزراو نییە، بۆیە ئەگەر گومانت لە کێشەیەک هەبوو یەکسەر پێمان بڵێ. بازارگە بۆ منداڵی ژێر 16 ساڵ نییە."] },
      { h: "10. گۆڕانکاری و پەیوەندی", p: ["لەوانەیە ئەم سیاسەتە نوێ بکەینەوە و بەروار لە سەرەوە نیشان دەدەین. بۆ هەر داواکارییەکی نهێنیێتی، زانیاری پەیوەندی ئەم پەڕەیە بەکار بهێنە."] },
    ],
  },
  kmr: {
    title: "Siyaseta Nepenîtiyê",
    intro: "Ev rûpel diyar dike ku Bazarga çi agahî digire, çima, û tu dikarî ji me bixwazî ku em bi wê re çi bikin. Me bi mebest kurt kiriye.",
    sections: [
      { h: "1. Em çi berhev dikin", p: ["Ji firoşkaran: nav, e-name, şîfre (şêwandî tê parastin û tu carî nayê xwendin), jimara telefon an WhatsApp, agahiyên dikanê, hilber, wêne û sifarişên te.", "Ji kirrîyarên ku ji dikanekê sifariş dikin: nav, jimara telefonê, bajar, navnîşan û nîşana nêzîk, tiştên hatine xwestin û her not.", "Ji hemûyan: zimanê hilbijartî, cookieyek têketinê ji bo firoşkaran, û jimartina serdanên sade û agahiya cîhazê (wekî cureyê geroka webê) ku karûbarê çalak û ewle diparêze."] },
      { h: "2. Kî biryar dide", p: ["Dema ku tu ji dikanekê sifariş dikî, firoşkar biryar dide ku agahiyên sifarişa te çawa bi kar bîne, û Bazarga wan ji bo firoşkar birêve dibe da ku dikan bixebite. Ji bo hesabên firoşkaran, Bazarga berpirsiyar e."] },
      { h: "3. Em çawa bi kar tînin", p: ["Ji bo birêvebirina dikanan û girtina sifarişan, nîşandana rewşa sifarişê ji kirrîyar re, şandina girêdana guhertina şîfreyê bi e-nameyê, şandina agahdariyên ku te çalak kirine, nîşandana statîstîkên sade ji firoşkar re, rê girtina li sifarişên sexte û xerabî bikaranînê, û piştgirî."] },
      { h: "4. Kî dibîne", p: ["Firoşkarê ku tu ji dikana wî sifariş dikî nav, telefon û navnîşana te dibîne, ji ber ku ji bo gihandinê pêdivî pê heye. Em ji bo hosting, databas û tomarkirina pelan peydakarên pêbawer bi kar tînin. Eger tu online bidî, peydakarê dayînê (wekî FIB an ZainCash) tiştê ku ji bo girtina dayînê pêwîst e distîne. Eger tu hilbijêrî ku sifarişê bi WhatsApp bişînî, WhatsApp wê peyamê birêve dibe.", "Em tu carî daneyên kesane nafiroşin, û tu firoşkar kirrîyarên firoşkarekî din nabîne. Em tenê dema ku qanûn bixwaze daneyan bi rayedaran re parve dikin."] },
      { h: "5. Cookie û cîhazê te", p: ["Em cookieyek ji bo têketina firoşkaran û yekê ji bo bîranîna zimanê te bi kar tînin. Eger tu di dema sifarişê de hilbijêrî ku agahiyên te werin tomarkirin, nav, telefon û nîşana te tenê li ser cîhazê te dimînin. Em tu şopînerên reklamê bi kar naynin."] },
      { h: "6. Li ku tê tomarkirin", p: ["Dane li ser serverên cloud têne tomarkirin ku dibe li derveyî Iraqê bin. Em peydakaran hilbijêrin ku daneyan bi şîfrekirina di dema veguhastinê de û kontrola gihîştinê diparêzin."] },
      { h: "7. Em heta kengî digirin", p: ["Daneyên firoşkar heta ku hesab vekirî ye têne girtin. Em sifarişan digirin da ku firoşkar tomara xwe hebe. Dema ku tu ji me bixwazî daneyan jê bibin, em jê dibin, ji bilî ku qanûn an kontrola xapandinê pêdivî bike ku em hinekî dirêjtir bihêlin."] },
      { h: "8. Hilbijartinên te", p: ["Tu dikarî bixwazî daneyên xwe bibînî, rast bikî an jê bibî. Firoşkar dikarin hilber û mîhengên xwe di dashboardê de biguherînin an jê bibin. Kirrîyar dikarin ji firoşkar an ji me bixwazin ku agahiyên sifarişa wan werin jêbirin."] },
      { h: "9. Ewlehî û zarok", p: ["Em veqetandina dikanan, şîfreyên şêwandî û girêdanên şîfrekirî bi kar tînin. Tu pergal bi temamî ewle nîne, ji ber vê eger tu guman bikî ku pirsgirêkek heye tavilê ji me re bêje. Bazarga ne ji bo zarokên jêrî 16 salî ye."] },
      { h: "10. Guhertin û têkilî", p: ["Dibe ku em vê siyasetê nû bikin û em dîrokê li jor nîşan didin. Ji bo her daxwazeke nepenîtiyê, agahiyên têkiliyê yên vê rûpelê bi kar bîne."] },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    intro: "توضّح هذه الصفحة ما المعلومات التي يحتفظ بها بازارگە ولماذا، وما الذي يمكنك أن تطلب منا فعله بها. اختصرناها عمدًا.",
    sections: [
      { h: "1. ما الذي نجمعه", p: ["من البائعين: الاسم والبريد الإلكتروني وكلمة المرور (تُحفظ مشفّرة ولا يمكن قراءتها) ورقم الهاتف أو واتساب وبيانات المتجر والمنتجات والصور وطلباتك.", "من الزبائن الذين يطلبون من متجر: الاسم ورقم الهاتف والمدينة والعنوان وأقرب نقطة دالّة والمواد المطلوبة وأي ملاحظة.", "من الجميع: اللغة المختارة، وكوكي تسجيل الدخول للبائعين، وعدّاد زيارات بسيط ومعلومات الجهاز (مثل نوع المتصفح) لإبقاء الخدمة شغّالة وآمنة."] },
      { h: "2. من يقرّر", p: ["عندما تطلب من متجر، يقرّر البائع كيف يستخدم تفاصيل طلبك، ويعالجها بازارگە نيابةً عنه لتشغيل المتجر. أما حسابات البائعين فبازارگە هو المسؤول عنها."] },
      { h: "3. كيف نستخدمها", p: ["لتشغيل المتاجر واستقبال الطلبات، وعرض حالة الطلب للزبون، وإرسال روابط إعادة تعيين كلمة المرور بالبريد، وإرسال الإشعارات التي فعّلتها، وعرض إحصاءات بسيطة للبائع، ومنع الطلبات الوهمية وسوء الاستخدام، وتقديم الدعم."] },
      { h: "4. من يراها", p: ["البائع الذي تطلب من متجره يرى اسمك وهاتفك وعنوانك لأنه يحتاجها للتوصيل. نستخدم مزوّدين موثوقين للاستضافة وقاعدة البيانات وتخزين الملفات. وإن دفعت إلكترونيًا فمزوّد الدفع (مثل FIB أو زين كاش) يتلقى ما يلزمه لإتمام الدفعة. وإن اخترت إرسال الطلب عبر واتساب فواتساب هو الذي يعالج تلك الرسالة.", "لا نبيع البيانات الشخصية أبدًا، ولا يرى أي بائع زبائن بائع آخر. ولا نشارك البيانات مع السلطات إلا عندما يوجب القانون ذلك."] },
      { h: "5. ملفات الكوكيز وجهازك", p: ["نستخدم كوكي لتسجيل دخول البائعين وكوكي يتذكر لغتك. وإن اخترت حفظ بياناتك عند إتمام الطلب، فاسمك وهاتفك وأقرب نقطة دالّة تبقى على جهازك فقط. لا نستخدم أي متتبّعات إعلانية."] },
      { h: "6. أين تُخزَّن", p: ["تُخزَّن البيانات على خوادم سحابية قد تكون خارج العراق. نختار مزوّدين يحمون البيانات بالتشفير أثناء النقل وبضوابط الوصول."] },
      { h: "7. كم نحتفظ بها", p: ["نحتفظ ببيانات البائع ما دام الحساب مفتوحًا. ونحتفظ بالطلبات ليبقى للبائع سجلّه. وعندما تطلب منا حذف بياناتك نحذفها، إلا إذا احتاج القانون أو فحص الاحتيال أن نبقيها مدة أطول قليلًا."] },
      { h: "8. خياراتك", p: ["يمكنك أن تطلب الاطلاع على بياناتك أو تصحيحها أو حذفها. يستطيع البائعون تعديل منتجاتهم وإعداداتهم أو حذفها من لوحة التحكم. ويستطيع الزبائن أن يطلبوا من البائع أو منا حذف تفاصيل طلباتهم."] },
      { h: "9. الأمان والأطفال", p: ["نستخدم فصلًا بين المتاجر وكلمات مرور مشفّرة واتصالات مشفّرة. لا يوجد نظام آمن تمامًا، فأخبرنا فورًا إن شككت بوجود مشكلة. بازارگە غير موجّه للأطفال دون 16 عامًا."] },
      { h: "10. التغييرات والتواصل", p: ["قد نحدّث هذه السياسة وسنُظهر التاريخ في أعلاها. لأي طلب يخص الخصوصية استخدم بيانات التواصل في هذه الصفحة."] },
    ],
  },
};
