/**
 * End-to-end smoke test against a running build (no browser needed):
 *   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 * Exercises: health, landing, storefront, server-side cart quote, COD checkout, confirmation page +
 * WhatsApp deep link, seller signup → onboarding → dashboard order list, tenant isolation over HTTP.
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
ok(landing.status === 200 && landingHtml.includes("فرۆشگاکەم"), "landing renders (Kurdish default)");
ok(landingHtml.includes('dir="rtl"'), "landing is RTL by default");
ok(!!landing.headers.get("content-security-policy"), "security headers present");

const store = await fetch(`${BASE}/s/hawler-bazaar`);
const storeHtml = await store.text();
const ids = [...new Set([...storeHtml.matchAll(/productId\\?":\\?"([0-9a-f-]{36})/g)].map((m) => m[1]))];
ok(store.status === 200 && ids.length >= 3, `storefront lists the demo products (${ids.length})`);

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
if (redirectTo) {
  const conf = await (await fetch(new URL(new URL(redirectTo).pathname, BASE))).text();
  ok(conf.includes("https://wa.me/9647501234567?text="), "confirmation page has a prefilled wa.me link to the seller");
}

ok(/"discountAmount":0/.test(quote.text) && /"freeDeliveryRemaining"/.test(quote.text), "quote carries discount + free-delivery fields");
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

const demoLogin = await callFormAction("logInAction", { email: "demo@mymarket.app", password: "mymarket-demo" }, { path: "/login" });
const demoCookie = (demoLogin.res.headers.get("set-cookie") ?? "").split(";")[0];
const demoDash = await (await fetch(`${BASE}/dashboard/orders`, { headers: { Cookie: demoCookie } })).text();
ok(demoDash.includes("Shilan Smoke"), "demo seller sees the new order in the dashboard");

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
const look = await callFormAction("saveStorefrontAction", { coverImageUrl: upJson.url, coverImagePlaceholder: upJson.image?.placeholder ?? "", freeDeliveryThreshold: "250,000" }, { cookie: demoCookie, path: "/dashboard/settings" });
ok(!look.text.includes('"error"'), "seller saves cover + free-delivery threshold");
const sf = await (await fetch(`${BASE}/s/hawler-bazaar`, { headers: { Cookie: "mm_locale=en" } })).text();
ok(sf.includes(productName) && sf.includes(upJson.url), "new product with photo appears in the storefront");
ok(sf.includes('fetchPriority="high"') || sf.includes('fetchpriority="high"'), "store home renders the cover hero");

console.log(failures ? `\n${failures} check(s) failed` : "\nall smoke checks passed");
process.exit(failures ? 1 : 0);
