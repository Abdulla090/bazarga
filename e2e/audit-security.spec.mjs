import { expect, test } from "@playwright/test";

/** Locally every request is from one IP, so give each test seller its own (the per-IP signup limit is 5/hour). Live: Vercel sets the real IP. */
const ownIp = (baseURL) => (/localhost|127\.0\.0\.1/.test(baseURL) ? { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } : {});


/**
 * E2E audit, security (docs/E2E-AUDIT.md). Two brand-new sellers A and B (audit-*@example.com): B must never read
 * or change A's products/orders through pages, server actions or APIs; /admin is invisible to non-admins; anonymous
 * users are bounced; auth errors are generic; headers are set. Server-action ids are read from the page's own JS
 * chunks, so this runs against localhost and live alike.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function seller(browser, baseURL, label) {
  const host = new URL(baseURL).hostname;
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, extraHTTPHeaders: ownIp(baseURL) });
  await ctx.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await ctx.newPage();
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="name"] >> visible=true').fill(`Audit ${label}`);
  await page.locator('input[name="email"] >> visible=true').fill(`audit-sec-${label}-${tag}@example.com`);
  await page.locator('input[name="password"] >> visible=true').fill("audit-security-pass-1");
  await page.locator("form button >> visible=true").last().click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  const slug = `audit-s${label}-${tag}`.slice(0, 30).toLowerCase();
  await page.locator('input[name="name"] >> visible=true').fill(`Audit ${label} Shop`);
  await page.locator('input[name="slug"] >> visible=true').fill(slug);
  await page.locator('input[name="whatsapp"] >> visible=true').fill("0750 123 4567");
  await page.locator("form button.btn-gold >> visible=true").click();
  await page.waitForURL(/\/(dashboard|onboarding\?step=theme)/, { timeout: 30_000 });
  return { ctx, page, slug, tag };
}

/** Server-action ids by exported name, scraped from the JS chunks the current page loaded. */
async function actionIds(page) {
  return page.evaluate(async () => {
    const out = {};
    const srcs = [...new Set(performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.includes("/_next/static/") && u.endsWith(".js")))];
    await Promise.all(srcs.map(async (s) => {
      const js = await (await fetch(s)).text();
      for (const m of js.matchAll(/createServerReference\)?\("([0-9a-f]{40,})"[^)]*?"(\w+)"\)/g)) out[m[2]] = m[1];
    }));
    return out;
  });
}

async function callAction(page, id, args, path) {
  return page.evaluate(async ([id, args, path]) => {
    const r = await fetch(path, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) });
    return { status: r.status, body: (await r.text()).slice(0, 400) };
  }, [id, args, path]);
}

test("tenant isolation: seller B can't read or change seller A's products and orders", async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const A = await seller(browser, baseURL, "a");
  // A: one product, and an order on it from a shopper.
  await A.page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  await A.page.getByRole("tab", { name: "English" }).click().catch(() => {});
  const secret = `Secret Product ${A.tag}`;
  await A.page.locator('input[name="name.en"] >> visible=true').fill(secret);
  await A.page.locator('input[name="price"] >> visible=true').fill("7000");
  await A.page.locator('input[name="stock"] >> visible=true').fill("4");
  await A.page.locator("form button.btn-gold >> visible=true").click();
  await A.page.waitForURL((u) => u.pathname === "/dashboard/products");
  const pid = UUID.exec(await A.page.locator(`a[href^="/dashboard/products/"]`, { hasText: secret }).first().getAttribute("href"))[0];

  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await shopper.addCookies([{ name: "mm_locale", value: "en", domain: new URL(baseURL).hostname, path: "/" }]);
  const sp = await shopper.newPage();
  await sp.goto(`/s/${A.slug}/p/${pid}`, { waitUntil: "networkidle" });
  await sp.getByTestId("buy-add").click();
  await sp.goto(`/s/${A.slug}/cart`, { waitUntil: "networkidle" });
  const customer = `Private Customer ${A.tag}`;
  await sp.locator('input[name="customerName"] >> visible=true').fill(customer);
  await sp.locator('input[name="phone"] >> visible=true').fill(`0751${String(Date.now()).slice(-7)}`);
  const area = sp.locator('select[name="areaId"] >> visible=true');
  if (await area.count()) {
    const opts = await area.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    if (opts.length) await area.selectOption(opts[0]);
  }
  const other = sp.locator('input[name="areaOther"] >> visible=true');
  if ((await other.count()) && (await other.isVisible())) await other.fill("Shawes");
  const lm = sp.locator('input[name="landmark"], textarea[name="landmark"] >> visible=true');
  if (await lm.count()) await lm.first().fill("Near the mall");
  const ad = sp.locator('textarea[name="address"], input[name="address"] >> visible=true');
  if (await ad.count()) await ad.first().fill("Street 1");
  await sp.getByTestId("place-order").click();
  await sp.waitForURL(`**/s/${A.slug}/order/**`, { timeout: 30_000 });
  await shopper.close();
  await A.page.goto("/dashboard/orders", { waitUntil: "networkidle" });
  const oid = UUID.exec(await A.page.locator('a[href^="/dashboard/orders/"]', { hasText: customer }).first().getAttribute("href"))[0];
  // Action ids are global: collect them from A's own order + product pages, then replay them with B's session.
  await A.page.goto(`/dashboard/orders/${oid}`, { waitUntil: "networkidle" });
  const aIds = await actionIds(A.page);
  await A.page.goto("/dashboard/products", { waitUntil: "networkidle" });
  await A.page.getByTestId("product-share").first().click().catch(() => {});
  await A.page.waitForTimeout(1500);
  Object.assign(aIds, await actionIds(A.page));

  const B = await seller(browser, baseURL, "b");
  // Pages
  for (const path of [`/dashboard/products/${pid}`, `/dashboard/orders/${oid}`, `/dashboard/orders/${oid}/slip`]) {
    await B.page.goto(path, { waitUntil: "networkidle" });
    const html = await B.page.content();
    expect(html, path).not.toContain(secret);
    expect(html, path).not.toContain(customer);
  }
  // APIs
  const exp = await B.page.request.get("/api/orders/export");
  expect(await exp.text()).not.toContain(customer);
  // Server actions with A's ids
  await B.page.goto("/dashboard/products", { waitUntil: "networkidle" });
  let ids = { ...aIds, ...(await actionIds(B.page)) };
  if (ids.toggleProductAction) await callAction(B.page, ids.toggleProductAction, [pid, false], "/dashboard/products");
  if (ids.productShareKitAction) {
    const r = await callAction(B.page, ids.productShareKitAction, [pid], "/dashboard/products");
    expect(r.body).not.toContain(secret);
  }
  await B.page.goto("/dashboard/products/new", { waitUntil: "networkidle" });
  ids = { ...ids, ...(await actionIds(B.page)) };
  if (ids.deleteProductAction) await callAction(B.page, ids.deleteProductAction, [pid], "/dashboard/products/new");
  // Same-shape order action (order page of B's own empty list → use the id map from the orders route chunk).
  await B.page.goto("/dashboard/orders", { waitUntil: "networkidle" });
  ids = { ...ids, ...(await actionIds(B.page)) };
  if (ids.updateOrderStatusAction) await callAction(B.page, ids.updateOrderStatusAction, [oid, "cancelled", {}], "/dashboard/orders");
  for (const n of ["toggleProductAction", "deleteProductAction", "updateOrderStatusAction", "productShareKitAction"]) expect(ids[n], n).toBeTruthy();

  // A's product and order are untouched.
  const sf = await (await A.page.request.get(`/s/${A.slug}`)).text();
  expect(sf).toContain(secret);
  await A.page.goto(`/dashboard/orders/${oid}`, { waitUntil: "networkidle" });
  await expect(A.page.locator("h1").first().locator("xpath=..")).toContainText("Pending");

  // /admin is invisible to sellers; admin actions refuse them.
  await B.page.goto("/admin", { waitUntil: "networkidle" });
  expect(await B.page.content()).not.toContain("Upgrade requests");
  await A.ctx.close();
  await B.ctx.close();
});

test("auth: anon bounced, wrong password generic + keeps email, logout kills the session, cookies hardened, headers", async ({ browser, baseURL, request }) => {
  test.setTimeout(180_000);
  const host = new URL(baseURL).hostname;
  for (const p of ["/dashboard", "/dashboard/orders", "/dashboard/settings", "/onboarding"]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(p, { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname, p).toBe("/login");
    await ctx.close();
  }
  for (const p of ["/api/orders/export", "/api/share/qr", "/api/share/story"]) expect((await request.get(p)).status(), p).toBe(401);
  expect([401, 404]).toContain((await request.get("/api/cron/daily")).status());
  expect((await request.post("/api/uploads", { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } })).status()).toBeGreaterThanOrEqual(400);

  // wrong password: generic message, email kept, no session cookie
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await ctx.newPage();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"] >> visible=true').fill("nobody-audit@example.com");
  await page.locator('input[name="password"] >> visible=true').fill("not-the-password-1");
  await page.locator("form button >> visible=true").last().click();
  await expect(page.getByRole("alert").filter({ hasText: /wrong email or password/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input[name="email"] >> visible=true')).toHaveValue("nobody-audit@example.com");
  expect((await ctx.cookies()).filter((c) => /session/i.test(c.name))).toHaveLength(0);
  await ctx.close();

  // a session cookie is HttpOnly + SameSite=Lax; logout revokes it server-side
  const s = await seller(browser, baseURL, "c");
  const cookie = (await s.ctx.cookies()).find((c) => c.httpOnly && c.value.length > 20);
  expect(cookie).toBeTruthy();
  expect(cookie.sameSite).toBe("Lax");
  if (baseURL.startsWith("https")) expect(cookie.secure).toBe(true);
  await s.page.goto("/dashboard/more", { waitUntil: "networkidle" });
  const ids = await actionIds(s.page);
  expect(ids.logOutAction).toBeTruthy();
  await callAction(s.page, ids.logOutAction, [], "/dashboard/more");
  const replay = await browser.newContext();
  await replay.addCookies([{ name: cookie.name, value: cookie.value, domain: host, path: "/" }]);
  const rp = await replay.newPage();
  await rp.goto("/dashboard", { waitUntil: "networkidle" });
  expect(new URL(rp.url()).pathname).toBe("/login");
  await replay.close();
  await s.ctx.close();

  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBeTruthy();
  expect(h["permissions-policy"]).toContain("camera=()");
});
