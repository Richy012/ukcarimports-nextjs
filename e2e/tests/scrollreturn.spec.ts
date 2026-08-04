import { test, expect } from "@playwright/test";

// Deep-scroll return (2026-08-05, commits 58b7eb6..ce859d8): coming back from
// a car page must land on the clicked tile at its saved viewport offset and
// STAY there. The bug that survived five fixes was a mount-time live-preview
// fetch replacing the restored list ~500ms AFTER landing — visible to a human,
// invisible to any single-instant assertion. So this test snapshots twice,
// seconds apart, and demands byte-identical position and tile count.
test("deep-scroll return lands on the clicked car and holds still", async ({ page }) => {
  test.slow();
  await page.goto("/used-cars?Make=bmw");
  await expect(page.locator('a[href^="/car/"]').first()).toBeVisible();

  // Pull in several batches of tiles.
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);
  }
  const tileCount = await page.locator('a[href^="/car/"]').count();
  expect(tileCount).toBeGreaterThanOrEqual(75);

  // Click a deep tile positioned deliberately off-centre.
  const target = page.locator('a[href^="/car/"]').nth(Math.min(70, tileCount - 1));
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -100));
  await page.waitForTimeout(300);
  const href = await target.getAttribute("href");
  const topAtClick = await target.evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await target.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[/]/g, "\\/")));
  await page.waitForTimeout(1500);

  await page.goBack();
  await page.waitForTimeout(1200);

  const snap = async () => ({
    tiles: await page.locator('a[href^="/car/"]').count(),
    scrollY: await page.evaluate(() => Math.round(window.scrollY)),
    tileTop: await page
      .locator(`a[href="${href}"]`)
      .evaluate((el) => Math.round(el.getBoundingClientRect().top))
      .catch(() => null),
    veiled: await page.evaluate(() => document.documentElement.classList.contains("uc-veil")),
  });

  const early = await snap();
  await page.waitForTimeout(3500);
  const late = await snap();

  expect(early.veiled, "veil must lift").toBe(false);
  expect(early.tileTop, "clicked tile is back on screen").not.toBeNull();
  // Within a tile's height of where it sat when clicked.
  expect(Math.abs((early.tileTop as number) - topAtClick)).toBeLessThanOrEqual(60);
  // The part every naive check misses: NOTHING may move after landing.
  expect(late.scrollY, "scroll must not drift after landing").toBe(early.scrollY);
  expect(late.tiles, "restored tiles must not be replaced after landing").toBe(early.tiles);
});
