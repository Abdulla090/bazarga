import type { LegalByLocale } from "./types";

/**
 * Refund and Cancellation Policy. Same 8 sections in every language, in the same order.
 * Abdulla's rule (2026-10-13): NO refunds on plan payments; cancel anytime, plan stays until the paid period ends.
 */
export const REFUNDS: LegalByLocale = {
  en: {
    title: "Refund and Cancellation Policy",
    intro: "This page has two parts: your Bazarga plan, and orders you place with a store.",
    sections: [
      { h: "1. Cancel your plan anytime", p: ["There is no contract. You pay for a period (a month or a year) and can simply not renew. Your plan stays on until the end of the period you paid for, then your store moves to the Free plan."] },
      { h: "2. No refunds for Bazarga plans", p: ["Payments for Bazarga plans are final and we do not refund them. You can cancel anytime and your plan stays on until the end of the period you paid for.", "If your payment arrived but your plan was not turned on within 1 day, contact us and we will turn it on."] },
      { h: "3. How refunds are paid", p: ["Bazarga does not refund plan payments. Refunds for goods are decided and paid by the seller, the same way you paid."] },
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
      { h: "2. پارەی پلانەکانی بازارگە ناگەڕێنرێتەوە", p: ["پارەدان بۆ پلانەکانی بازارگە کۆتاییە و ناگەڕێنرێتەوە. دەتوانیت هەر کاتێک هەڵیبوەشێنیتەوە و پلانەکەت تا کۆتایی ئەو ماوەیەی پارەت داوە دەمێنێتەوە.", "ئەگەر پارەکەت گەیشت بەڵام پلانەکەت لە ماوەی 1 ڕۆژدا چالاک نەکرا، پەیوەندیمان پێوە بکە و چالاکی دەکەین."] },
      { h: "3. پارە چۆن دەگەڕێتەوە", p: ["بازارگە پارەی پلانەکان ناگەڕێنێتەوە. گەڕاندنەوەی پارەی کاڵا فرۆشیار بڕیاری لەسەر دەدات و بە هەمان شێوازی پارەدانەکەت دەیدات."] },
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
      { h: "2. Pereyê planên Bazargayê nayê vegerandin", p: ["Dayîna planên Bazargayê dawî ye û nayê vegerandin. Tu dikarî her dem betal bikî û plana te heta dawiya heyama ku te dayî dimîne.", "Eger dayîna te gihîşt lê plana te di nav 1 rojê de nehat çalakirin, bi me re têkilî çêke û em çalak dikin."] },
      { h: "3. Pere çawa vedigerin", p: ["Bazarga pereyê planan venagerîne. Vegerandina pereyê kelûpelan firoşkar biryar dide û bi heman awayê dayîna te dide."] },
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
      { h: "2. لا استرداد لخطط بازارگە", p: ["مدفوعات خطط بازارگە نهائية ولا يمكن استردادها. يمكنك الإلغاء في أي وقت وتبقى خطتك مفعّلة حتى نهاية المدة التي دفعتها.", "إذا وصلت دفعتك ولم تُفعَّل خطتك خلال يوم واحد، تواصل معنا وسنفعّلها."] },
      { h: "3. كيف يُدفع الاسترداد", p: ["لا تعيد بازارگە مدفوعات الخطط. استرداد ثمن البضاعة يقرره البائع ويدفعه بالطريقة نفسها التي دفعت بها."] },
      { h: "4. الطلبات مع البائع", p: ["عندما تطلب من متجر فشراؤك هو مع ذلك البائع وليس مع بازارگە. البائع يحدد السعر والتوصيل وقواعد الإرجاع لبضاعته، وعليه أن يذكرها في متجره."] },
      { h: "5. إلغاء الطلب", p: ["لإلغاء طلب، راسل البائع على واتساب على الرقم الظاهر في صفحة طلبك بأسرع وقت. يستطيع البائع عادةً الإلغاء ما دام الطلب لم يخرج للتوصيل."] },
      { h: "6. الدفع عند الاستلام", p: ["في الدفع عند الاستلام تدفع فقط عندما يصل الطلب، فيمكنك فحصه أولًا. وإن رفضت طلبًا صحيحًا ووصل في وقته، فقد يضع البائع علامة على رقم هاتفك، وتكرار الرفض قد يوقف طلبات الدفع عند الاستلام مستقبلًا."] },
      { h: "7. بضاعة خاطئة أو تالفة أو ناقصة", p: ["أخبر البائع فورًا، ومعك صورة إن أمكن. البائع يقرّر الاستبدال أو الاسترداد. وللطلبات المدفوعة إلكترونيًا يعيد لك البائع المبلغ بالطريقة نفسها التي دفعت بها."] },
      { h: "8. تحتاج مساعدة؟", p: ["إذا لم يردّ البائع فأخبرنا وسنحاول مساعدتك. استخدم بيانات التواصل في هذه الصفحة."] },
    ],
  },
};
