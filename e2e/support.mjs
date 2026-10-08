/**
 * Shared setup for the mobile checks (screenshot audit + Playwright overflow test), against a running build with
 * the demo seed: places one COD order and logs the demo seller in through the real server actions (ids from the
 * build manifest, like scripts/smoke.mjs), and returns the routes to visit.
 */
import { readFileSync } from "node:fs";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const SLUG = process.env.STORE_SLUG ?? "hawler-bazaar";
export const CHROMIUM = process.env.CHROMIUM_PATH || undefined;

function actionId(name) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  return Object.entries(manifest).find(([, v]) => v.exportedName === name)?.[0];
}

async function callAction(name, args, path) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  return res.text();
}

async function login(email, password) {
  const fd = new FormData();
  fd.append("_1_email", email);
  fd.append("_1_password", password);
  fd.append("0", JSON.stringify([{}, "$K1"]));
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Next-Action": actionId("logInAction"), Accept: "text/x-component", Origin: BASE },
    body: fd,
    redirect: "manual",
  });
  const c = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const [name, ...rest] = c.split("=");
  return { name, value: rest.join("=") };
}

/** Signs a brand-new seller up through the real signup action; the session lands on /onboarding (no store yet). */
async function signUpFresh() {
  const fd = new FormData();
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  fd.append("_1_name", "فرۆشیار تاقیکردنەوە");
  fd.append("_1_email", `mobile-${tag}@example.com`);
  fd.append("_1_password", "mobile-check-pass-123");
  fd.append("_1_locale", "ku");
  fd.append("0", JSON.stringify([{}, "$K1"]));
  const res = await fetch(`${BASE}/signup`, {
    method: "POST",
    // Own client IP so the per-IP signup limit never collides with the smoke run.
    headers: { "Next-Action": actionId("signUpAction"), Accept: "text/x-component", Origin: BASE, "X-Forwarded-For": `10.77.${tag.length % 250}.${Math.floor(Math.random() * 250)}` },
    body: fd,
    redirect: "manual",
  });
  const c = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const [name, ...rest] = c.split("=");
  if (!name || !rest.length) throw new Error(`signup did not start a session (status ${res.status})`);
  return { name, value: rest.join("=") };
}

export async function setup() {
  const html = await (await fetch(`${BASE}/s/${SLUG}`)).text();
  const buyable = [...new Set([...html.matchAll(/productId\\?":\\?"([0-9a-f-]{36})/g)].map((m) => m[1]))];
  const listed = [...new Set([...html.matchAll(new RegExp(`/s/${SLUG}/p/([0-9a-f-]{36})`, "g"))].map((m) => m[1]))];
  if (!buyable.length || !listed.length) throw new Error(`no products on /s/${SLUG} — is the demo seeded?`);
  const placed = await callAction(
    "placeOrderAction",
    [SLUG, { items: [{ productId: buyable[0], quantity: 2 }], customerName: "شیلان ئەحمەد", phone: "0750 111 2233", cityKey: "erbil", landmark: "نزیک مزگەوتی ناو بازاڕ", areaOther: "شاوێس", paymentMethod: "cod", locale: "ku" }],
    `/s/${SLUG}/cart`,
  );
  const orderPath = new URL(/"redirectTo":"([^"]+)"/.exec(placed)?.[1] ?? `${BASE}/`).pathname;
  // Look the order up on the tracking page the way a shopper's browser does without JS (multipart form post).
  const confHtml = await (await fetch(BASE + orderPath)).text();
  const orderNumber = new RegExp(`/s/${SLUG}/track\\?n=(\\d+)`).exec(confHtml)?.[1] ?? "";
  const fd = new FormData();
  fd.append(`$ACTION_ID_${actionId("trackOrderAction")}`, "");
  fd.append("slug", SLUG);
  fd.append("number", orderNumber);
  fd.append("phone", "0750 111 2233");
  const tracked = await fetch(`${BASE}/s/${SLUG}/track`, { method: "POST", headers: { Origin: BASE }, body: fd, redirect: "manual" });
  const [trackName, ...trackRest] = (tracked.headers.get("set-cookie") ?? "").split(";")[0].split("=");
  const trackCookie = trackName === "mm_track" ? { name: trackName, value: trackRest.join("=") } : null;
  const freshSeller = await signUpFresh();
  const session = await login(process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app", process.env.SEED_DEMO_PASSWORD ?? "mymarket-demo");
  const dashProducts = await (await fetch(`${BASE}/dashboard/products`, { headers: { Cookie: `${session.name}=${session.value}` } })).text();
  const editId = /\/dashboard\/products\/([0-9a-f-]{36})/.exec(dashProducts)?.[1];
  const ordersHtml = await (await fetch(`${BASE}/dashboard/orders`, { headers: { Cookie: `${session.name}=${session.value}` } })).text();
  const orderId = /\/dashboard\/orders\/([0-9a-f-]{36})/.exec(ordersHtml)?.[1];

  const cart = JSON.stringify([{ productId: buyable[0], variantId: null, quantity: 2 }]);
  return {
    session,
    freshSeller,
    cart: { key: `mm_cart_${SLUG}`, value: cart },
    routes: [
      { name: "storefront-home", path: `/s/${SLUG}` },
      // The richest demo page: the variant product (not buyable straight from the grid) — 5 photos, sizes, specs.
      { name: "product", path: `/s/${SLUG}/p/${listed.find((id) => !buyable.includes(id)) ?? listed[0]}` },
      { name: "checkout", path: `/s/${SLUG}/cart`, cart: true },
      { name: "order-confirmation", path: orderPath },
      { name: "track-order", path: `/s/${SLUG}/track`, anon: true },
      ...(trackCookie ? [{ name: "track-result", path: `/s/${SLUG}/track`, anon: true, cookies: [trackCookie] }] : []),
      { name: "login", path: "/login", anon: true },
      { name: "signup", path: "/signup", anon: true },
      { name: "forgot-password", path: "/forgot-password", anon: true },
      { name: "reset-password", path: "/reset-password?token=mobile-overflow-check-not-a-real-token", anon: true },
      // A fresh seller with no store yet: the store-setup form, whose link field carries the APP_URL host.
      { name: "onboarding", path: "/onboarding", fresh: true },
      { name: "dashboard-home", path: "/dashboard", auth: true },
      { name: "dashboard-products", path: "/dashboard/products", auth: true },
      { name: "dashboard-product-editor", path: editId ? `/dashboard/products/${editId}` : "/dashboard/products/new", auth: true },
      { name: "dashboard-orders", path: "/dashboard/orders", auth: true },
      { name: "dashboard-order-detail", path: orderId ? `/dashboard/orders/${orderId}` : "/dashboard/orders", auth: true },
      { name: "dashboard-settings", path: "/dashboard/settings", auth: true },
      // Collapsed sections (new-code / edit forms, per-city area forms) are opened before measuring.
      { name: "dashboard-discounts", path: "/dashboard/discounts", auth: true, openDetails: true },
      { name: "dashboard-delivery", path: "/dashboard/delivery", auth: true, openDetails: true },
      { name: "dashboard-more", path: "/dashboard/more", auth: true },
      { name: "dashboard-share", path: "/dashboard/share", auth: true },
      { name: "dashboard-payments", path: "/dashboard/payments", auth: true, openDetails: true },
      { name: "dashboard-analytics", path: "/dashboard/analytics?range=30", auth: true, openDetails: true },
      { name: "dashboard-customers", path: "/dashboard/customers", auth: true },
    ],
  };
}

/** Runs in the page: overflow, offenders, small tap targets, sub-16px inputs. */
export function auditInPage(expectedWidth) {
  // On a mobile viewport an over-wide page widens the layout viewport itself (innerWidth grows with the content),
  // so measure against the device width we asked for.
  const vw = Math.min(window.innerWidth, expectedWidth || window.innerWidth);
  const se = document.scrollingElement;
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    const txt = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    // > 1 px: visually-hidden (sr-only) inputs behind a styled label are not tap targets themselves.
    return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none";
  };
  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      // Skip descendants of horizontally scrollable containers (carousels, chip rows): they scroll by design.
      let p = el.parentElement;
      let inScroller = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") { inScroller = true; break; }
        p = p.parentElement;
      }
      if (!inScroller) offenders.push(`${describe(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
  }
  const smallTargets = [];
  for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary, label:has(input[type=checkbox]), label:has(input[type=radio])")) {
    if (!visible(el)) continue;
    if (el.closest("p, li > span") && el.tagName === "A" && getComputedStyle(el).display === "inline") continue; // inline text links are exempt (WCAG 2.5.8)
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")?.getBoundingClientRect().height >= 44) continue; // the label is the target
    const r = el.getBoundingClientRect();
    if (r.height < 44 || r.width < 24) smallTargets.push(`${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const smallInputs = [];
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")) {
    if (!visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) smallInputs.push(`${describe(el)} ${fs}px`);
  }
  return {
    scrollWidth: se.scrollWidth,
    innerWidth: window.innerWidth,
    overflow: se.scrollWidth > vw || window.innerWidth > vw,
    offenders: offenders.slice(0, 15),
    smallTargets: smallTargets.slice(0, 25),
    smallTargetCount: smallTargets.length,
    smallInputs,
  };
}
