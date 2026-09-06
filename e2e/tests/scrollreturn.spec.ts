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

  // Pull in batches until there are enough tiles to click deep, then STOP scrolling and wait
  // for the list to settle. 2026-09-06: since the 3-5 Sep card/ladder change a batch is far
  // bigger (six bottom-scrolls loaded 650 tiles) and the grid keeps appending for seconds, so
  // the deep tile never counted as "stable" and click() waited out the whole test timeout.
  const tiles = page.locator('a[href^="/car/"]');
  for (let i = 0; i < 8 && (await tiles.count()) < 75; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);
  }
  let tileCount = await tiles.count();
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(700);
    const again = await tiles.count();
    if (again === tileCount) break;
    tileCount = again;
  }
  expect(tileCount).toBeGreaterThanOrEqual(75);

  // Click a deep tile positioned deliberately off-centre.
  const target = page.locator('a[href^="/car/"]').nth(Math.min(70, tileCount - 1));
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -100));
  await page.waitForTimeout(300);
  const href = await target.getAttribute("href");
  const topAtClick = await target.evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await target.click();
  await page.waitForURL(new RegExp(href!.replace(/[/]/g, "\\/")), { timeout: 30000 });
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
