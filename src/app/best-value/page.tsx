import type { Metadata } from "next";
import Link from "next/link";
import styles from "../page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Best Value UK Imports — 10%+ Under Irish Prices",
  description:
    "Live UK cars priced fully landed for Ireland that are at least 10% cheaper than the real Irish asking price for an equivalent car. Matched and refreshed weekly.",
};

interface BestValueCar {
  car_id: string;
  car_name: string;
  featured_image: string;
  car_info?: { final_price?: number };
  best_value: {
    saving_pct: number;
    irish_price: number | null;
    basis: "matched" | "segment";
    snapshot_date: string;
  };
}

async function getBestValue() {
  try {
    const res = await fetch(`${API_BASE}/best-value/0/48`, { next: { revalidate: 900 } });
    const json = await res.json();
    const cars: BestValueCar[] = (json?.data?.cars ?? []).filter(
      (c: BestValueCar) => c.featured_image && c.best_value
    );
    return { cars, count: (json?.data?.count ?? 0) as number };
  } catch {
    return { cars: [] as BestValueCar[], count: 0 };
  }
}

export default async function BestValuePage() {
  const { cars, count } = await getBestValue();

  return (
    <main className="wm-green">
      <div className={styles.valueInner}>
        <h1 className={styles.sectionTitle}>Best value vs Ireland</h1>
        <p className={styles.sectionSub}>
          {count.toLocaleString()}
          {" live cars at least 10% cheaper than Irish equivalents — either matched "}
          directly to a real Irish ad, or a model-year whose class averages 10%+ savings
          across 5 or more real comparisons (&ldquo;typically&rdquo;). Refreshed weekly;
          prices fully landed: VRT, VAT, customs &amp; delivery included.
        </p>
        <div className={styles.arrivalGrid}>
          {cars.map((c) => (
            <Link key={c.car_id} href={`/car/${c.car_id}`} className={styles.arrivalCard}>
              <span className={styles.valueBadge}>
                {c.best_value.basis === "segment"
                  ? `Typically ${Math.round(c.best_value.saving_pct)}% under Irish price`
                  : `${Math.round(c.best_value.saving_pct)}% under Irish price`}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.featured_image} alt={c.car_name} loading="lazy" />
              <span className={styles.arrivalName}>{c.car_name}</span>
              <span className={styles.arrivalPrice}>
                {c.car_info?.final_price
                  ? `€${Math.round(c.car_info.final_price).toLocaleString()}`
                  : "POA"}
                <em> all-in</em>
                {c.best_value.irish_price !== null && (
                  <span className={styles.valueIrish}>
                    €{Math.round(c.best_value.irish_price).toLocaleString()} in Ireland
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
        <p className={styles.arrivalsMore}>
          <Link href="/used-cars">Browse the full stocklist &rarr;</Link>
        </p>
      </div>
    </main>
  );
}
