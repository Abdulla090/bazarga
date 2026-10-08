/**
 * End-to-end smoke test against a running build (no browser needed):
 *   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 * Exercises: health, landing, storefront, server-side cart quote, COD checkout, confirmation page +
 * WhatsApp deep link, order tracking (lookup, wrong phone/number, rate limit), seller signup → onboarding → dashboard order list, COD status change + packing slip, tenant isolation over HTTP.
 * Server action ids are read from the build manifest, so run it from the repo root after `npm run build`.
 */
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name)?.[0];
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

async function callAction(name, args, { cookie, path = "/" } = {}) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Next-Action": actionId(name),
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      Origin: BASE,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  return { res, text: await res.text() };
}

async function callFormAction(name, fields, { cookie, path = "/" } = {}) {
  // Mirrors React's encodeReply: FormData entries are prefixed "_<partId>_" and the root part "0" goes LAST
  // (the server decodes the stream in order).
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(`_1_${k}`, v);
  fd.append("0", JSON.stringify([{}, "$K1"]));
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Next-Action": actionId(name), Accept: "text/x-component", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    body: fd,
    redirect: "manual",
  });
  return { res, text: await res.text() };
}

const health = await (await fetch(`${BASE}/api/health`)).json();
ok(health.status === "ok", "health check ok");

const landing = await fetch(`${BASE}/`);
const landingHtml = await landing.text();
ok(landing.status === 200 && landingHtml.includes("بازارگە"), "landing renders (Kurdish default)");
ok(landingHtml.includes('dir="rtl"'), "landing is RTL by default");
ok(!!landing.headers.get("content-security-policy"), "security headers present");

const store = await fetch(`${BASE}/s/hawler-bazaar`);
const storeHtml = await store.text();
// Simple products carry an add-to-cart productId (used below); variant products only link to their page.
const ids = [...new Set([...storeHtml.matchAll(/productId\\?":\\?"([0-9a-f-]{36})/g)].map((m) => m[1]))];
const listed = new Set([...storeHtml.matchAll(/\/s\/hawler-bazaar\/p\/([0-9a-f-]{36})/g)].map((m) => m[1]));
ok(store.status === 200 && listed.size >= 4 && ids.length >= 3, `storefront lists the demo products (${listed.size}, ${ids.length} buyable from the grid)`);
ok(/srcSet="\/images\/seed\/hero-320\.webp 320w/.test(storeHtml), "store home cover ships a srcset from its renditions");
ok(
  /-480\.webp 480w/.test(storeHtml) && storeHtml.includes("calc(50vw - 22px)"),
  "product grid offers the 480 w thumbnail with a padding-aware sizes",
);

// Rich product page: every demo product has 3–5 photos, a details table, JSON-LD and an og:image.
let sale = null;
for (const id of listed) {
  const html = await (await fetch(`${BASE}/s/hawler-bazaar/p/${id}`, { headers: { Cookie: "mm_locale=en" } })).text();
  const photos = /data-testid="gallery-counter"[^>]*>1<!-- -->\/<!-- -->(\d)/.exec(html)?.[1] ?? /data-testid="gallery-counter"[^>]*>1\/(\d)/.exec(html)?.[1];
  const ld = /<script type="application\/ld\+json" nonce="[^"]+">([^<]+)<\/script>/.exec(html)?.[1];
  const data = ld ? JSON.parse(ld) : null;
  ok(Number(photos) >= 3 && Number(photos) <= 5, `product ${id.slice(0, 8)}: gallery has 3–5 photos (${photos})`);
  ok(html.includes('data-testid="specs-table"') && html.includes('data-testid="related"'), `product ${id.slice(0, 8)}: details table + related strip`);
  ok(data?.["@type"] === "Product" && data.offers?.priceCurrency === "IQD" && /og:image" content="http/.test(html), `product ${id.slice(0, 8)}: nonced Product JSON-LD (IQD) + og:image`);
  if (html.includes('data-testid="pct-off"')) sale = id;
}
ok(!!sale, "one demo product is on sale (compare-at price, % off badge)");

const quote = await callAction("quoteAction", ["hawler-bazaar", [{ productId: ids[0], quantity: 2 }], "baghdad", "en"], { path: "/s/hawler-bazaar/cart" });
const total = /"total":(\d+)/.exec(quote.text)?.[1];
ok(!!total, `server quote returns a total (${total})`);

const order = await callAction(
  "placeOrderAction",
  [
    "hawler-bazaar",
    {
      items: [{ productId: ids[1], quantity: 1, price: 1 }],
      customerName: "Shilan Smoke",
      phone: "0770 111 2233",
      cityKey: "erbil",
      address: "Shawes",
      landmark: "Near the Bazaar Mosque",
      areaOther: "Shawes",
      paymentMethod: "cod",
      locale: "ku",
    },
  ],
  { path: "/s/hawler-bazaar/cart" },
);
const redirectTo = /"redirectTo":"([^"]+)"/.exec(order.text)?.[1];
ok(!!redirectTo && redirectTo.includes("/s/hawler-bazaar/order/"), "COD checkout creates an order");
let orderNumber = null;
if (redirectTo) {
  const conf = await (await fetch(new URL(new URL(redirectTo).pathname, BASE))).text();
  ok(conf.includes("https://wa.me/9647501234567?text="), "confirmation page has a prefilled wa.me link to the seller");
  orderNumber = /\/s\/hawler-bazaar\/track\?n=(\d+)/.exec(conf)?.[1] ?? null;
  ok(!!orderNumber && conf.includes('data-testid="track-link"'), "confirmation page links to order tracking");
  ok(conf.includes(encodeURIComponent(`/s/hawler-bazaar/track?n=${orderNumber}`)), "WhatsApp summary carries the tracking link");
}

// Order tracking: the no-JS form post (multipart with $ACTION_ID_…) → 303 + httpOnly cookie → the page shows the order.
async function track(number, phone, ip) {
  const fd = new FormData();
  fd.append(`$ACTION_ID_${actionId("trackOrderAction")}`, "");
  fd.append("slug", "hawler-bazaar");
  fd.append("number", number);
  fd.append("phone", phone);
  const res = await fetch(`${BASE}/s/hawler-bazaar/track`, { method: "POST", headers: { Origin: BASE, "X-Forwarded-For": ip }, body: fd, redirect: "manual" });
  await res.text();
  return { status: res.status, location: res.headers.get("location") ?? "", cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] };
}
const trackPage = await fetch(`${BASE}/s/hawler-bazaar/track?n=${orderNumber ?? ""}`);
const trackHtml = await trackPage.text();
ok(trackPage.status === 200 && trackHtml.includes('data-testid="track-form"') && trackHtml.includes('dir="rtl"'), "tracking page renders the form (Kurdish, RTL)");
ok(/name="robots" content="noindex/.test(trackHtml), "tracking page is noindex");
const ipBase = `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}`;
if (orderNumber) {
  const hit = await track(orderNumber, "+964 770 111 2233", `${ipBase}.1`);
  ok(hit.status === 303 && hit.cookie.startsWith("mm_track=") && /\/s\/hawler-bazaar\/track$/.test(hit.location), "tracking lookup with number + normalised phone succeeds");
  const shown = await (await fetch(`${BASE}/s/hawler-bazaar/track`, { headers: { Cookie: `${hit.cookie}; mm_locale=en` } })).text();
  ok(shown.includes('data-testid="track-result"') && shown.includes('data-testid="track-timeline"') && shown.includes("Order received"), "tracking page shows the status timeline");
  ok(shown.includes("Shawes") && shown.includes('data-testid="track-whatsapp"') && shown.includes("https://wa.me/9647501234567?text="), "tracking page shows delivery area + WhatsApp to the store");
  const wrongPhone = await track(orderNumber, "0770 111 2299", `${ipBase}.2`);
  const wrongNumber = await track("999999", "0770 111 2233", `${ipBase}.3`);
  ok(wrongPhone.status === 303 && /e=nf/.test(wrongPhone.location) && !wrongPhone.cookie.startsWith("mm_track="), "wrong phone → generic not-found, no cookie");
  ok(/e=nf/.test(wrongNumber.location) && !wrongNumber.cookie.startsWith("mm_track="), "wrong number → the same generic not-found");
  const nf = await (await fetch(new URL(wrongPhone.location, BASE), { headers: { Cookie: "mm_locale=en" } })).text();
  ok(nf.includes('data-testid="track-error"') && !nf.includes('data-testid="track-result"'), "not-found message renders without order details");
  // Storefront routes stream (partial prerender), so notFound() arrives as the 404 boundary in a 200 response.
  const cross = await (await fetch(`${BASE}/s/smoke-nope-store/track`, { headers: { Cookie: hit.cookie } })).text();
  ok(cross.includes("NEXT_HTTP_ERROR_FALLBACK;404") && !cross.includes('data-testid="track-result"'), "unknown store slug renders not-found on the tracking page");
  let limited = null;
  for (let i = 0; i < 12 && !limited; i++) {
    const r = await track(String(900000 + i), "0770 111 2233", `${ipBase}.9`);
    if (/e=rl/.test(r.location)) limited = i;
  }
  ok(limited !== null, `tracking lookups are rate-limited per IP (after ${limited ?? "?"} tries)`);
}

ok(/"discountAmount":0/.test(quote.text) && /"freeDeliveryRemaining"/.test(quote.text), "quote carries discount + free-delivery fields");
const welcome = await callAction("quoteAction", ["hawler-bazaar", [{ productId: ids[0], quantity: 2 }], "erbil", "en", { discountCode: "WELCOME10" }], { path: "/s/hawler-bazaar/cart" });
ok(/"discountAmount":[1-9]\d*/.test(welcome.text) && /"discountCode":"WELCOME10","discountError":null/.test(welcome.text), "WELCOME10 takes 10% off a 30,000+ IQD cart");
// The sale item (honey, 25,000 IQD) alone is under the 30,000 IQD minimum.
const welcomeSmall = await callAction("quoteAction", ["hawler-bazaar", [{ productId: sale, quantity: 1 }], "erbil", "en", { discountCode: "WELCOME10" }], { path: "/s/hawler-bazaar/cart" });
ok(/"discountError":"discount_below_minimum"/.test(welcomeSmall.text), "WELCOME10 minimum (30,000 IQD) is enforced by the quote");
const badCode = await callAction("quoteAction", ["hawler-bazaar", [{ productId: ids[0], quantity: 1 }], "erbil", "en", { discountCode: "NO-SUCH-CODE" }], { path: "/s/hawler-bazaar/cart" });
ok(badCode.text.includes('"discountError":"discount_invalid"'), "unknown discount code is reported by the quote");
const badPhone = await callAction(
  "placeOrderAction",
  ["hawler-bazaar", { items: [{ productId: ids[1], quantity: 1 }], customerName: "Op Test", phone: "0760 111 2233", cityKey: "erbil", landmark: "x mosque", paymentMethod: "cod", locale: "ku" }],
  { path: "/s/hawler-bazaar/cart" },
);
ok(badPhone.text.includes("phone_operator"), "checkout rejects a non-Korek/Asiacell/Zain number");
const searched = await (await fetch(`${BASE}/s/hawler-bazaar?q=zzzz-no-match`, { headers: { Cookie: "mm_locale=en" } })).text();
ok(searched.includes("Nothing matches") && searched.includes('role="search"'), "storefront search renders the empty-search state");

const bad = await callAction("placeOrderAction", ["hawler-bazaar", { items: [], customerName: "x" }], { path: "/s/hawler-bazaar/cart" });
ok(bad.text.includes('"error":"VALIDATION"'), "invalid checkout is rejected by Zod");

const crossSite = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: { Origin: "https://evil.example" }, body: new FormData() });
ok(crossSite.status === 403, "cross-origin upload is blocked (CSRF)");

// Seller sign-up → session cookie → onboarding → dashboard
const email = `smoke-${Date.now()}@example.com`;
const signup = await callFormAction("signUpAction", { name: "Smoke Seller", email, password: "smoke-pass-123", locale: "ku" }, { path: "/signup" });
const cookie = (signup.res.headers.get("set-cookie") ?? "").split(";")[0];
ok(cookie.startsWith("mm_session="), "sign-up sets a session cookie");
const slug = `smoke-${Date.now().toString(36)}`;
const created = await callFormAction("createStoreAction", { name: "Smoke Shop", slug, defaultLocale: "en", whatsapp: "0750 999 8877", city: "erbil" }, { cookie, path: "/onboarding" });
ok(created.res.status === 303 || created.text.includes("/dashboard"), "store created and redirected to dashboard");
const dash = await fetch(`${BASE}/dashboard/orders`, { headers: { Cookie: cookie }, redirect: "manual" });
const dashHtml = await dash.text();
ok(dash.status === 200 && !dashHtml.includes("Shilan Smoke"), "new seller cannot see another store's orders");

// Dashboard → Share kit: bio link, QR (SVG/PNG) and the story image, all for the session's own store.
const sharePage = await (await fetch(`${BASE}/dashboard/share`, { headers: { Cookie: cookie } })).text();
ok(sharePage.includes(`/s/${slug}`) && sharePage.includes('data-testid="share-qr"') && sharePage.includes("https://wa.me/?text="), "share kit shows the store link, QR and WhatsApp share");
const qrSvgRes = await fetch(`${BASE}/api/share/qr?format=svg`, { headers: { Cookie: cookie } });
ok(qrSvgRes.status === 200 && (qrSvgRes.headers.get("content-type") ?? "").startsWith("image/svg+xml") && (await qrSvgRes.text()).includes("<path"), "QR code downloads as SVG");
const qrPngRes = await fetch(`${BASE}/api/share/qr?format=png&download=1`, { headers: { Cookie: cookie } });
ok(qrPngRes.status === 200 && qrPngRes.headers.get("content-type") === "image/png" && (qrPngRes.headers.get("content-disposition") ?? "").includes(`${slug}-qr.png`), "QR code downloads as PNG (attachment)");
const storyRes = await fetch(`${BASE}/api/share/story?lang=ku&download=1`, { headers: { Cookie: cookie } });
const story = Buffer.from(await storyRes.arrayBuffer());
ok(storyRes.status === 200 && story.readUInt32BE(16) === 1080 && story.readUInt32BE(20) === 1920, "story image is a 1080×1920 PNG");
const anonStory = await fetch(`${BASE}/api/share/story`);
ok(anonStory.status === 401, "story image needs a seller session");

const demoLogin = await callFormAction("logInAction", { email: "demo@mymarket.app", password: "mymarket-demo" }, { path: "/login" });
const demoCookie = (demoLogin.res.headers.get("set-cookie") ?? "").split(";")[0];
const demoDash = await (await fetch(`${BASE}/dashboard/orders`, { headers: { Cookie: demoCookie } })).text();
ok(demoDash.includes("Shilan Smoke"), "demo seller sees the new order in the dashboard");

// COD status flow: confirm → out for delivery with courier + tracking number; the packing slip is owner-only.
const smokeOrderId = /href="\/dashboard\/orders\/([0-9a-f-]{36})"[^>]*>(?:(?!<\/a>).)*Shilan Smoke/s.exec(demoDash)?.[1];
ok(!!smokeOrderId, "dashboard order list links to the new order");
if (smokeOrderId) {
  const orderPath = `/dashboard/orders/${smokeOrderId}`;
  const confirmed = await callAction("updateOrderStatusAction", [smokeOrderId, "confirmed", {}], { cookie: demoCookie, path: orderPath });
  const shipped = await callAction("updateOrderStatusAction", [smokeOrderId, "shipped", { courierName: "Smoke Express", trackingNumber: "SMK-123" }], { cookie: demoCookie, path: orderPath });
  ok(confirmed.text.includes('"ok":true') && shipped.text.includes('"ok":true'), "seller confirms and sends the order out with courier + tracking number");
  const detail = await (await fetch(`${BASE}${orderPath}`, { headers: { Cookie: `${demoCookie}; mm_locale=en` } })).text();
  ok(detail.includes('data-testid="order-courier"') && detail.includes("Smoke Express") && detail.includes("SMK-123"), "order detail shows the courier and tracking number");
  ok(detail.includes('data-testid="copy-tracking-link"') && detail.includes('data-testid="packing-slip-link"'), "order detail has copy-tracking-link and packing-slip buttons");
  const slip = await fetch(`${BASE}${orderPath}/slip`, { headers: { Cookie: demoCookie }, redirect: "manual" });
  const slipHtml = await slip.text();
  ok(slip.status === 200 && slipHtml.includes('data-testid="packing-slip"') && slipHtml.includes('dir="rtl"'), "packing slip renders for the owner (Kurdish, RTL)");
  ok(slipHtml.includes("Shilan Smoke") && slipHtml.includes("Near the Bazaar Mosque") && slipHtml.includes('data-testid="slip-cod"') && slipHtml.includes(`/s/hawler-bazaar/track?n=${orderNumber}`), "slip shows customer, landmark, COD amount and the tracking URL");
  ok(slipHtml.includes('data-testid="slip-qr"') && /<path[^>]+d="M\d/.test(slipHtml), "packing slip prints a QR code for the tracking link");
  const backwards = await callAction("updateOrderStatusAction", [smokeOrderId, "confirmed", {}], { cookie: demoCookie, path: orderPath });
  ok(backwards.text.includes("invalid_transition"), "server rejects an illegal status change (out for delivery → confirmed)");
  const anon = await fetch(`${BASE}${orderPath}/slip`, { redirect: "manual" });
  // With cacheComponents the dashboard shell can stream first, so the login redirect arrives either as a 3xx or
  // in-stream (NEXT_REDIRECT → /login, 200). Either way none of the order may be in the response.
  const anonHtml = await anon.text();
  const anonRedirect =
    (anon.status >= 300 && anon.status < 400 && (anon.headers.get("location") ?? "").includes("/login")) ||
    (anon.status === 200 && anonHtml.includes("NEXT_REDIRECT;replace;/login"));
  ok(anonRedirect && !anonHtml.includes("Shilan Smoke") && !anonHtml.includes('data-testid="packing-slip"'), "packing slip redirects to login when logged out (no order data)");
  const other = await fetch(`${BASE}${orderPath}/slip`, { headers: { Cookie: cookie }, redirect: "manual" });
  const otherHtml = await other.text();
  ok((other.status === 404 || otherHtml.includes("NEXT_HTTP_ERROR_FALLBACK;404")) && !otherHtml.includes("Shilan Smoke"), "another store's seller gets not-found for the slip");
}

// Seller uploads a photo (magic-byte check) and creates a product that shows up in the storefront.
const photo = new FormData();
photo.append("file", new Blob([readFileSync("public/images/product-honey.jpg")], { type: "image/jpeg" }), "honey.jpg");
const up = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: { Cookie: demoCookie, Origin: BASE }, body: photo });
const upJson = await up.json();
ok(up.status === 200 && typeof upJson.url === "string", "seller image upload accepted");
const fake = new FormData();
fake.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/jpeg" }), "x.jpg");
const fakeRes = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: { Cookie: demoCookie, Origin: BASE }, body: fake });
ok(fakeRes.status === 400, "SVG disguised as JPEG is rejected");
const productName = `Smoke item ${Date.now()}`;
await callFormAction(
  "saveProductAction",
  { "name.en": productName, "name.ku": "تاقیکردنەوە", price: "12000", stock: "3", isActive: "on", imageUrls: upJson.url },
  { cookie: demoCookie, path: "/dashboard/products/new" },
);
const look = await callFormAction("saveStorefrontAction", { coverImageUrl: upJson.url, coverImagePlaceholder: upJson.image?.placeholder ?? "", coverImageRenditions: JSON.stringify(upJson.image?.renditions ?? []), freeDeliveryThreshold: "250,000" }, { cookie: demoCookie, path: "/dashboard/settings" });
ok(look.text.includes('"ok":true'), "seller saves cover + free-delivery threshold");
const sf = await (await fetch(`${BASE}/s/hawler-bazaar`, { headers: { Cookie: "mm_locale=en" } })).text();
ok(sf.includes(productName) && sf.includes(upJson.url), "new product with photo appears in the storefront");
ok(sf.includes('fetchPriority="high"') || sf.includes('fetchpriority="high"'), "store home renders the cover hero");
ok(!(upJson.image?.renditions?.length > 1) || sf.includes(`${upJson.image.renditions[0].url} ${upJson.image.renditions[0].width}w`), "uploaded cover keeps its renditions (srcset)");

// Dashboard → Discounts: create a code (lower-case input is upper-cased), it lists for its store only.
const code = `SMK${Date.now().toString(36).toUpperCase().slice(-6)}`;
const disc = await callFormAction("saveDiscountAction", { code: code.toLowerCase(), type: "percentage", value: "15", minSubtotal: "", maxUses: "5", startsOn: "", endsOn: "", isActive: "on" }, { cookie: demoCookie, path: "/dashboard/discounts" });
ok(disc.text.includes('"ok":true'), "seller creates a discount code");
const badPct = await callFormAction("saveDiscountAction", { code: `${code}X`, type: "percentage", value: "95", isActive: "on" }, { cookie: demoCookie, path: "/dashboard/discounts" });
ok(badPct.text.includes("invalid_percent"), "a percent over 90 is rejected");
const discPage = await (await fetch(`${BASE}/dashboard/discounts`, { headers: { Cookie: demoCookie } })).text();
ok(discPage.includes(code), "discounts screen lists the new code");
const otherDisc = await (await fetch(`${BASE}/dashboard/discounts`, { headers: { Cookie: cookie } })).text();
ok(!otherDisc.includes(code), "another seller does not see the code");

// Dashboard → Delivery: add an area to a city with its own fee; checkout offers it.
const delPage = await (await fetch(`${BASE}/dashboard/delivery`, { headers: { Cookie: demoCookie } })).text();
const zoneId = /name="zoneId" value="([0-9a-f-]{36})"/.exec(delPage)?.[1];
const areaName = `Smoke area ${Date.now().toString(36)}`;
const area = zoneId ? await callFormAction("saveAreaAction", { zoneId, "name.en": areaName, fee: "1750" }, { cookie: demoCookie, path: "/dashboard/delivery" }) : { text: "" };
ok(area.text.includes('"ok":true'), "seller adds a delivery area");
const cartPage = await (await fetch(`${BASE}/s/hawler-bazaar/cart`, { headers: { Cookie: "mm_locale=en" } })).text();
ok(cartPage.includes(areaName), "checkout offers the new area (storefront cache invalidated)");

// Dashboard home → setup checklist for the brand-new seller, progress from real data.
const stepDone = (html, key) => new RegExp(`data-step="${key}" data-done="true"`).test(html);
let home = await (await fetch(`${BASE}/dashboard`, { headers: { Cookie: cookie } })).text();
ok(home.includes('data-testid="setup-checklist"') && stepDone(home, "whatsapp") && !stepDone(home, "product") && !stepDone(home, "share"), "new seller sees the setup checklist (WhatsApp done, product + share open)");
const shared = await callAction("markLinkSharedAction", [], { cookie, path: "/dashboard" });
const fees = await callFormAction("confirmDeliveryFeesAction", {}, { cookie, path: "/dashboard" });
home = await (await fetch(`${BASE}/dashboard`, { headers: { Cookie: cookie } })).text();
ok(shared.text.includes('"ok":true') && fees.res.status < 400 && stepDone(home, "share") && stepDone(home, "delivery"), "copying the link and 'fees look right' tick their steps");
const demoHome = await (await fetch(`${BASE}/dashboard`, { headers: { Cookie: demoCookie } })).text();
ok(!demoHome.includes('data-testid="setup-checklist"') || stepDone(demoHome, "product"), "the demo store's checklist reflects its own products");

console.log(failures ? `\n${failures} check(s) failed` : "\nall smoke checks passed");
process.exit(failures ? 1 : 0);
