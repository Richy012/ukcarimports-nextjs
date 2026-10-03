import { test, expect } from "@playwright/test";

// Website review 3 Oct 2026, deposit fixes #17 #46 #47. The availability and reserved checks are answered inside the
// browser (page.route), so no advert is ever loaded; no form is submitted and nothing is sent.

async function firstCar(page: import("@playwright/test").Page) {
  await page.goto("/used-cars");
  const first = page.locator('a[href^="/car/"]').first();
  await expect(first).toBeVisible();
  return (await first.getAttribute("href"))!.split("?")[0];
}

async function stubChecks(page: import("@playwright/test").Page) {
  await page.route("**/api/check-availability", (r) =>
    r.fulfill({ json: { ResponseCode: "1", data: { status: "available", make: "test", check_id: null } } }),
  );
  await page.route("**/api/car-reserved/**", (r) => r.fulfill({ json: { reserved: false } }));
}

async function screenWidth(page: import("@playwright/test").Page) {
  return page.evaluate(() => [document.documentElement.scrollWidth, window.screen.width]);
}

test("car page is no wider than a phone screen (#17)", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await page.goto(await firstCar(page));
  await expect(page.locator('form[action="/trade-ins"]')).toBeVisible();
  const [scroll, screen] = await screenWidth(page);
  expect(scroll, "page scrolls sideways").toBeLessThanOrEqual(screen);
});

test("deposit window: the button says what it does and fits the screen (#47 #17)", async ({ page }) => {
  await stubChecks(page);
  await page.goto(await firstCar(page));
  await page.getByRole("button", { name: /Place A Deposit/i }).click();
  const submit = page.getByRole("button", { name: "Send deposit request" });
  await expect(submit).toBeVisible();
  const box = (await submit.boundingBox())!;
  const [, screen] = await screenWidth(page);
  expect(box.x + box.width, "button runs off the screen").toBeLessThanOrEqual(screen);
});

test("back from Stripe reopens at the Pay step with the details kept (#46)", async ({ page }) => {
  await stubChecks(page);
  const href = await firstCar(page);
  const carId = href.split("/").pop()!;
  await page.goto(href);
  await page.evaluate(
    (id) =>
      sessionStorage.setItem(
        "ukci_deposit_" + id,
        JSON.stringify({ name: "x_test", email: "x_test@example.com", phone: "0", includeInspection: false, includeWarranty: false, selectedWarrantyKey: "" }),
      ),
    carId,
  );
  await page.goto(href + "?deposit=canceled");
  await expect(page.getByRole("button", { name: /Pay €2,000 deposit securely/ })).toBeVisible();
  await expect(page.getByText("Payment not completed")).toBeVisible();
});
