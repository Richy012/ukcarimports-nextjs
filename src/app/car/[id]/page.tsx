// Server Component -- same SSR approach as /used-cars: real data in the
// initial HTML response instead of waiting on a full SPA boot.
import Link from "next/link";
import { notFound } from "next/navigation";
import PriceBreakdown from "./PriceBreakdown";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

interface CarImage {
  id: number;
  image: string;
}

interface CarInfo {
  converted_price: number;
  shipping_fee: number;
  customs_agent_fee: number;
  after_irish_vat: number;
  fee: number;
  final_price: number;
  before_vrt_final_price?: number;
  duty_applied: boolean;
  mechanical_inspection_fee: number;
  warranty_premium_max_eligible: boolean;
  warranty_premium_plus_eligible: boolean;
  warranty_premium_component_eligible: boolean;
  warranty_premium_powertrain_eligible: boolean;
  warranty_premium_ev_eligible: boolean;
}

interface RelatedCar {
  car_id: string;
  car_name: string;
  featured_image: string;
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
  car_door?: string;
  owner?: string;
  auction_company_name?: string;
  featured_image: string;
  decoded_images: CarImage[];
  features_options: string[];
  car_info?: CarInfo;
  vrt_rate?: number;
  relatedcars?: RelatedCar[];
  service_history?: number;
  last_service?: string;
  last_service_mileage?: string;
  mot_date?: string;
  total_service?: string;
  co2_emission?: string;
  interior_feat?: string[];
  exterior_feat?: string[];
  safety_feat?: string[];
  performance_spec?: string[];
  driver_convenience_feat?: string[];
  technical_feat?: string[];
}

function splitSpecPair(raw: string): { label: string; value: string } {
  // performance_spec entries come through as a label glued directly to its
  // value with no separator (e.g. "Top speed154mph") -- split at the
  // letter-to-digit boundary, which reliably marks that junction.
  const match = raw.match(/^(.*?[a-zA-Z])(\d.*)$/);
  return match ? { label: match[1], value: match[2] } : { label: raw, value: "" };
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
  const allPhotos = (car.decoded_images ?? []).filter((img) => img && img.image);
  const thumbnails = allPhotos.slice(0, 4);
  const extraPhotosCount = Math.max(0, allPhotos.length - 4);
  const relatedCars = (car.relatedcars ?? []).filter((c) => c.featured_image).slice(0, 4);

  const specs = [
    year && { label: "Year", value: year },
    car.body_style_name && { label: "Body", value: car.body_style_name },
    car.fuel_type_name && { label: "Fuel", value: car.fuel_type_name },
    car.transmission_name && { label: "Transmission", value: car.transmission_name },
    car.car_door && { label: "Doors", value: car.car_door },
    km && { label: "Mileage", value: `${km} km` },
    car.engine && { label: "Engine", value: car.engine },
    car.seats && { label: "Seats", value: car.seats },
    car.color_name && { label: "Colour", value: titleCase(car.color_name) },
    car.owner && { label: "Number of Owners", value: car.owner },
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
            <div className={styles.photoGrid}>
              {thumbnails.map((img, i) => {
                const isLast = i === thumbnails.length - 1;
                return (
                  <div key={img.id} className={styles.photoGridItem}>
                    <img
                      src={img.image}
                      alt=""
                      width={260}
                      height={140}
                      loading="lazy"
                      decoding="async"
                      className={styles.thumb}
                    />
                    {isLast && extraPhotosCount > 0 && (
                      <div className={styles.morePhotosOverlay}>+{extraPhotosCount} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.summary}>
          {car.car_info && (
            <PriceBreakdown
              carId={car.car_id}
              carName={car.car_name}
              carInfo={car.car_info}
              vrtRate={car.vrt_rate ?? 0}
              fuelTypeName={car.fuel_type_name}
            />
          )}

          <dl className={styles.specGrid}>
            {specs.map((s) => (
              <div key={s.label} className={styles.specRow}>
                <dt className={styles.specLabel}>{s.label}</dt>
                <dd className={styles.specValue}>{s.value}</dd>
              </div>
            ))}
            <div className={styles.specRow}>
              <dt className={styles.specLabel}>MOT History</dt>
              <dd className={styles.specValue}>
                <a href="https://www.check-mot.service.gov.uk/" target="_blank" rel="noreferrer" className={styles.specLink}>
                  Check
                </a>
              </dd>
            </div>
            <div className={styles.specRow}>
              <dt className={styles.specLabel}>Mechanical &amp; Condition Report</dt>
              <dd className={styles.specValue}>
                <a href={`${API_BASE}/report/Mech_And_Cond_Report.pdf`} target="_blank" rel="noreferrer" className={styles.specLink}>
                  View
                </a>
              </dd>
            </div>
          </dl>

          {car.auction_company_name && (
            <p className={styles.sellerLine}>Seller/Garage: By {car.auction_company_name}</p>
          )}

          <div className={styles.deliveryBox}>
            <h3 className={styles.deliveryHeading}>Delivery &amp; Collection</h3>
            <p>
              Every car we sell is imported, duty/VRT-processed, and delivered
              by us directly — collect from our Sandyford, Dublin office, or
              arrange home delivery nationwide.
            </p>
          </div>

          <ul className={styles.historyChecklist}>
            <li>✓ History checked before purchase</li>
            <li>✓ Inspected after deposit</li>
            {car.service_history ? (
              <li>
                ✓ Service history
                {car.last_service ? ` — last serviced ${car.last_service}` : ""}
                {car.last_service_mileage ? ` at ${car.last_service_mileage} km` : ""}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <section className={styles.signposts}>
        {(() => {
          const featureGroups = [
            { label: "Interior", items: car.interior_feat },
            { label: "Exterior", items: car.exterior_feat },
            { label: "Safety & Security", items: car.safety_feat },
            { label: "Driver Convenience", items: car.driver_convenience_feat },
            { label: "Technical", items: car.technical_feat },
          ].filter((g) => Array.isArray(g.items) && g.items.length > 0);
          const hasPerformance = Array.isArray(car.performance_spec) && car.performance_spec.length > 0;
          if (featureGroups.length === 0 && !hasPerformance && car.features_options.length === 0) return null;

          return (
            <details className={styles.signpost}>
              <summary className={styles.signpostSummary}>Full Specification &amp; Features</summary>
              <div className={styles.signpostBody}>
                {hasPerformance && (
                  <div className={styles.featureGroup}>
                    <h3>Performance</h3>
                    <dl className={styles.specGrid}>
                      {car.performance_spec!.map((raw) => {
                        const { label, value } = splitSpecPair(raw);
                        return (
                          <div key={raw} className={styles.specRow}>
                            <dt className={styles.specLabel}>{label}</dt>
                            <dd className={styles.specValue}>{value}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}
                {featureGroups.map((g) => (
                  <div key={g.label} className={styles.featureGroup}>
                    <h3>{g.label}</h3>
                    <ul className={styles.featuresList}>
                      {g.items!.map((f) => (
                        <li key={f} className={styles.featureItem}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {featureGroups.length === 0 && !hasPerformance && car.features_options.length > 0 && (
                  <ul className={styles.featuresList}>
                    {car.features_options.map((f) => (
                      <li key={f} className={styles.featureItem}>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          );
        })()}

        {car.co2_emission && (
          <details className={styles.signpost}>
            <summary className={styles.signpostSummary}>Running Costs</summary>
            <div className={styles.signpostBody}>
              <dl className={styles.specGrid}>
                <div className={styles.specRow}>
                  <dt className={styles.specLabel}>CO2 Emissions</dt>
                  <dd className={styles.specValue}>{car.co2_emission}</dd>
                </div>
              </dl>
              <p className={styles.signpostNote}>
                VRT and NOx levy for this CO2 figure are already included in the price above.
              </p>
            </div>
          </details>
        )}

        {(car.service_history || car.mot_date || car.total_service) && (
          <details className={styles.signpost}>
            <summary className={styles.signpostSummary}>Vehicle History</summary>
            <div className={styles.signpostBody}>
              <dl className={styles.specGrid}>
                <div className={styles.specRow}>
                  <dt className={styles.specLabel}>Service history</dt>
                  <dd className={styles.specValue}>{car.service_history ? "Yes" : "No"}</dd>
                </div>
                {car.last_service && (
                  <div className={styles.specRow}>
                    <dt className={styles.specLabel}>Last serviced</dt>
                    <dd className={styles.specValue}>
                      {car.last_service}
                      {car.last_service_mileage ? ` at ${car.last_service_mileage} km` : ""}
                    </dd>
                  </div>
                )}
                {car.total_service && (
                  <div className={styles.specRow}>
                    <dt className={styles.specLabel}>Total services</dt>
                    <dd className={styles.specValue}>{car.total_service}</dd>
                  </div>
                )}
                {car.mot_date && (
                  <div className={styles.specRow}>
                    <dt className={styles.specLabel}>MOT expiry</dt>
                    <dd className={styles.specValue}>{car.mot_date}</dd>
                  </div>
                )}
              </dl>
            </div>
          </details>
        )}
      </section>

      {relatedCars.length > 0 && (
        <section className={styles.related}>
          <h2 className={styles.featuresHeading}>You may also like</h2>
          <div className={styles.relatedGrid}>
            {relatedCars.map((rc) => (
              <Link key={rc.car_id} href={`/car/${rc.car_id}`} className={styles.relatedCard}>
                <img src={rc.featured_image} alt={rc.car_name} width={200} height={150} loading="lazy" />
                <span>{rc.car_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
