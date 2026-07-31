import { test, expect } from "@playwright/test";

// Every route that is linked from the site chrome must render, not just 200.
const PAGES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /importing a car/i },
  { path: "/used-cars", heading: /used cars for sale/i },
  { path: "/how-it-works", heading: /how it works/i },
  { path: "/car-sourcing", heading: /sourcing/i },
  { path: "/best-value", heading: /best value|value/i },
  { path: "/about-us", heading: /about/i },
  { path: "/contact", heading: /contact/i },
  { path: "/faq", heading: /faq|frequently/i },
  { path: "/blog", heading: /blog/i },
  { path: "/sign-in", heading: /sign in|login/i },
  { path: "/sign-up", heading: /sign up|register|create/i },
];

for (const { path, heading } of PAGES) {
  test(`page renders: ${path}`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `${path} HTTP status`).toBe(200);
    await expect(page.locator("h1").first()).toContainText(heading);
  });
}
