import { test, expect } from "@playwright/test";

const MAIN_LINKS = [
  { text: /^home$/i, path: "/" },
  { text: /used cars/i, path: "/used-cars" },
  { text: /car sourcing/i, path: "/car-sourcing" },
  { text: /how it works/i, path: "/how-it-works" },
];

test.describe("header navigation", () => {
  for (const link of MAIN_LINKS) {
    test(`nav link goes to ${link.path}`, async ({ page, isMobile }) => {
      await page.goto("/");
      if (isMobile) {
        await page.getByRole("button", { name: /toggle navigation menu/i }).click();
      }
      await page.getByRole("link", { name: link.text }).first().click();
      await expect(page).toHaveURL(new RegExp(`${link.path.replace("/", "\/")}$`));
    });
  }
});

test.describe("mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("hamburger opens and closes the menu", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /toggle navigation menu/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /used cars/i }).first()).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // Regression: the open nav used to share a flex line with the logo and
  // toggle, leaving the hamburger sitting on top of HOW IT WORKS so the tap
  // hit the button instead of the link.
  test("hamburger does not overlap any menu item", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /toggle navigation menu/i });
    await toggle.click();
    const tBox = await toggle.boundingBox();
    expect(tBox).not.toBeNull();
    const links = page.locator("header nav a");
    const count = await links.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      if (!box || box.height === 0) continue;
      const overlaps =
        tBox!.x < box.x + box.width && tBox!.x + tBox!.width > box.x &&
        tBox!.y < box.y + box.height && tBox!.y + tBox!.height > box.y;
      expect(overlaps, `hamburger overlaps "${(await links.nth(i).innerText()).trim()}"`).toBe(false);
    }
  });

  test("More dropdown reveals its links", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /toggle navigation menu/i }).click();
    const more = page.getByRole("button", { name: /more/i });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    for (const name of [/about us/i, /contact/i, /blog/i, /faq/i]) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }
  });
});

test("page never scrolls sideways", async ({ page }) => {
  for (const path of ["/", "/used-cars", "/how-it-works"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
