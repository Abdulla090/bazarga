import type { LegalByLocale } from "./types";

/**
 * Refund and Cancellation Policy. Same 8 sections in every language, in the same order.
 * The refund windows (7 days monthly, 14 days yearly) are a proposed default for Abdulla to confirm.
 */
export const REFUNDS: LegalByLocale = {
  en: {
    title: "Refund and Cancellation Policy",
    intro: "This page has two parts: your Bazarga plan, and orders you place with a store.",
    sections: [
      { h: "1. Cancel your plan anytime", p: ["There is no contract. You pay for a period (a month or a year) and can simply not renew. Your plan stays on until the end of the period you paid for, then your store moves to the Free plan."] },
      { h: "2. Refunds for Bazarga plans", p: ["Monthly plan: ask within 7 days of paying and we refund you in full. Yearly plan: ask within 14 days. After that we do not refund the period you already paid for, and you keep using it until it ends.", "If your payment arrived but your plan was not turned on within 1 day, we turn it on or refund you, your choice."] },
      { h: "3. How refunds are paid", p: ["We send the refund the same way you paid (FIB, ZainCash or cash) within 7 working days of approving it."] },
      { h: "4. Orders are with the seller", p: ["When you order from a store, your purchase is with that seller, not with Bazarga. The seller sets the price, delivery and return rules for their goods and should state them on their store."] },
      { h: "5. Cancelling an order", p: ["To cancel an order, message the seller on the WhatsApp number shown on your order page as soon as you can. Sellers can usually cancel until the order is out for delivery."] },
      { h: "6. Cash on delivery", p: ["With cash on delivery you pay only when the order arrives, so you can check it first. If you refuse an order that was correct and on time, the seller may mark your phone number, and repeated refusals can stop future cash on delivery orders."] },
      { h: "7. Wrong, damaged or missing goods", p: ["Tell the seller straight away, with a photo if you can. The seller decides on a replacement or refund. For orders paid online, the seller refunds you the same way you paid."] },
      { h: "8. Need help?", p: ["If a seller doesn't answer, tell us and we will try to help. Use the contact details on this page."] },
    ],
  },
  ku: {
    title: "سیاسەتی گەڕاندنەوەی پارە و هەڵوەشاندنەوە",
    intro: "ئەم پەڕەیە دوو بەشی هەیە: پلانەکەت لە بازارگە، و ئەو داواکارییانەی لە دوکانێک دەیکەیت.",
    sections: [
      { h: "1. هەر کاتێک پلانەکەت هەڵبوەشێنەرەوە", p: ["هیچ گرێبەستێک نییە. بۆ ماوەیەک (مانگێک یان ساڵێک) پارە دەدەیت و دەتوانیت نوێی نەکەیتەوە. پلانەکەت تا کۆتایی ئەو ماوەیەی پارەت داوە دەمێنێتەوە، پاشان دوکانەکەت دەگەڕێتەوە بۆ پلانی بێبەرامبەر."] },
      { h: "2. گەڕاندنەوەی پارەی پلانەکانی بازارگە", p: ["پلانی مانگانە: لە ماوەی 7 ڕۆژ دوای پارەدان داوا بکە و پارەکەت بە تەواوی دەگەڕێنینەوە. پلانی ساڵانە: لە ماوەی 14 ڕۆژدا. دوای ئەوە ئەو ماوەیەی پارەت داوە ناگەڕێنرێتەوە و هەتا کۆتایی پێدێت بەکاری دەهێنیت.", "ئەگەر پارەکەت گەیشت بەڵام پلانەکەت لە ماوەی 1 ڕۆژدا چالاک نەکرا، یان چالاکی دەکەین یان پارەکەت دەگەڕێنینەوە، هەرکامیان تۆ بتەوێت."] },
      { h: "3. پارە چۆن دەگەڕێتەوە", p: ["دوای پەسەندکردنی گەڕاندنەوە، لە ماوەی 7 ڕۆژی کار بە هەمان شێوازی پارەدانەکەت (FIB، ZainCash یان کاش) پارەکەت دەنێرینەوە."] },
      { h: "4. داواکاری لای فرۆشیارە", p: ["کاتێک لە دوکانێک داواکاری دەکەیت، کڕینەکەت لەگەڵ ئەو فرۆشیارەیە نەک بازارگە. فرۆشیار نرخ، گەیاندن و یاسای گەڕاندنەوەی کاڵاکانی خۆی دیاری دەکات و پێویستە لە دوکانەکەیدا ڕوونی بکاتەوە."] },
      { h: "5. هەڵوەشاندنەوەی داواکاری", p: ["بۆ هەڵوەشاندنەوەی داواکاری، لە زووترین کاتدا بە واتسئاپ پەیام بنێرە بۆ ئەو ژمارەیەی لە پەڕەی داواکارییەکەتدا نیشان دراوە. فرۆشیار زۆرجار دەتوانێت هەتا داواکارییەکە بۆ گەیاندن دەرنەچووە هەڵیبوەشێنێتەوە."] },
      { h: "6. پارە لە کاتی گەیاندن", p: ["لە پارەدان لە کاتی گەیاندندا، تەنها کاتێک پارە دەدەیت کە داواکارییەکە دەگات، بۆیە سەرەتا دەتوانیت بیپشکنیت. ئەگەر داواکارییەکی دروست و لە کاتی خۆیدا ڕەت بکەیتەوە، لەوانەیە فرۆشیار ژمارەکەت نیشان بکات، و ڕەتکردنەوەی دووبارە دەتوانێت داواکاری پارە لە کاتی گەیاندنی داهاتوو بوەستێنێت."] },
      { h: "7. کاڵای هەڵە، زیانلێکەوتوو یان نەگەیشتوو", p: ["یەکسەر بە فرۆشیار بڵێ، ئەگەر بتوانیت لەگەڵ وێنەیەک. فرۆشیار بڕیار دەدات لەسەر گۆڕینەوە یان گەڕاندنەوەی پارە. بۆ ئەو داواکارییانەی ئۆنلاین پارە دراون، فرۆشیار بە هەمان شێوازی پارەدانەکەت پارەکەت دەگەڕێنێتەوە."] },
      { h: "8. یارمەتیت دەوێت؟", p: ["ئەگەر فرۆشیار وەڵامی نەدایتەوە، پێمان بڵێ و هەوڵ دەدەین یارمەتیت بدەین. زانیاری پەیوەندی ئەم پەڕەیە بەکار بهێنە."] },
    ],
  },
  kmr: {
    title: "Siyaseta Vegerandina Peran û Betalkirinê",
    intro: "Ev rûpel du beş e: plana te ya Bazargayê, û sifarişên ku tu ji dikanekê dikî.",
    sections: [
      { h: "1. Planê xwe her dem betal bike", p: ["Tu peymanek tune. Tu ji bo heyamekê (mehek an salek) didî û dikarî nû nekî. Plana te heta dawiya heyama ku te dayî dimîne, paşê dikana te vedigere plana belaş."] },
      { h: "2. Vegerandina peran a planên Bazargayê", p: ["Plana mehane: di nav 7 rojan de piştî dayînê bixwaze û em pereyê te bi temamî vedigerînin. Plana salane: di nav 14 rojan de. Piştî wê heyama ku te dayî nayê vegerandin û tu heta ku biqede bi kar tînî.", "Eger dayîna te gihîşt lê plana te di nav 1 rojê de nehat çalakirin, em an çalak dikin an pereyê te vedigerînin, kîjan tu bixwazî."] },
      { h: "3. Pere çawa vedigerin", p: ["Piştî erêkirina vegerandinê, di nav 7 rojên xebatê de em pereyê te bi heman awayê dayîna te (FIB, ZainCash an kaş) vedişînin."] },
      { h: "4. Sifariş bi firoşkar re ne", p: ["Dema ku tu ji dikanekê sifariş dikî, kirîna te bi wî firoşkarî re ye, ne bi Bazargayê re. Firoşkar biha, gihandin û rêgezên vegerandinê yên kelûpelên xwe diyar dike û divê wan di dikana xwe de bibêje."] },
      { h: "5. Betalkirina sifarişê", p: ["Ji bo betalkirina sifarişê, di zûtirîn dem de bi WhatsApp peyamê bişîne jimara ku di rûpela sifarişa te de tê nîşandan. Firoşkar bi gelemperî heta ku sifariş ji bo gihandinê derneketiye dikare betal bike."] },
      { h: "6. Dayîn di gihandinê de", p: ["Di dayîna li dema gihandinê de, tu tenê dema ku sifariş digihîje didî, ji ber vê tu dikarî pêşî kontrol bikî. Eger sifarişeke rast û di wextê xwe de red bikî, dibe ku firoşkar jimara te nîşan bike, û redkirinên dubare dikarin sifarişên dayîn di gihandinê de yên pêşerojê rawestînin."] },
      { h: "7. Kelûpelên şaş, zirardayî an negihîştî", p: ["Tavilê ji firoşkar re bêje, eger bikaribî bi wêneyekî re. Firoşkar li ser guhertin an vegerandina peran biryar dide. Ji bo sifarişên ku online hatine dayîn, firoşkar bi heman awayê dayîna te pereyê te vedigerîne."] },
      { h: "8. Alîkarî lazim e?", p: ["Eger firoşkar bersiv neda, ji me re bêje û em ê hewl bidin alîkariya te bikin. Agahiyên têkiliyê yên vê rûpelê bi kar bîne."] },
    ],
  },
  ar: {
    title: "سياسة الاسترداد والإلغاء",
    intro: "لهذه الصفحة جزءان: خطتك في بازارگە، والطلبات التي تقدّمها إلى متجر.",
    sections: [
      { h: "1. ألغِ خطتك في أي وقت", p: ["لا يوجد عقد. تدفع عن مدة (شهر أو سنة) ويمكنك ببساطة ألّا تجدّد. تبقى خطتك مفعّلة حتى نهاية المدة التي دفعتها، ثم يعود متجرك إلى الخطة المجانية."] },
      { h: "2. استرداد خطط بازارگە", p: ["الخطة الشهرية: اطلب خلال 7 أيام من الدفع ونعيد لك المبلغ كاملًا. الخطة السنوية: خلال 14 يومًا. بعد ذلك لا نعيد المبلغ عن المدة التي دفعتها وتستمر في استخدامها حتى تنتهي.", "إذا وصلت دفعتك ولم تُفعَّل خطتك خلال يوم واحد، نفعّلها أو نعيد لك المبلغ، حسب اختيارك."] },
      { h: "3. كيف يُدفع الاسترداد", p: ["نرسل الاسترداد بالطريقة نفسها التي دفعت بها (FIB أو زين كاش أو نقدًا) خلال 7 أيام عمل من الموافقة عليه."] },
      { h: "4. الطلبات مع البائع", p: ["عندما تطلب من متجر فشراؤك هو مع ذلك البائع وليس مع بازارگە. البائع يحدد السعر والتوصيل وقواعد الإرجاع لبضاعته، وعليه أن يذكرها في متجره."] },
      { h: "5. إلغاء الطلب", p: ["لإلغاء طلب، راسل البائع على واتساب على الرقم الظاهر في صفحة طلبك بأسرع وقت. يستطيع البائع عادةً الإلغاء ما دام الطلب لم يخرج للتوصيل."] },
      { h: "6. الدفع عند الاستلام", p: ["في الدفع عند الاستلام تدفع فقط عندما يصل الطلب، فيمكنك فحصه أولًا. وإن رفضت طلبًا صحيحًا ووصل في وقته، فقد يضع البائع علامة على رقم هاتفك، وتكرار الرفض قد يوقف طلبات الدفع عند الاستلام مستقبلًا."] },
      { h: "7. بضاعة خاطئة أو تالفة أو ناقصة", p: ["أخبر البائع فورًا، ومعك صورة إن أمكن. البائع يقرّر الاستبدال أو الاسترداد. وللطلبات المدفوعة إلكترونيًا يعيد لك البائع المبلغ بالطريقة نفسها التي دفعت بها."] },
      { h: "8. تحتاج مساعدة؟", p: ["إذا لم يردّ البائع فأخبرنا وسنحاول مساعدتك. استخدم بيانات التواصل في هذه الصفحة."] },
    ],
  },
};
