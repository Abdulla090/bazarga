import { expect, test } from "@playwright/test";

/**
 * Waitlist with position + referrals (agentb/waitlist-referrals).
 * Writes real waitlist rows, so it only runs against a local server unless WAITLIST_LIVE=1.
 */
const local = (url) => /localhost|127\.0\.0\.1/.test(url ?? "");
const phone = () => `0750${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;

async function join(page, name) {
  await page.locator("#w-name").fill(name);
  await page.locator("#w-wa").fill(phone());
  await page.locator("#w-sells").selectOption("c1");
  await page.locator("#w-city").selectOption({ index: 1 });
  await page.getByRole("button", { name: /join the waitlist/i }).click();
  await expect(page.getByTestId("waitlist-spot")).toBeVisible({ timeout: 15_000 });
}

test("join → position + link; a friend joining through it moves the referrer up; status page + no overflow", async ({ browser, baseURL }) => {
  test.skip(!local(baseURL) && process.env.WAITLIST_LIVE !== "1", "writes waitlist rows; local only");
  const host = new URL(baseURL).hostname;
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxA.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const a = await ctxA.newPage();
  await a.goto("/#join", { waitUntil: "networkidle" });
  await join(a, "E2E Test Ava");
  const posA = Number((await a.getByTestId("waitlist-position").innerText()).replace(/\D/g, ""));
  expect(posA).toBeGreaterThan(0);
  const link = await a.getByTestId("waitlist-link").inputValue();
  expect(link).toMatch(/\/\?ref=[A-Z0-9]{8}#join$/);
  const code = new URL(link).searchParams.get("ref");

  // friend, 390 wide Kurdish, through the link
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctxB.addCookies([{ name: "mm_locale", value: "ku", domain: host, path: "/" }]);
  const b = await ctxB.newPage();
  await b.goto(`/?ref=${code}`, { waitUntil: "networkidle" });
  await expect(b.getByTestId("waitlist-invited")).toBeVisible();
  await b.locator("#w-name").fill("E2E Test Bryar");
  await b.locator("#w-wa").fill(phone());
  await b.locator("#w-sells").selectOption("c2");
  await b.locator("#w-city").selectOption({ index: 1 });
  await b.locator("form button").last().click();
  await expect(b.getByTestId("waitlist-spot")).toBeVisible({ timeout: 15_000 });
  const w = await b.evaluate(() => ({ s: document.scrollingElement.scrollWidth, i: window.innerWidth }));
  expect(w.s).toBeLessThanOrEqual(w.i);

  // the referrer's status page now shows one friend
  await a.goto(`/waitlist/${code}`, { waitUntil: "networkidle" });
  await expect(a.getByTestId("waitlist-spot")).toContainText("1");
  const posAfter = Number((await a.getByTestId("waitlist-position").innerText()).replace(/\D/g, ""));
  expect(posAfter).toBeLessThanOrEqual(posA);

  // unknown code → friendly page, still 200
  const res = await a.goto("/waitlist/NOSUCHCODE", { waitUntil: "networkidle" });
  expect(res?.status()).toBe(200);
  await expect(a.getByRole("link", { name: /join the waitlist/i })).toBeVisible();
  await ctxA.close();
  await ctxB.close();
});
