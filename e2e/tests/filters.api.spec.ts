import { test, expect } from "@playwright/test";

// Filters are asserted against the API contract the listing page actually
// uses: colour, seats and body type never appear on a card, so a UI-only
// check cannot prove they filtered anything.
const API = "https://api.ukcarimports.ie/public/allcarsnew/0/25";
const BASE = {
  is_manheim_car: "0",
  premium_car: "0",
  vrtFilter: "Yes",
  minPrice: "15000",
  pagenum: 0,
  limit: 25,
};

type Car = Record<string, unknown>;

async function fetchCars(request: import("@playwright/test").APIRequestContext, extra: Record<string, unknown>): Promise<Car[]> {
  const res = await request.post(API, { data: { ...BASE, ...extra } });
  expect(res.ok(), `API responded ${res.status()}`).toBeTruthy();
  const json = await res.json();
  return json?.data?.cars ?? [];
}

const num = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
const str = (v: unknown) => String(v ?? "").trim().toLowerCase();

const CASES: { name: string; body: Record<string, unknown>; ok: (c: Car) => boolean }[] = [
  { name: "Make = bmw", body: { Make: "bmw" }, ok: (c) => str(c.make_name) === "bmw" },
  { name: "Fuel = Diesel", body: { Fuel: "Diesel" }, ok: (c) => str(c.fuel_type_name) === "diesel" },
  { name: "Body = SUV", body: { body_style: "SUV" }, ok: (c) => str(c.body_style_name) === "suv" },
  { name: "Gearbox = Manual", body: { transmission_type: "Manual" }, ok: (c) => str(c.transmission_name) === "manual" },
  { name: "Seats = 5", body: { seats: "5" }, ok: (c) => str(c.seats) === "5" },
  { name: "Colour = Black", body: { color: "Black" }, ok: (c) => str(c.color_name) === "black" },
  { name: "Min year 2022", body: { minYear: "2022" }, ok: (c) => num(c.year) >= 2022 },
  { name: "Max year 2018", body: { maxYear: "2018" }, ok: (c) => num(c.year) <= 2018 },
  { name: "Min price 40000", body: { minPrice: "40000" }, ok: (c) => num(c.computed_final_price_v2) >= 40000 },
  { name: "Max price 20000", body: { maxPrice: "20000" }, ok: (c) => num(c.computed_final_price_v2) <= 20000 },
];

for (const c of CASES) {
  test(`filter: ${c.name}`, async ({ request }) => {
    const cars = await fetchCars(request, c.body);
    expect(cars.length, "filter returned no cars at all").toBeGreaterThan(0);
    const bad = cars.filter((car) => !c.ok(car));
    expect(bad.slice(0, 2), `${bad.length}/${cars.length} rows do not match`).toEqual([]);
  });
}

// Two filters together must narrow, never widen.
test("filters combine (make + fuel)", async ({ request }) => {
  const cars = await fetchCars(request, { Make: "bmw", Fuel: "Diesel" });
  expect(cars.length).toBeGreaterThan(0);
  for (const c of cars) {
    expect(str(c.make_name)).toBe("bmw");
    expect(str(c.fuel_type_name)).toBe("diesel");
  }
});

// The public floor is €15,000 -- nothing below it may ever be listed.
test("public price floor is enforced", async ({ request }) => {
  const cars = await fetchCars(request, {});
  expect(cars.length).toBeGreaterThan(0);
  for (const c of cars) expect(num(c.computed_final_price_v2)).toBeGreaterThanOrEqual(15000);
});
