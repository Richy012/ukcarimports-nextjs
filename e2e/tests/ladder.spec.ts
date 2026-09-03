import { test, expect } from "@playwright/test";

// The Bestseller ladder (owner 2026-09-03): floor €750, six rungs, rung chips,
// biggest-saving sort, "cheaper than every Irish listing". Asserted against
// the API contract the listing uses, then the two surfaces a buyer sees.
const API = "https://api.ukcarimports.ie/public/allcarsnew/0/25";
const BASE = {
  is_manheim_car: "0",
  premium_car: "0",
  vrtFilter: "Yes",
  minPrice: "1",
  pagenum: 0,
  limit: 25,
};

type Car = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

async function fetchCars(request: import("@playwright/test").APIRequestContext, extra: Record<string, unknown>): Promise<Car[]> {
  const res = await request.post(API, { data: { ...BASE, ...extra } });
  expect(res.ok(), `API responded ${res.status()}`).toBeTruthy();
  const json = await res.json();
  return json?.data?.cars ?? [];
}

test("rung chip: min saving 2000 returns only badges of €2,000+, biggest first", async ({ request }) => {
  const cars = await fetchCars(request, { bestsellerSeries: "1", minSaving: 2000, savingfilter: "1" });
  expect(cars.length).toBeGreaterThan(0);
  const savings = cars.map((c) => num(c.bestseller_saving_eur));
  for (const s of savings) expect(s).toBeGreaterThanOrEqual(2000);
  for (let i = 1; i < savings.length; i++) expect(savings[i]).toBeLessThanOrEqual(savings[i - 1]);
});

test("ladder floor: the Bestseller set now includes €750–2,499 savings", async ({ request }) => {
  const cars = await fetchCars(request, { bestsellerSeries: "1", minSaving: 750, pricefilter: "low" });
  expect(cars.length).toBeGreaterThan(0);
  for (const c of cars) expect(num(c.bestseller_saving_eur)).toBeGreaterThanOrEqual(750);
  expect(cars.some((c) => num(c.bestseller_saving_eur) < 2500)).toBeTruthy();
});

test("cheaper-than-every-Irish-listing chip returns flagged cars only", async ({ request }) => {
  const cars = await fetchCars(request, { belowCheapest: "1", savingfilter: "1" });
  expect(cars.length).toBeGreaterThan(0);
  for (const c of cars) {
    expect(num(c.bestseller_below_cheapest)).toBe(1);
    expect(num(c.bestseller_irish_ads)).toBeGreaterThanOrEqual(10);
  }
});

test("listing page honours the rung chip from the URL", async ({ page }) => {
  await page.goto("/used-cars?bestseller=1&min_saving=2000", { waitUntil: "domcontentloaded" });
  const chip = page.getByRole("button", { name: /€2,000\+/ });
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Bestseller Series/ })).toHaveAttribute("aria-pressed", "true");
});

test("index page carries the ladder headline", async ({ page }) => {
  await page.goto("/bestseller-index", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/cars €750\+ under the Irish market/i).first()).toBeVisible();
});
