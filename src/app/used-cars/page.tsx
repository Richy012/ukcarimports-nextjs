// Server Component -- runs entirely on the server, no client JS needed to
// produce the HTML. This is the actual fix for the ~9s mobile LCP: the
// browser gets real car data in the initial HTML response instead of an
// empty <div id="root"> that waits on a full SPA boot before anything paints.
import { preload } from "react-dom";
import { facetBody, keepSelected, parseFacet, type FacetName, type FacetOption } from "@/lib/facets";
import FilterBar from "./FilterBar";
import { irishListings } from "@/lib/irishListings";
import { getStockCount } from "@/lib/stockCount";
import styles from "./page.module.css";
import { toTileCar } from "@/lib/publicCar";

// 2026-08-11: was the layout default "Used cars for sale" -- generic, and the
// old description contradicted the all-inclusive proposition (external SEO audit).
export const metadata = {
  title: "UK Used Cars for Import to Ireland - VRT Included",
  description:
    "Browse 100,000+ UK used cars priced fully landed in Ireland. VRT, VAT, customs, transport and Irish registration included in the displayed price.",
  // one canonical for every filter/query variant — the filtered views are
  // the same collection, not separate pages
  alternates: { canonical: "https://ukcarimports.ie/used-cars" },
};

const USED_CARS_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "UK Used Cars for Import to Ireland",
    url: "https://ukcarimports.ie/used-cars",
    description:
      "UK used cars priced fully landed in Ireland - VRT, VAT, customs, transport and Irish registration included in the displayed price.",
    isPartOf: { "@id": "https://ukcarimports.ie/#website" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://ukcarimports.ie/" },
      { "@type": "ListItem", position: 2, name: "Used cars", item: "https://ukcarimports.ie/used-cars" },
    ],
  },
];

const API_BASE = "https://api.ukcarimports.ie/public";
const PAGE_SIZE = 25;

const FACET_FILTER_BODY = {
  is_manheim_car: "0",
  premium_car: 0,
  // The €15k public floor applies to facet counts too — without it the
  // dropdowns promise more cars than the listing (which enforces the floor)
  // can show. Same owner complaint as the Bestseller counts: "said 198,
  // returned 0" in miniature.
  minPrice: "1",
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
  color: "",
  vrtFilter: "Yes",
};

// Connected filters (2026-09-05): the server render fetches every dropdown
// against the applied URL state, minus that dropdown's own key, so a deep
// link lands with the same narrowed lists the client keeps up afterwards.
async function postFacet(name: FacetName, full: Record<string, unknown>): Promise<FacetOption[]> {
  try {
    const res = await fetch(`${API_BASE}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facetBody(full, name)),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return parseFacet(name, await res.json());
  } catch {
    return [];
  }
}

interface Car {
  car_id: string;
  car_name: string;
  featured_image: string;
  thumb_v?: string | null;
  car_images: string;
  registration_date: string;
  transmission_name: string;
  fuel_type_name: string;
  mileage: string;
  premium_car: number;
  is_manheim_car: string;
  car_info?: { final_price?: number };
}

interface ApiResponse {
  ResponseCode: string;
  data: { cars: Car[]; count: number };
}

interface Filters {
  Make: string;
  Model: string;
  Fuel: string;
  body_style: string;
  transmission_type: string;
  seats: string;
  color: string;
  minEnginesize: string;
  maxEnginesize: string;
  minYear: string;
  maxYear: string;
  minPrice: string;
  maxPrice: string;
  minMileage: string;
  maxMileage: string;
  price_sort: string;
  mileage_sort: string;
  drop_sort: string;
  bestseller: string;
  min_saving: string;
  below_cheapest: string;
  saving_sort: string;
}

async function getCars(
  filters: Filters,
  searchChips: string[],
  versionChips: string[],
  pageNum: number,
): Promise<ApiResponse> {
  const res = await fetch(`${API_BASE}/allcarsnew/0/10`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      is_manheim_car: "0",
      premium_car: "0",
      // Standing public-display rules (same as lib/stockCount + FilterBar):
      // VRT-priceable cars only, landed price >= €15,000.
      vrtFilter: "Yes",
      minPrice: filters.minPrice || "1",
      maxPrice: filters.maxPrice,
      minYear: filters.minYear,
      maxYear: filters.maxYear,
      Make: filters.Make,
      Model: filters.Model,
      Fuel: filters.Fuel,
      seats: filters.seats,
      body_style: filters.body_style,
      Condition: "",
      minMileage: filters.minMileage,
      maxMileage: filters.maxMileage,
      minEnginesize: filters.minEnginesize,
      maxEnginesize: filters.maxEnginesize,
      transmission_type: filters.transmission_type,
      engine: "",
      // The API's pagenum is 0-based (see FilterBar.tsx, which sends 0 for
      // the first page); our page counter is 1-based. Passing it through
      // unconverted skipped the first 25 cars of every result set, and
      // rendered an empty list for any filter matching 25 or fewer.
      pagenum: pageNum - 1,
      limit: PAGE_SIZE,
      // The API reads these as pricefilter/mileagefilter (CarsNewTwoController
      // lines 229-230). Sending price_sort/mileage_sort meant neither sort ever
      // reached the query and every "sort by" selection was silently ignored.
      pricefilter: filters.price_sort,
      mileagefilter: filters.mileage_sort,
      dropfilter: filters.drop_sort,
      color: filters.color,
      search: searchChips.join(" "),
      searchChips,
      version: versionChips.join(" "),
      versionChips,
      vrt: "",
      // Bestseller Series: only cars carrying a live badge (priced €2,500+
      // under the Irish market under the frozen two-route rule).
      bestsellerSeries: filters.bestseller,
      // Ladder (owner 2026-09-03): rung chips, the cheapest-Irish chip, and
      // biggest-saving order — the default inside the badge set unless
      // another sort was chosen.
      minSaving: filters.min_saving,
      belowCheapest: filters.below_cheapest,
      savingfilter:
        filters.saving_sort ||
        ((filters.bestseller || filters.min_saving || filters.below_cheapest) &&
        !filters.price_sort && !filters.mileage_sort && !filters.drop_sort
          ? "1"
          : ""),
    }),
    // Inventory changes frequently (see llms.txt note written earlier) --
    // this is not content that should be statically cached across visitors.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`allcarsnew request failed: ${res.status}`);
  }
  return res.json();
}

function firstParam(
  params: { [key: string]: string | string[] | undefined },
  key: string,
): string {
  const v = params[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function allParams(
  params: { [key: string]: string | string[] | undefined },
  key: string,
): string[] {
  const v = params[key];
  if (Array.isArray(v)) return v;
  if (v) return [v];
  return [];
}

function pageHref(filters: Filters, searchChips: string[], versionChips: string[], page: number): string {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  searchChips.forEach((c) => qs.append("searchChips", c));
  versionChips.forEach((c) => qs.append("versionChips", c));
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/used-cars?${s}` : "/used-cars";
}

function sortParamsToLabel(priceSort: string, mileageSort: string, dropSort = "", savingSort = ""): string {
  if (savingSort) return "saving_big";
  if (dropSort) return "drop_big";
  if (priceSort === "low") return "price_low";
  if (priceSort === "high") return "price_high";
  if (mileageSort === "low") return "mileage_low";
  if (mileageSort === "high") return "mileage_high";
  return "";
}

export default async function UsedCarsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters: Filters = {
    Make: firstParam(params, "Make"),
    Model: firstParam(params, "Model"),
    Fuel: firstParam(params, "Fuel"),
    body_style: firstParam(params, "body_style"),
    transmission_type: firstParam(params, "transmission_type"),
    seats: firstParam(params, "seats"),
    color: firstParam(params, "color"),
    minEnginesize: firstParam(params, "minEnginesize"),
    maxEnginesize: firstParam(params, "maxEnginesize"),
    minYear: firstParam(params, "minYear"),
    maxYear: firstParam(params, "maxYear"),
    // Absolute floor: even a hand-typed ?minPrice=5000 URL cannot dip below
    // the €15k public-display rule.
    minPrice: firstParam(params, "minPrice"),
    maxPrice: firstParam(params, "maxPrice"),
    minMileage: firstParam(params, "minMileage"),
    maxMileage: firstParam(params, "maxMileage"),
    price_sort: firstParam(params, "price_sort"),
    mileage_sort: firstParam(params, "mileage_sort"),
    drop_sort: firstParam(params, "drop_sort"),
    bestseller: firstParam(params, "bestseller"),
    min_saving: firstParam(params, "min_saving").replace(/\D/g, ""),
    below_cheapest: firstParam(params, "below_cheapest") ? "1" : "",
    saving_sort: firstParam(params, "saving_sort") ? "1" : "",
  };
  const searchChips = allParams(params, "searchChips");
  const versionChips = allParams(params, "versionChips");
  // Inside the badge set the default order is biggest saving first (see
  // savingfilter in getCars); the sort box must say so, or the buyer sees
  // an order with no name on it.
  const currentSort =
    sortParamsToLabel(filters.price_sort, filters.mileage_sort, filters.drop_sort, filters.saving_sort) ||
    ((filters.bestseller || filters.min_saving || filters.below_cheapest) ? "saving_big" : "");

  const requestedPage = Number(firstParam(params, "page")) || 1;
  const page = Math.max(1, Math.floor(requestedPage));

  // Every dropdown describes the cars matching the applied filters (with the
  // Bestseller toggle that means the badge set — the owner once picked
  // "abarth (198)" off a full-stock count and got 0 results). Same body the
  // listing query uses, so counts and tiles sit on one population.
  const facetFull: Record<string, unknown> = {
    ...FACET_FILTER_BODY,
    Make: filters.Make,
    Model: filters.Model,
    Fuel: filters.Fuel,
    body_style: filters.body_style,
    transmission_type: filters.transmission_type,
    seats: filters.seats,
    color: filters.color,
    minEnginesize: filters.minEnginesize,
    maxEnginesize: filters.maxEnginesize,
    minYear: filters.minYear,
    maxYear: filters.maxYear,
    minPrice: filters.minPrice || FACET_FILTER_BODY.minPrice,
    maxPrice: filters.maxPrice,
    minMileage: filters.minMileage,
    maxMileage: filters.maxMileage,
    search: searchChips.join(" "),
    searchChips,
    version: versionChips.join(" "),
    versionChips,
    bestsellerSeries: filters.bestseller,
    minSaving: filters.min_saving,
    belowCheapest: filters.below_cheapest,
    dropfilter: filters.drop_sort,
  };
  const [{ data }, makes, models, fuels, bodyStyles, transmissions, seatsOptions, colours, engines] =
    await Promise.all([
      getCars(filters, searchChips, versionChips, page),
      postFacet("makes", facetFull),
      filters.Make ? postFacet("models", facetFull) : Promise.resolve([] as FacetOption[]),
      postFacet("fuel-types", facetFull),
      postFacet("body-styles", facetFull),
      postFacet("transmission-types", facetFull),
      postFacet("seats", facetFull),
      postFacet("colors", facetFull),
      postFacet("engine-types", facetFull),
    ]);
  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const prevHref = currentPage > 1 ? pageHref(filters, searchChips, versionChips, currentPage - 1) : null;
  const nextHref = currentPage < totalPages ? pageHref(filters, searchChips, versionChips, currentPage + 1) : null;

  // Forces a clean remount of FilterBar whenever the applied URL state
  // changes (Apply, Clear all, pagination, a shared link) -- otherwise React
  // reuses the existing client component instance and its local filter
  // state/dirty flag would keep showing whatever the user had mid-edit.
  const stateKey = JSON.stringify({ filters, searchChips, versionChips, currentSort, page: currentPage });

  // ONE number across the site (owner requirement): the unfiltered headline
  // uses the same shared cached canonical count as the homepage
  // (getStockCount) so the two pages can never disagree. Once the user
  // filters, the count is a live filter-result figure and may differ.
  // Irish-registered (Above Board Cars) cars: a toggle that exists only while there is at
  // least one such car, and a grid shown when it is on (owner, 6 Sep).
  const irish = await irishListings().catch(() => []);
  const irishOn = firstParam(params, "irish") === "1";
  const isDefaultView = Object.keys(params).filter((k) => k !== "page").length === 0;
  // Either source can come back null when the API is briefly slow or a count
  // query times out; rendering null crashed the whole page with a 500
  // (seen live 2026-08-04). Fall back rather than fail.
  // On the default view a missing count means the API failed — show no figure
  // at all rather than "Total vehicles: 0". Under a filter, 0 is a real answer
  // ("nothing matches") and must still be shown.
  const displayCount = isDefaultView
    ? await getStockCount()
    : ((data.count as number | null) ?? 0);

  // 2026-08-11 (audit: mobile LCP 4.2s, "delayed LCP-request discovery"):
  // tell the browser about the first card's image from the initial HTML,
  // before hydration or any client fetch runs.
  // Guard (2026-08-18, Lighthouse errors-in-console): a car scraped minutes
  // ago can top the default sort before its images finish uploading to the
  // bucket, and preloading its missing main.webp logs a 404 on every page
  // view. thumb_v is set only once the thumbnail exists, which proves the
  // image pipeline has completed for this car - preload only then.
  const firstCar = data.cars[0];
  const lcpImage = firstCar?.thumb_v ? firstCar.featured_image : undefined;
  if (lcpImage) preload(lcpImage, { as: "image", fetchPriority: "high" });

  return (
    <main className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(USED_CARS_JSONLD) }}
      />
      <h1 className={styles.heading}>Used cars for sale</h1>
      {displayCount !== null && (
        <p className={styles.count}>
          {isDefaultView ? "Total vehicles" : "Vehicles matching your filters"}:{" "}
          {displayCount.toLocaleString("en-IE")}
        </p>
      )}
      {irish.length > 0 && (
        <p style={{ margin: "0 0 10px" }}>
          <a href={irishOn ? "/used-cars" : "/used-cars?irish=1"}
             style={{ display: "inline-block", padding: "6px 12px", borderRadius: 999, border: "1px solid #0a7d33",
                      background: irishOn ? "#0a7d33" : "#fff", color: irishOn ? "#fff" : "#0a7d33", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            {irishOn ? "✓ " : ""}Irish registered ({irish.length})
          </a>
        </p>
      )}
      {irishOn && irish.length > 0 && (
        <section style={{ margin: "0 0 18px" }}>
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Irish registered cars &mdash; sold privately, Above Board Cars protected</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {irish.map((c) => (
              <a key={c.id} href={`/irish-cars/${c.id}`} style={{ display: "block", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", color: "inherit", textDecoration: "none" }}>
                {c.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photos[0]} alt={c.title} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }} />
                ) : null}
                <div style={{ padding: "8px 10px 10px" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a7d33", fontWeight: 700 }}>Irish registered</div>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>{c.mileage != null ? `${c.mileage.toLocaleString("en-IE")} ${c.mileageUnit}` : ""}</div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>{c.priceEur ? "€" + Math.round(c.priceEur).toLocaleString("en-IE") : "Price on application"}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Pre-paint veil: if this load is a deep-scroll return, hide the
          grid area during HTML parse — before hydration exists — so the
          fresh top-of-list can never flash. FilterBar lands the saved
          position and lifts it; the timeout is the parse-side failsafe. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var r=sessionStorage.getItem(\"ucScrollReturn\");if(r){var s=JSON.parse(r);if(s&&s.q===location.search&&Date.now()-(s.t||0)<1800000){document.documentElement.classList.add(\"uc-veil\");setTimeout(function(){document.documentElement.classList.remove(\"uc-veil\")},800);}}}catch(e){}",
        }}
      />
      <FilterBar
        key={stateKey}
        initialMakes={keepSelected(makes, filters.Make)}
        initialModels={keepSelected(models, filters.Model)}
        initialFuels={keepSelected(fuels, filters.Fuel)}
        initialBodyStyles={keepSelected(bodyStyles, filters.body_style)}
        initialTransmissions={keepSelected(transmissions, filters.transmission_type)}
        initialSeats={keepSelected(seatsOptions, filters.seats)}
        initialColours={keepSelected(colours, filters.color)}
        initialEngines={keepSelected(keepSelected(engines, filters.minEnginesize), filters.maxEnginesize)}
        currentMake={filters.Make}
        currentModel={filters.Model}
        currentFuel={filters.Fuel}
        currentBodyStyle={filters.body_style}
        currentTransmission={filters.transmission_type}
        currentSeats={filters.seats}
        currentColor={filters.color}
        currentMinEnginesize={filters.minEnginesize}
        currentMaxEnginesize={filters.maxEnginesize}
        currentMinYear={filters.minYear}
        currentMaxYear={filters.maxYear}
        currentMinPrice={filters.minPrice}
        currentMaxPrice={filters.maxPrice}
        currentMinMileage={filters.minMileage}
        currentMaxMileage={filters.maxMileage}
        currentSearchChips={searchChips}
        currentVersionChips={versionChips}
        currentSort={currentSort}
        currentBestseller={filters.bestseller}
        currentMinSaving={filters.min_saving}
        currentBelowCheapest={filters.below_cheapest}
        initialCars={data.cars.map(toTileCar)}
        initialCount={data.count}
        currentPage={currentPage}
        totalPages={totalPages}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </main>
  );
}
