// ONE stock number across the whole site (owner requirement 2026-07-31).
//
// Every surface that displays "how many cars" must call getStockCount() —
// never its own allcarsnew count. The body below is EXACTLY the /used-cars
// default (unfiltered) request, so the number always equals what a customer
// lands on when they click Search/Browse. Identical URL+body+options lets
// Next's data cache share a single entry across all routes for the same
// 15-minute window — that is what makes the number consistent everywhere.
const API_BASE = "https://api.ukcarimports.ie/public";

// The two standing business rules the legacy site always applied (owner
// confirmed 2026-07-31 when the counts diverged): never show a car without a
// confirmed VRT match (no POA — "the price you see is the price you pay"),
// and never show stock landing under €15,000 (uneconomic to import).
export const PUBLIC_FLOOR_EUR = "15000";

export const CANONICAL_BROWSE_BODY = {
  is_manheim_car: "0",
  premium_car: "0",
  vrtFilter: "Yes",
  minPrice: PUBLIC_FLOOR_EUR,
  maxPrice: "",
  minYear: "",
  maxYear: "",
  Make: "",
  Model: "",
  Fuel: "",
  seats: "",
  body_style: "",
  Condition: "",
  minMileage: "",
  maxMileage: "",
  minEnginesize: "",
  maxEnginesize: "",
  transmission_type: "",
  engine: "",
  pagenum: 1,
  limit: 1,
  price_sort: "",
  mileage_sort: "",
  color: "",
  search: "",
  searchChips: [],
  version: "",
  versionChips: [],
  vrt: "",
};

// The exact number of cars live on the site right now (owner, 2026-08-03).
// Returns undefined if the count call failed, so the headline drops the
// figure entirely rather than printing a zero or a made-up round number.
export function formatStockCount(count: number): string | undefined {
  return count > 0 ? count.toLocaleString() : undefined;
}

export async function getStockCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/allcarsnew/0/1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CANONICAL_BROWSE_BODY),
      next: { revalidate: 900 },
    });
    const json = await res.json();
    return (json?.data?.count as number) ?? 0;
  } catch {
    return 0;
  }
}
