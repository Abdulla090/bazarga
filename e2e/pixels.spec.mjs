import { expect, test } from "@playwright/test";
import { SLUG } from "./support.mjs";

/**
 * S5 seller pixels: the seller saves a TikTok + Meta pixel ID in settings; the storefront loads both vendor scripts
 * only after the shopper's first interaction, and loads nothing when the browser sends Do Not Track.
 * The vendor hosts are stubbed (no real network, no real pixel).
 */
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? "demo@mymarket.app";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "mymarket-demo";
const TT = "CABCDEF1234567890ABC";
const META = "123456789012345";

async function seller(browser, baseURL) {
  const host = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(DEMO_EMAIL);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.locator("form button").last().click();
  await page.waitForURL("**/dashboard**", { timeout: 30_000 });
  return { context, page };
}

async function savePixels(page, tiktok, meta) {
  await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  const form = page.getByTestId("pixels-form");
  await form.locator('input[name="tiktokPixelId"]').fill(tiktok);
  await form.locator('input[name="metaPixelId"]').fill(meta);
  await form.locator("button").click();
  await expect(form.getByRole("status")).toBeVisible({ timeout: 15_000 });
}

test("seller pixels: saved in settings, loaded after interaction, refused under Do Not Track", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const { context, page } = await seller(browser, baseURL);
  try {
    // A malformed ID is refused with a field error and nothing is stored.
    await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
    const form = page.getByTestId("pixels-form");
    await form.locator('input[name="metaPixelId"]').fill("not-a-pixel");
    await form.locator("button").click();
    await expect(form.locator(".field-error")).toBeVisible({ timeout: 15_000 });

    await savePixels(page, TT, META);

    const host = new URL(baseURL).hostname;
    const visit = async ({ dnt }) => {
      const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await shopper.addCookies([{ name: "mm_locale", value: "en", domain: host, path: "/" }]);
      if (dnt) await shopper.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { get: () => "1" }));
      const hits = [];
      await shopper.route(/analytics\.tiktok\.com|connect\.facebook\.net|facebook\.com\/tr/, (route) => {
        hits.push(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      });
      const sp = await shopper.newPage();
      await sp.goto(`/s/${SLUG}`, { waitUntil: "networkidle" });
      // Nothing before the first interaction.
      expect(hits).toHaveLength(0);
      await sp.mouse.click(10, 300);
      await sp.waitForTimeout(1500);
      await shopper.close();
      return hits;
    };

    const hits = await visit({ dnt: false });
    expect(hits.some((u) => u.includes("analytics.tiktok.com") && u.includes(`sdkid=${TT}`))).toBe(true);
    expect(hits.some((u) => u.includes("connect.facebook.net"))).toBe(true);

    expect(await visit({ dnt: true })).toHaveLength(0);
  } finally {
    await savePixels(page, "", "").catch(() => {});
    await context.close();
  }
});
