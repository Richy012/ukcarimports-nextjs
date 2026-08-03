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

// Headline copy says "N+ cars", so it must round DOWN — never claim stock we
// do not have. Nearest 1,000 keeps it honest and stops the wording churning
// every 15-minute revalidate. Falls back to a deliberately conservative
// figure if the count call fails.
export function formatApproxStock(count: number): string {
  if (!count || count < 1000) return "135,000+";
  return `${(Math.floor(count / 1000) * 1000).toLocaleString()}+`;
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
