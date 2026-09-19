import { toTileCar } from "@/lib/publicCar";

/**
 * The cars themselves for an /import/<make>[/<model>] landing page.
 *
 * Owner, 17 Sep 2026: "put the stock on the model pages". Search Console
 * showed the XC90/XC60/i8/Polestar pages drawing ~11,000 impressions a month
 * at position 7-10 with almost no clicks, and two title rewrites had not
 * moved it; the page said "587 for sale" and showed no cars. The query is
 * "<model> for sale ireland" - a listing - so the listing goes on the page.
 *
 * Same request the /used-cars grid makes (same public-display rules: VRT
 * priceable, landed price >= EUR 15,000), biggest measured saving first so
 * the Bestseller badges lead, and every row cut down to the tile fields by
 * toTileCar so no cost field ever reaches the RSC payload.
 */
const API_BASE = "https://api.ukcarimports.ie/public";

export interface TileCar {
  car_id: string;
  car_name: string;
  registration_date: string;
  transmission_name: string;
  fuel_type_name: string;
  mileage: string;
  premium_car?: number;
  is_manheim_car?: string;
  car_info?: { final_price?: number };
  thumb_v?: string | null;
  photo_count?: number;
  photo_ids?: number[];
  bestseller_tier?: string | null;
  bestseller_saving_eur?: number | null;
  bestseller_irish_ads?: number | null;
  bestseller_median_eur?: number | null;
  bestseller_cheapest_eur?: number | null;
  bestseller_below_cheapest?: number | null;
  // Mileage-matched median (owner 2026-09-19): the Irish listings within
  // 20,000 km of this car that priced it, when 10+ exist; null = whole segment.
  bestseller_km_ads?: number | null;
  bestseller_km_median_eur?: number | null;
  price_drop_eur?: number | null;
  price_dropped_at?: string | null;
}

async function fetchStock(make: string, model: string | null, limit: number, savingFirst: boolean): Promise<TileCar[]> {
  try {
    const res = await fetch(`${API_BASE}/allcarsnew/0/10`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_manheim_car: "0",
        premium_car: "0",
        vrtFilter: "Yes",
        minPrice: "1",
        maxPrice: "",
        minYear: "",
        maxYear: "",
        Make: make,
        Model: model ?? "",
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
        pagenum: 0,
        limit,
        pricefilter: "",
        mileagefilter: "",
        dropfilter: "",
        color: "",
        search: "",
        searchChips: [],
        version: "",
        versionChips: [],
        vrt: "",
        bestsellerSeries: "",
        minSaving: "",
        belowCheapest: "",
        savingfilter: savingFirst ? "1" : "",
      }),
      // The landing page itself revalidates hourly; the stock strip refreshes
      // a little faster so a sold car does not sit on the page all hour.
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows: object[] = json?.data?.cars ?? [];
    return rows.map((r) => {
      const c = toTileCar(r) as TileCar & { car_info?: { final_price?: number } | null };
      if (c.car_info === null) c.car_info = undefined;
      return c as TileCar;
    });
  } catch {
    return [];
  }
}

/**
 * Up to `limit` cars: the ones with a measured saving first (savingfilter
 * also FILTERS to badged cars, so a model with none - a new brand, the i8 -
 * came back empty), topped up in the listing's default order.
 */
export async function getModelStock(make: string, model: string | null, limit = 12): Promise<{ cars: TileCar[] }> {
  const cars = await fetchStock(make, model, limit, true);
  if (cars.length < limit) {
    const seen = new Set(cars.map((c) => c.car_id));
    for (const c of await fetchStock(make, model, limit, false)) {
      if (cars.length >= limit) break;
      if (!seen.has(c.car_id)) {
        cars.push(c);
        seen.add(c.car_id);
      }
    }
  }
  return { cars };
}
