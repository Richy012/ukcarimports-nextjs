// Server Component -- same SSR approach as /used-cars: real data in the
// initial HTML response instead of waiting on a full SPA boot.
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

interface CarImage {
  id: number;
  image: string;
}

interface CarInfo {
  final_price?: number;
  duty_applied?: boolean;
}

interface CarDetail {
  car_id: string;
  car_name: string;
  make_name: string;
  model_name: string;
  fuel_type_name: string;
  transmission_name: string;
  body_style_name: string;
  color_name: string;
  registration_date: string;
  mileage: string;
  engine: string;
  seats: string;
  featured_image: string;
  decoded_images: CarImage[];
  features_options: string[];
  car_info?: CarInfo;
}

interface ApiResponse {
  data: CarDetail;
}

async function getCar(id: string): Promise<CarDetail | null> {
  const res = await fetch(`${API_BASE}/get-car2new/${id}`, {
    // Same reasoning as /used-cars -- price/availability can change, this
    // is not content to serve stale from a shared cache.
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`get-car2new request failed: ${res.status}`);
  }
  const json: ApiResponse = await res.json();
  return json.data ?? null;
}

function buildCarYear(registrationDate: string): string {
  if (!registrationDate) return "";
  const parts = registrationDate.split("/");
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

function titleCase(s: string): string {
  if (!s) return "";
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const car = await getCar(id);

  if (!car) {
    notFound();
  }

  const year = buildCarYear(car.registration_date);
  const km = formatKm(car.mileage);
  const finalPrice = car.car_info?.final_price;
  const thumbnails = car.decoded_images.slice(0, 8);

  const specs = [
    year && { label: "Year", value: year },
    car.body_style_name && { label: "Body", value: car.body_style_name },
    car.fuel_type_name && { label: "Fuel", value: car.fuel_type_name },
    car.transmission_name && { label: "Transmission", value: car.transmission_name },
    km && { label: "Mileage", value: `${km} km` },
    car.engine && { label: "Engine", value: car.engine },
    car.seats && { label: "Seats", value: car.seats },
    car.color_name && { label: "Colour", value: titleCase(car.color_name) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className={styles.main}>
      <Link href="/used-cars" className={styles.backLink}>
        &larr; Back to all cars
      </Link>

      <h1 className={styles.heading}>{car.car_name}</h1>

      <div className={styles.layout}>
        <div className={styles.gallery}>
          <img
            src={car.featured_image}
            alt={car.car_name}
            width={800}
            height={600}
            fetchPriority="high"
            decoding="async"
            className={styles.heroImage}
          />
          {thumbnails.length > 0 && (
            <div className={styles.thumbRow}>
              {thumbnails.map((img) => (
                <img
                  key={img.id}
                  src={img.image}
                  alt=""
                  width={120}
                  height={90}
                  loading="lazy"
                  decoding="async"
                  className={styles.thumb}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.summary}>
          {finalPrice != null && (
            <div className={styles.priceBox}>
              <div className={styles.price}>€{formatEuro(finalPrice)}</div>
              <div className={styles.priceNote}>VRT &amp; duty included</div>
            </div>
          )}

          <dl className={styles.specGrid}>
            {specs.map((s) => (
              <div key={s.label} className={styles.specRow}>
                <dt className={styles.specLabel}>{s.label}</dt>
                <dd className={styles.specValue}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {car.features_options.length > 0 && (
        <section className={styles.features}>
          <h2 className={styles.featuresHeading}>Features &amp; Options</h2>
          <ul className={styles.featuresList}>
            {car.features_options.map((f) => (
              <li key={f} className={styles.featureItem}>
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
