import { test, expect } from "@playwright/test";

function pricesFrom(texts: string[]): number[] {
  return texts
    .map((t) => t.match(/€\s?([\d,]+)/))
    .filter(Boolean)
    .map((m) => parseInt(m![1].replace(/,/g, ""), 10));
}

async function cardPrices(page: import("@playwright/test").Page) {
  const cards = page.locator('a[href^="/car/"]');
  await expect(cards.first()).toBeVisible();
  // Read the price ELEMENT, never the whole card: Bestseller badges carry
  // their own euro figure ("EUR 2,827 less than in Ireland") and a card-wide
  // regex picks that up instead of the price, which looks exactly like a
  // sorting bug. Class names are hashed, so match the stable prefix.
  const priceEls = page.locator('a[href^="/car/"] div[class*="cardPrice"]');
  return pricesFrom(await priceEls.allInnerTexts());
}

// Regression: the frontend sent price_sort/mileage_sort but the API reads
// pricefilter/mileagefilter, so every sort selection was silently ignored.
test.describe("sorting", () => {
  test("price low to high is ascending", async ({ page }) => {
    await page.goto("/used-cars?Make=bmw&price_sort=low");
    const prices = await cardPrices(page);
    expect(prices.length).toBeGreaterThan(5);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("price high to low is descending", async ({ page }) => {
    await page.goto("/used-cars?Make=bmw&price_sort=high");
    const prices = await cardPrices(page);
    expect(prices.length).toBeGreaterThan(5);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test("the two directions disagree", async ({ page }) => {
    await page.goto("/used-cars?Make=bmw&price_sort=low");
    const low = await cardPrices(page);
    await page.goto("/used-cars?Make=bmw&price_sort=high");
    const high = await cardPrices(page);
    expect(low[0]).toBeLessThan(high[0]);
  });
});
