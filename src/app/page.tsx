import type { Metadata } from "next";
import Link from "next/link";
import HomeSearchPanel from "./HomeSearchPanel";
import ProcessTimeline from "./ProcessTimeline";
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

async function getHomeData() {
  const empty = {
    cars: [] as HomeCar[],
    count: 0,
    makes: [] as { make: string; slug: string; n: number }[],
  };
  try {
    const [carsRes, indexRes] = await Promise.all([
      fetch(`${API_BASE}/allcarsnew/0/8`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_manheim_car: "0", premium_car: "0", vrtFilter: "Yes" }),
        next: { revalidate: 900 },
      }),
      fetch(`${API_BASE}/import-landing-index`, { next: { revalidate: 3600 } }),
    ]);
    const carsJson = await carsRes.json();
    const indexJson = await indexRes.json();
    const cars: HomeCar[] = (carsJson?.data?.cars ?? [])
      .filter((c: HomeCar) => c.featured_image)
      .slice(0, 4);
    const count: number = carsJson?.data?.count ?? 0;
    const makes: { make: string; slug: string; n: number }[] = (indexJson?.data?.makes ?? []).slice(0, 8);
    return { cars, count, makes };
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
  const { cars, count, makes } = await getHomeData();

  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              Over {count > 0 ? count.toLocaleString() : "200,000"} cars to choose from
            </p>
            <h1 className={styles.heroHeadline}>
              The price you see
              <br />
              is the price <em>you pay.</em>
            </h1>
            <ul className={styles.heroBullets}>
              <li>VRT, VAT, customs &amp; delivery — all included</li>
              <li>Independent mechanical inspection before you commit</li>
              <li>Your maximum exposure: €0 — deposits fully refundable</li>
            </ul>
            <div className={styles.heroCtas}>
              <Link href="/how-it-works" className={styles.heroCtaPrimary}>
                How it works
              </Link>
              <a href="tel:015568261" className={styles.heroCtaGhost}>
                01-556 8261
              </a>
            </div>
          </div>
          <HomeSearchPanel
            makes={makes.map((m) => ({ make: m.make, n: m.n }))}
            totalCount={count}
          />
        </div>
      </section>

      <section className={styles.trustStrip}>
        <span>13 years in business</span>
        <span>
          <span className={styles.stars}>★★★★★</span> <strong>4.6</strong> · 122 Google reviews
        </span>
        <span>Irish plates in ~2 weeks</span>
      </section>

      {cars.length > 0 && (
        <section className={styles.arrivals}>
          <h2 className={styles.sectionTitle}>Just added</h2>
          <p className={styles.sectionSub}>
            Thousands of new cars land every week — the UK market restocks daily; Irish forecourts
            don&apos;t.
          </p>
          <div className={styles.arrivalGrid}>
            {cars.map((c) => (
              <Link key={c.car_id} href={`/car/${c.car_id}`} className={styles.arrivalCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.featured_image} alt={c.car_name} loading="lazy" />
                <span className={styles.arrivalName}>{c.car_name}</span>
                <span className={styles.arrivalPrice}>
                  {c.car_info?.final_price
                    ? `€${Math.round(c.car_info.final_price).toLocaleString()}`
                    : "POA"}
                  <em> all-in</em>
                </span>
              </Link>
            ))}
          </div>
          <p className={styles.arrivalsMore}>
            <Link href="/used-cars">Browse all {count.toLocaleString()} cars &rarr;</Link>
          </p>
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
