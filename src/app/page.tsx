import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, CarFront } from "lucide-react";
import HomeSearchPanel from "./HomeSearchPanel";
import ProcessTimeline from "./ProcessTimeline";
import { getStockCount } from "@/lib/stockCount";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "UK Car Imports — The Price You See Is The Price You Pay",
  description:
    "Import your next car from the UK: 200,000+ cars priced fully landed for Ireland — VRT, VAT, customs & delivery included. Independent inspection, Irish plates in ~2 weeks. Est. 2013.",
};

interface HomeCar {
  car_id: string;
  car_name: string;
  featured_image: string;
  mileage: string;
  car_info?: { final_price?: number };
}

interface BestValueCar extends HomeCar {
  best_value: {
    saving_pct: number;
    irish_price: number | null;
    basis: "matched" | "segment";
    snapshot_date: string;
  };
}

async function getHomeData() {
  const empty = {
    bestValue: [] as BestValueCar[],
    bvCount: 0,
    count: 0,
    makes: [] as { make: string; slug: string; n: number }[],
  };
  try {
    const [count, indexRes, bvRes] = await Promise.all([
      getStockCount(),
      fetch(`${API_BASE}/import-landing-index`, { next: { revalidate: 3600 } }),
      fetch(`${API_BASE}/best-value/0/4`, { next: { revalidate: 900 } }),
    ]);
    const indexJson = await indexRes.json();
    const bvJson = await bvRes.json();
    const bestValue: BestValueCar[] = (bvJson?.data?.cars ?? []).filter(
      (c: BestValueCar) => c.featured_image && c.best_value
    );
    const bvCount: number = bvJson?.data?.count ?? 0;
    const makes: { make: string; slug: string; n: number }[] = (indexJson?.data?.makes ?? []).slice(0, 8);
    return { bestValue, bvCount, count, makes };
  } catch {
    return empty;
  }
}

const REVIEWS = [
  { name: "Shauna W.", quote: "Just under two weeks from initial contact to the car being delivered." },
  { name: "Declan W.", quote: "Higher spec cars, for cheaper — you can't go wrong." },
  { name: "Galatia C.", quote: "An Irish-plated car, ordered from your computer, within 2 weeks." },
];

export default async function HomePage() {
  const { bestValue, bvCount, count, makes } = await getHomeData();

  return (
    <main>
      <section className={styles.hero}>
        {/* Mobile-only text: on desktop the composite image carries logo + headline */}
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>
            Over {count > 0 ? count.toLocaleString() : "200,000"} cars to choose from
          </p>
          <h1 className={styles.heroHeadline}>
            Importing a car
            <br />
            should feel <em>this simple.</em>
          </h1>
          <div className={styles.heroDash} />
        </div>
        <p className={styles.heroCount}>
          Over {count > 0 ? count.toLocaleString() : "200,000"} cars to choose from
        </p>
        <div className={styles.heroPanelDock}>
          <HomeSearchPanel
            makes={makes.map((m) => ({ make: m.make, n: m.n }))}
            totalCount={count}
          />
        </div>
      </section>

      <section className={styles.trustStrip}>
        <span>
          <BadgeEuro size={16} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
          <strong>The price you see is the price you pay</strong>
        </span>
        <span>
          <span className={styles.stars}>★★★★★</span> <strong>4.6</strong> · 122 Google reviews
        </span>
        <span>
          <CarFront size={16} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Irish plates in ~2 weeks
        </span>
      </section>

      {bestValue.length > 0 && (
        <section className={`${styles.valueBand} wm-green`}>
          <div className={styles.valueInner}>
            <h2 className={styles.sectionTitle}>Best value vs Ireland</h2>
            <p className={styles.sectionSub}>
              Every saving is benchmarked against the real Irish asking price for an equivalent
              car — matched and refreshed weekly.
            </p>
            <div className={styles.arrivalGrid}>
              {bestValue.map((c) => (
                <div key={c.car_id} className={styles.valueItem}>
                <Link href={`/car/${c.car_id}`} className={styles.arrivalCard}>
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
                <Link href={`/best-value/why/${c.car_id}`} className={styles.valueWhy}>
                  The maths behind this deal &rarr;
                </Link>
                </div>
              ))}
            </div>
            <p className={styles.arrivalsMore}>
              <Link href="/best-value">
                {`See all ${bvCount.toLocaleString()} cars 10%+ under Irish prices`} &rarr;
              </Link>
            </p>
          </div>
        </section>
      )}

      <ProcessTimeline />

      <section className={styles.makes}>
        <h2 className={styles.sectionTitle}>Browse by make</h2>
        <div className={styles.makeChips}>
          {makes.map((m) => (
            <Link key={m.slug} href={`/import/${m.slug}`} className={styles.makeChip}>
              {m.make.replace(/\b\w/g, (c) => c.toUpperCase())} <span>{m.n.toLocaleString()}</span>
            </Link>
          ))}
          <Link href="/used-cars" className={styles.makeChipAll}>
            All makes &rarr;
          </Link>
        </div>
      </section>

      <section className={styles.alertBand}>
        <div className={styles.alertBandInner}>
          <div>
            <h2>Haven&apos;t found the one yet?</h2>
            <p>
              Thousands of new cars land every week. Save a search and we&apos;ll email you the
              moment yours arrives — the best ones fly.
            </p>
          </div>
          <Link href="/sign-up" className={styles.alertBandCta}>
            Create my alert
          </Link>
        </div>
      </section>

      <section className={styles.reviews}>
        <h2 className={styles.sectionTitle}>What our customers say</h2>
        <p className={styles.sectionSub}>
          <span className={styles.stars}>★★★★★</span> 4.6 from 122 Google reviews
        </p>
        <div className={styles.reviewGrid}>
          {REVIEWS.map((r) => (
            <figure key={r.name} className={styles.reviewCard}>
              <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption>
                — {r.name} <span>· Posted on Google</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.closingInner}>
          <div>
            <p className={styles.closingLead}>100% online — no showroom, no showroom costs.</p>
            <p className={styles.closingSub}>
              Handover &amp; collection by appointment · Sandyford, Dublin 18 · Est. 2013
            </p>
          </div>
          <Link href="/used-cars" className={styles.closingCta}>
            Browse {count.toLocaleString()} cars
          </Link>
        </div>
      </section>
    </main>
  );
}
