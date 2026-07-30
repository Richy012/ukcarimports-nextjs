// Server Component -- same SSR approach as /used-cars: real data in the
// initial HTML response instead of waiting on a full SPA boot.
import Link from "next/link";
import { notFound } from "next/navigation";
import PriceBreakdown from "./PriceBreakdown";
import CarGallery from "./CarGallery";
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
  interior_feat?: string[] | string;
  exterior_feat?: string[] | string;
  safety_feat?: string[] | string;
  performance_spec?: string[] | string;
  driver_convenience_feat?: string[] | string;
  technical_feat?: string[] | string;
  equipment_declaration?: string;
}

// The API sends the grouped feature fields as JSON-encoded strings
// ('["Emergency Braking",...]'), exactly as the legacy SPA consumed them.
// Accept both shapes so a future API change to real arrays keeps working.
function parseFeatureList(v?: string[] | string): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string" && x.trim() !== "");
    } catch {
      /* fall through */
    }
  }
  return [];
}

// Irish annual motor tax from CO2, per the two statutory schedules:
// NEDC bands for cars first registered 1 Jul 2008 - 31 Dec 2020, WLTP bands
// from 1 Jan 2021 (source verified against the published rate tables,
// owner-approved 2026-07-30). EVs are a flat EUR 120. Pre-2008 cars are
// engine-cc based and out of scope (returns null).
function irishMotorTax(co2Raw: string | undefined, regYear: number | null, isElectric: boolean): number | null {
  if (isElectric) return 120;
  if (!co2Raw || regYear === null || regYear < 2008) return null;
  const co2 = parseInt(co2Raw, 10);
  if (Number.isNaN(co2)) return null;
  const nedc: [number, number][] = [
    [1, 120], [80, 170], [100, 180], [110, 190], [120, 200], [130, 270],
    [140, 280], [155, 400], [170, 600], [190, 790], [225, 1250],
  ];
  const wltp: [number, number][] = [
    [0, 120], [50, 140], [80, 150], [90, 160], [100, 170], [110, 180],
    [120, 190], [130, 200], [140, 210], [150, 270], [160, 280], [170, 420],
    [190, 600], [200, 790], [225, 1250],
  ];
  const bands = regYear >= 2021 ? wltp : nedc;
  for (const [max, rate] of bands) {
    if (co2 <= max) return rate;
  }
  return 2400;
}

function regYearOf(car: CarDetail): number | null {
  const m = (car.registration_date || "").match(/(\d{4})/);
  if (m) return parseInt(m[1], 10);
  const y = (car.car_name || "").match(/\b(20\d{2})\b/);
  return y ? parseInt(y[1], 10) : null;
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
    (() => {
      const tax = irishMotorTax(
        car.co2_emission,
        regYearOf(car),
        (car.fuel_type_name || "").toLowerCase() === "electric"
      );
      return tax !== null && { label: "Motor Tax (annual)", value: `€${tax.toLocaleString()}` };
    })(),
    car.co2_emission && { label: "CO2 Emissions", value: car.co2_emission },
    car.owner && { label: "Number of Owners", value: car.owner },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className={styles.main}>
      <Link href="/used-cars" className={styles.backLink}>
        &larr; Back to all cars
      </Link>

      <h1 className={styles.heading}>{car.car_name}</h1>

      <div className={styles.layout}>
        <CarGallery heroSrc={car.featured_image} carName={car.car_name} photos={allPhotos} />

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
          const equipment = (car.equipment_declaration ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s !== "");
          const featureGroups = [
            { label: "Safety", items: parseFeatureList(car.safety_feat) },
            { label: "Exterior", items: parseFeatureList(car.exterior_feat) },
            { label: "Interior", items: parseFeatureList(car.interior_feat) },
            { label: "Driver Convenience", items: parseFeatureList(car.driver_convenience_feat) },
            { label: "Technical", items: parseFeatureList(car.technical_feat) },
          ].filter((g) => g.items.length > 0);
          const performance = parseFeatureList(car.performance_spec);
          const hasPerformance = performance.length > 0;
          if (equipment.length === 0 && featureGroups.length === 0 && !hasPerformance && car.features_options.length === 0)
            return null;

          return (
            <details className={styles.signpost}>
              <summary className={styles.signpostSummary}>Full Specification &amp; Features</summary>
              <div className={styles.signpostBody}>
                {hasPerformance && (
                  <div className={styles.featureGroup}>
                    <h3>Performance</h3>
                    <dl className={styles.specGrid}>
                      {performance.map((raw) => {
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
                {equipment.length > 0 && (
                  <div className={styles.featureGroup}>
                    <h3>Equipment ({equipment.length})</h3>
                    <ul className={styles.featuresList}>
                      {equipment.map((f) => (
                        <li key={f} className={styles.featureItem}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {featureGroups.map((g) => (
                  <div key={g.label} className={styles.featureGroup}>
                    <h3>
                      {g.label} ({g.items.length})
                    </h3>
                    <ul className={styles.featuresList}>
                      {g.items.map((f) => (
                        <li key={f} className={styles.featureItem}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {equipment.length === 0 && featureGroups.length === 0 && !hasPerformance && car.features_options.length > 0 && (
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

        {car.co2_emission && (() => {
          const motorTax = irishMotorTax(
            car.co2_emission,
            regYearOf(car),
            (car.fuel_type_name || "").toLowerCase() === "electric"
          );
          const mpgRaw = parseFeatureList(car.performance_spec).find((s) =>
            s.toLowerCase().startsWith("miles per gallon")
          );
          const mpgMatch = mpgRaw ? mpgRaw.match(/([\d.]+)\s*mpg/i) : null;
          const mpg = mpgMatch ? parseFloat(mpgMatch[1]) : null;

          return (
            <details className={styles.signpost}>
              <summary className={styles.signpostSummary}>Running Costs</summary>
              <div className={styles.signpostBody}>
                <dl className={styles.specGrid}>
                  {motorTax !== null && (
                    <div className={styles.specRow}>
                      <dt className={styles.specLabel}>Motor Tax (annual)</dt>
                      <dd className={styles.specValue}>€{motorTax.toLocaleString()}</dd>
                    </div>
                  )}
                  <div className={styles.specRow}>
                    <dt className={styles.specLabel}>CO2 Emissions</dt>
                    <dd className={styles.specValue}>{car.co2_emission}</dd>
                  </div>
                  {mpg !== null && (
                    <div className={styles.specRow}>
                      <dt className={styles.specLabel}>Fuel consumption</dt>
                      <dd className={styles.specValue}>
                        {mpg} mpg ({(282.48 / mpg).toFixed(1)} L/100km)
                      </dd>
                    </div>
                  )}
                </dl>
                <p className={styles.signpostNote}>
                  VRT and NOx levy for this CO2 figure are already included in the price above. Motor
                  tax is calculated from the official CO2 band for this car&apos;s registration date
                  ({regYearOf(car) !== null && regYearOf(car)! >= 2021 ? "WLTP" : "NEDC"} schedule).
                </p>
              </div>
            </details>
          );
        })()}

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
