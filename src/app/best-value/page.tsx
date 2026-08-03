import type { Metadata } from "next";
import Link from "next/link";
import styles from "../page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "The Bestseller Series — UK Imports Priced Under the Irish Market",
  description:
    "Live UK cars, fully landed for Ireland, priced at least €2,500 under the real Irish market — matched to a real Irish ad or the Irish median for the exact model and year. Refreshed weekly, checked live.",
};

interface BestValueCar {
  car_id: string;
  car_name: string;
  featured_image: string;
  car_info?: { final_price?: number };
  best_value: {
    tier: "bestseller" | "number_one" | "trending";
    saving_eur: number;
    saving_pct: number | null;
    irish_price: number | null;
    basis: "matched" | "segment" | "both";
    snapshot_date: string;
  };
}

// Euro-first badge text, same conventions as the listing tiles: full tiers
// state the live figure, Trending hedges (rounded €500, "around").
function badgeText(bv: BestValueCar["best_value"]): string {
  const sav = Math.round(bv.saving_eur);
  if (bv.tier === "number_one") return `#1 Bestseller — €${sav.toLocaleString()} less than in Ireland`;
  if (bv.tier === "bestseller") return `Bestseller — €${sav.toLocaleString()} less than in Ireland`;
  const rounded = Math.round(sav / 500) * 500;
  return rounded >= 1000
    ? `Trending Bestseller — around €${rounded.toLocaleString()} less in Ireland`
    : "Trending Bestseller";
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
        <h1 className={styles.sectionTitle}>The Bestseller Series</h1>
        <p className={styles.sectionSub}>
          {count.toLocaleString()}
          {" live cars priced at least €2,500 under the Irish market — matched directly "}
          to a real Irish ad, or priced against the Irish median asking price for their
          exact model and year (10 or more real listings). €5,000+ makes a{" "}
          <strong>#1 Bestseller</strong>. Refreshed weekly, savings checked live;
          our prices fully landed: VRT, VAT, customs &amp; delivery included.
          Irish figures are asking prices; ours is the final price.
        </p>
        <div className={styles.arrivalGrid}>
          {cars.map((c) => (
            <div key={c.car_id} className={styles.valueItem}>
            <Link href={`/car/${c.car_id}`} className={styles.arrivalCard}>
              <span className={styles.valueBadge}>{badgeText(c.best_value)}</span>
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
            <Link href={`/best-value/why/${c.car_id}`} className={styles.valueWhy}>
              The maths behind this deal &rarr;
            </Link>
            </div>
          ))}
        </div>
        <p className={styles.arrivalsMore}>
          <Link href="/used-cars">Browse the full stocklist &rarr;</Link>
        </p>
      </div>
    </main>
  );
}
