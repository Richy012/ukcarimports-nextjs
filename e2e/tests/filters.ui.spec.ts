import { test, expect } from "@playwright/test";

// UI-level filter truth (2026-08-05). 2026-09-06: tile text is read from the card <div>
// (the anchor is an overlay holding only the screen-reader title since the 3-5 Sep card change). The API-level specs prove filters
// compose in the backend; these drive the actual dropdowns like a visitor
// and demand the tiles delivered match what the controls promised. This is
// the layer where past lies lived: "abarth (198)" delivering 0 cars, facet
// counts ignoring the public price floor, the bestseller toggle showing
// full-stock numbers.

test("picking a make delivers only that make, and the count told the truth", async ({ page }) => {
  test.slow();
  await page.goto("/used-cars");
  await expect(page.locator('a[href^="/car/"]').first()).toBeVisible();

  const makeSelect = page.getByLabel("Make");
  const audiValue = await makeSelect.evaluate((el) => {
    const o = [...(el as HTMLSelectElement).options].find((x) => /^audi \(/.test(x.textContent || ""));
    return o ? o.value : "";
  });
  expect(audiValue, "an audi option exists in the make dropdown").toBeTruthy();
  await makeSelect.selectOption(audiValue);
  // Live preview debounce + fetch.
  await page.waitForTimeout(2500);

  // Every delivered tile is an Audi.
  const titles = await page.locator('a[href^="/car/"]').evaluateAll((els) =>
    els.slice(0, 20).map((el) => ((el.parentElement || el).textContent || "").toLowerCase()),
  );
  expect(titles.length).toBeGreaterThan(0);
  for (const t of titles) {
    expect(t).toContain("audi");
  }

  // The dropdown's advertised count and the live match count agree.
  const optionText = await makeSelect.evaluate(
    (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent || "",
  );
  const advertised = Number((optionText.match(/\(([\d,]+)\)/) || [])[1]?.replace(/,/g, ""));
  const matchLine = await page.getByText(/vehicles match/).first().textContent();
  const delivered = Number((matchLine?.match(/([\d,]+) vehicles match/) || [])[1]?.replace(/,/g, ""));
  expect(advertised).toBeGreaterThan(0);
  expect(delivered).toBeGreaterThan(0);
  expect(Math.abs(advertised - delivered)).toBeLessThanOrEqual(Math.max(5, advertised * 0.02));
});

test("fuel composes with make and Apply produces a shareable URL", async ({ page }) => {
  test.slow();
  await page.goto("/used-cars");
  await expect(page.locator('a[href^="/car/"]').first()).toBeVisible();

  const pick = async (label: string, re: RegExp) => {
    const sel = page.getByLabel(label);
    const value = await sel.evaluate((el, source) => {
      const rx = new RegExp(source);
      const o = [...(el as HTMLSelectElement).options].find((x) => rx.test(x.textContent || ""));
      return o ? o.value : "";
    }, re.source);
    expect(value, `option ${re} exists in ${label}`).toBeTruthy();
    await sel.selectOption(value);
  };
  await pick("Make", /^audi \(/);
  await page.waitForTimeout(1200);
  await pick("Fuel Type", /^Electric/);
  await page.waitForTimeout(2500);

  const chips = await page.locator('a[href^="/car/"]').evaluateAll((els) =>
    els.slice(0, 12).map((el) => ((el.parentElement || el).textContent || "").toLowerCase()),
  );
  expect(chips.length).toBeGreaterThan(0);
  for (const t of chips) {
    expect(t).toContain("audi");
    expect(t).toContain("electric");
  }

  await page.getByRole("button", { name: "Apply Filters" }).click();
  await page.waitForURL(/Make=audi/i);
  expect(page.url()).toMatch(/Fuel=electric/i);
});

// Connected dropdowns (owner, 2026-09-05): once a make is picked, colour,
// body type and engine size offer only what that make's cars actually have.
// Tesla is the probe: no estates or convertibles, and no engine sizes at all.
test("picking a make narrows colour, body and engine to what that make has", async ({ page }) => {
  test.slow();
  await page.goto("/used-cars");
  await expect(page.locator('a[href^="/car/"]').first()).toBeVisible();

  const optionCount = (label: string) =>
    page.getByLabel(label).evaluate((el) => (el as HTMLSelectElement).options.length - 1);
  const before = {
    colour: await optionCount("Colour"),
    body: await optionCount("Body Type"),
    engine: await optionCount("Min Engine Size"),
  };
  expect(before.colour).toBeGreaterThan(5);
  expect(before.body).toBeGreaterThan(5);
  expect(before.engine).toBeGreaterThan(5);

  const makeSelect = page.getByLabel("Make");
  const tesla = await makeSelect.evaluate((el) => {
    const o = [...(el as HTMLSelectElement).options].find((x) => /^tesla \(/.test(x.textContent || ""));
    return o ? o.value : "";
  });
  expect(tesla, "a tesla option exists in the make dropdown").toBeTruthy();
  await makeSelect.selectOption(tesla);
  await page.waitForTimeout(3000);

  const after = {
    colour: await optionCount("Colour"),
    body: await optionCount("Body Type"),
    engine: await optionCount("Min Engine Size"),
  };
  expect(after.body).toBeLessThan(before.body);
  expect(after.engine).toBeLessThan(before.engine);
  expect(after.colour).toBeLessThanOrEqual(before.colour);

  // Every colour still on offer carries a real count for this make.
  const colourTexts = await page.getByLabel("Colour").evaluate((el) =>
    [...(el as HTMLSelectElement).options].slice(1).map((o) => o.textContent || ""),
  );
  for (const t of colourTexts) {
    const n = Number((t.match(/\((\d+)\)/) || [])[1]);
    expect(n, `colour option "${t}" has a count`).toBeGreaterThan(0);
  }
});

test("the bestseller view delivers only badged cars", async ({ page }) => {
  await page.goto("/used-cars?bestseller=1");
  await expect(page.locator('a[href^="/car/"]').first()).toBeVisible();
  const tiles = await page.locator('a[href^="/car/"]').evaluateAll((els) =>
    els.slice(0, 20).map((el) => ((el.parentElement || el).textContent || "").toUpperCase()),
  );
  expect(tiles.length).toBeGreaterThan(0);
  for (const t of tiles) {
    expect(t).toContain("BESTSELLER");
  }
});
