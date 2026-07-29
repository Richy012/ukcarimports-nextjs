// Server Component -- runs entirely on the server, no client JS needed to
// produce the HTML. This is the actual fix for the ~9s mobile LCP: the
// browser gets real car data in the initial HTML response instead of an
// empty <div id="root"> that waits on a full SPA boot before anything paints.
import Link from "next/link";
import FilterBar from "./FilterBar";
import CarThumb from "./CarThumb";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";
const PAGE_SIZE = 25;

const FACET_FILTER_BODY = {
  is_manheim_car: "0",
  premium_car: 0,
  minPrice: "",
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

interface FacetOption {
  label: string;
  total: number;
}

async function postFacet(path: string) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(FACET_FILTER_BODY),
    cache: "no-store",
  });
  return res.json();
}

interface Car {
  car_id: string;
  car_name: string;
  featured_image: string;
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
  price_sort: string;
  mileage_sort: string;
}

async function getCars(filters: Filters, pageNum: number): Promise<ApiResponse> {
  const res = await fetch(`${API_BASE}/allcarsnew/0/10`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      is_manheim_car: "0",
      premium_car: "0",
      minPrice: "",
      maxPrice: "",
      minYear: "",
      maxYear: "",
      Make: filters.Make,
      Model: filters.Model,
      Fuel: filters.Fuel,
      seats: "",
      body_style: filters.body_style,
      Condition: "",
      minMileage: "",
      maxMileage: "",
      minEnginesize: "",
      maxEnginesize: "",
      transmission_type: filters.transmission_type,
      engine: "",
      pagenum: pageNum,
      limit: PAGE_SIZE,
      price_sort: filters.price_sort,
      mileage_sort: filters.mileage_sort,
      color: "",
      vrt: "",
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

function buildCarYear(car: Car): string {
  if (!car.registration_date) return "";
  const parts = car.registration_date.split("/");
  if (parts.length < 3) return "";
  const year = parts[2];
  const month = Number(parts[1]);
  const half = month > 6 ? 2 : 1;
  return `${year} (${year.slice(2)}${half})`;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

function formatKm(mileageMiles: string): string | null {
  const miles = Number(mileageMiles.replace(/\D/g, ""));
  if (!miles) return null;
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(
    Math.round(miles * 1.60934),
  );
}

function firstParam(
  params: { [key: string]: string | string[] | undefined },
  key: string,
): string {
  const v = params[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function pageHref(filters: Filters, page: number): string {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/used-cars?${s}` : "/used-cars";
}

function sortParamsToLabel(priceSort: string, mileageSort: string): string {
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
    price_sort: firstParam(params, "price_sort"),
    mileage_sort: firstParam(params, "mileage_sort"),
  };
  const activeFilters = Object.entries(filters)
    .filter(([k]) => k !== "price_sort" && k !== "mileage_sort")
    .filter(([, v]) => v);
  const currentSort = sortParamsToLabel(filters.price_sort, filters.mileage_sort);

  const requestedPage = Number(firstParam(params, "page")) || 1;
  const page = Math.max(1, Math.floor(requestedPage));

  const [{ data }, makesData, fuelsData, bodyStylesData, transmissionsData] =
    await Promise.all([
      getCars(filters, page),
      postFacet("makes"),
      postFacet("fuel-types"),
      postFacet("body-styles"),
      postFacet("transmission-types"),
    ]);
  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const makes: FacetOption[] = (makesData.make || [])
    .filter((m: { make: string }) => m.make)
    .map((m: { make: string; total: number }) => ({ label: m.make, total: m.total }));
  const fuels: FacetOption[] = (fuelsData.fuel_type || [])
    .filter((f: { fuel_type: string }) => f.fuel_type)
    .map((f: { fuel_type: string; total: number }) => ({ label: f.fuel_type, total: f.total }));
  const bodyStyles: FacetOption[] = (bodyStylesData.body_style || [])
    .filter((b: { body_style: string }) => b.body_style)
    .map((b: { body_style: string; total: number }) => ({ label: b.body_style, total: b.total }));
  const transmissions: FacetOption[] = (transmissionsData.transmission || [])
    .filter((t: { car_transmission: string }) => t.car_transmission)
    .map((t: { car_transmission: string; total: number }) => ({
      label: t.car_transmission,
      total: t.total,
    }));

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Used cars for sale</h1>
      <p className={styles.count}>Total vehicles: {data.count.toLocaleString("en-IE")}</p>

      <FilterBar
        initialMakes={makes}
        initialFuels={fuels}
        initialBodyStyles={bodyStyles}
        initialTransmissions={transmissions}
        currentMake={filters.Make}
        currentModel={filters.Model}
        currentFuel={filters.Fuel}
        currentBodyStyle={filters.body_style}
        currentTransmission={filters.transmission_type}
        currentSort={currentSort}
        initialCount={data.count}
      />

      {activeFilters.length > 0 && (
        <div className={styles.activeFilters}>
          <span>Filtered by: {activeFilters.map(([, v]) => v).join(", ")}</span>
        </div>
      )}

      <div className={styles.grid}>
        {data.cars.map((car, index) => {
          const year = buildCarYear(car);
          const km = formatKm(car.mileage);
          const finalPrice = car.car_info?.final_price;
          const imageUrl = `${API_BASE}/car-thumb/${car.car_id}`;

          return (
            <a key={car.car_id} href={`/car/${car.car_id}`} className={styles.card}>
              <CarThumb src={imageUrl} alt={car.car_name} priority={index < 4} />
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{car.car_name}</div>
                <div className={styles.chips}>
                  {year && <span className={styles.chip}>{year}</span>}
                  {car.transmission_name && (
                    <span className={styles.chip}>{car.transmission_name}</span>
                  )}
                  {car.fuel_type_name && (
                    <span className={styles.chip}>{car.fuel_type_name}</span>
                  )}
                  {km && <span className={styles.chip}>{km} km</span>}
                </div>
              </div>
              <div className={styles.cardPrice}>
                {finalPrice != null ? `€${formatEuro(finalPrice)}` : ""}
              </div>
            </a>
          );
        })}
      </div>

      {data.cars.length === 0 && (
        <p className={styles.noResults}>No cars match these filters.</p>
      )}

      {data.cars.length > 0 && totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          {currentPage > 1 ? (
            <Link href={pageHref(filters, currentPage - 1)} className={styles.pageLink}>
              &larr; Previous
            </Link>
          ) : (
            <span className={styles.pageLinkDisabled}>&larr; Previous</span>
          )}

          <span className={styles.pageStatus}>
            Page {currentPage.toLocaleString("en-IE")} of {totalPages.toLocaleString("en-IE")}
          </span>

          {currentPage < totalPages ? (
            <Link href={pageHref(filters, currentPage + 1)} className={styles.pageLink}>
              Next &rarr;
            </Link>
          ) : (
            <span className={styles.pageLinkDisabled}>Next &rarr;</span>
          )}
        </nav>
      )}
    </main>
  );
}
