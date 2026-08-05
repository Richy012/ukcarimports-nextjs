import { test, expect } from "@playwright/test";

// Clear all (2026-08-05, commit a622d9c): several filters live only in
// component state (the Bestseller toggle, dropdowns set via live preview), so
// "Clear all" as a bare URL push was a NO-OP when the visitor was already on
// plain /used-cars — Richard's exact repro. It must reset the controls
// themselves.
test("Clear all resets state-only filters (bestseller toggle + max price)", async ({ page }) => {
  test.slow();
  await page.goto("/used-cars");
  await expect(page.locator('a[href^="/car/"]').first()).toBeVisible();

  const toggle = page.getByRole("button", { name: /Bestseller Series/ });
  await toggle.click();
  await page.waitForTimeout(2000);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Max Price").selectOption("25000");
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: "Clear all" }).click();
  await page.waitForTimeout(2500);

  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Max Price")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Clear all" })).toHaveCount(0);
});
