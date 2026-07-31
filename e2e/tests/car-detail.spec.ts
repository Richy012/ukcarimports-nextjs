import { test, expect } from "@playwright/test";

async function openFirstCar(page: import("@playwright/test").Page) {
  await page.goto("/used-cars");
  const first = page.locator('a[href^="/car/"]').first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute("href");
  await page.goto(href!);
  return href!;
}

test("car page shows the essentials", async ({ page }) => {
  await openFirstCar(page);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText(/€\s?[\d,]+/).first()).toBeVisible();
  await expect(page.getByText(/mileage/i).first()).toBeVisible();
});

// The listed price must exclude the inspection, so the comparison against
// Irish forecourt asks stays like-for-like.
test("mechanical inspection is not pre-selected", async ({ page }) => {
  await openFirstCar(page);
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const label = await boxes.nth(i).evaluate((el) => (el.closest("label")?.textContent || el.parentElement?.textContent || "").trim());
    if (/inspection/i.test(label)) {
      await expect(boxes.nth(i), "inspection must default to unticked").not.toBeChecked();
    }
  }
});

test("every document and external link opens in a new tab", async ({ page }) => {
  await openFirstCar(page);
  const links = page.locator('a[href^="http"], a[href$=".pdf"]');
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    const href = await links.nth(i).getAttribute("href");
    if (!href || href.includes("ukcarimports.ie")) continue;
    await expect(links.nth(i), `${href} should open in a new tab`).toHaveAttribute("target", "_blank");
  }
});

test("the deposit call to action is present", async ({ page }) => {
  await openFirstCar(page);
  await expect(page.getByRole("button", { name: /deposit/i }).first()).toBeVisible();
});
