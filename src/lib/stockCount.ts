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
// 2026-08-11 owner call: sub-15k stock is advertised now. Floor kept only
// as a guard against unpriced/garbage rows.
export const PUBLIC_FLOOR_EUR = "1";

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
export function formatStockCount(count: number | null): string | undefined {
  return count && count > 0 ? count.toLocaleString() : undefined;
}

// Marketing surfaces (homepage hero, search button) show "Over N" with N
// floored to the nearest thousand. The homepage is a cached static page and
// /used-cars is dynamic, so their figures are always fetched moments apart;
// rounding means ordinary churn -- and even a mass delisting -- can never
// make the two pages visibly contradict each other. /used-cars keeps the
// exact number, because that is the page where the precise figure matters.
export function roundStockDown(count: number): number {
  return count > 1000 ? Math.floor(count / 1000) * 1000 : count;
}

// A zero is NEVER a legitimate inventory figure — it is an error.
//
// This used to return 0 on failure, and the callers that did not guard printed
// it: "Search 0+ cars", "Browse 0+ cars", and a bare "0" on the catalogue,
// which then sat in Next's ISR cache for the full revalidate window. Proven by
// execution 2026-08-21. Returning null instead makes it impossible to render a
// figure by accident — every caller has to decide what to show without one.
//
// The old fallback was also completely SILENT, so nobody could know it had
// happened. Every fallback is now logged; it lands in the pm2 error log.
function noStockCount(reason: string): null {
  console.error(
    `[stockCount] FALLBACK: no inventory figure available, surfaces will omit it. Reason: ${reason}`,
  );
  return null;
}

export async function getStockCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/allcarsnew/0/1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CANONICAL_BROWSE_BODY),
      next: { revalidate: 300 },
    });
    if (!res.ok) return noStockCount(`HTTP ${res.status}`);
    const json = await res.json();
    const n = json?.data?.count;
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
      return noStockCount(`count came back as ${JSON.stringify(n)}`);
    }
    return n;
  } catch (err) {
    return noStockCount(err instanceof Error ? err.message : String(err));
  }
}
