// Server Component -- runs entirely on the server, no client JS needed to
// produce the HTML. This is the actual fix for the ~9s mobile LCP: the
// browser gets real car data in the initial HTML response instead of an
// empty <div id="root"> that waits on a full SPA boot before anything paints.
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

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

async function getCars(): Promise<ApiResponse> {
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
      limit: 25,
      pricefilter: "",
      mileagefilter: "",
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

export default async function UsedCarsPage() {
  const { data } = await getCars();

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Used cars for sale</h1>
      <p className={styles.count}>Total vehicles: {data.count.toLocaleString("en-IE")}</p>

      <div className={styles.grid}>
        {data.cars.map((car, index) => {
          const year = buildCarYear(car);
          const km = formatKm(car.mileage);
          const finalPrice = car.car_info?.final_price;
          const imageUrl = `${API_BASE}/car-thumb/${car.car_id}`;

          return (
            <a key={car.car_id} href={`/car/${car.car_id}`} className={styles.card}>
              <img
                src={imageUrl}
                alt={car.car_name}
                width={280}
                height={210}
                loading={index < 4 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
                className={styles.cardImage}
              />
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
    </main>
  );
}
