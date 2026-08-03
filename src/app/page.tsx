import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, CarFront } from "lucide-react";
import HomeSearchPanel from "./HomeSearchPanel";
import ProcessTimeline from "./ProcessTimeline";
import ReviewCarousel from "./ReviewCarousel";
import { getStockCount, formatStockCount } from "@/lib/stockCount";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "UK Car Imports — The Price You See Is The Price You Pay",
  description:
    "Import your next car from the UK: 135,000+ cars priced fully landed for Ireland — VRT, VAT, customs & delivery included. Independent inspection, Irish plates in ~2 weeks. Est. 2013.",
};

interface HomeCar {
  car_id: string;
  car_name: string;
  featured_image: string;
  mileage: string;
  car_info?: { final_price?: number };
}

interface BestValueCar extends HomeCar {
  make_name?: string;
  model_name?: string;
  best_value: {
    tier: "bestseller" | "number_one" | "trending";
    saving_eur: number;
    saving_pct: number | null;
    irish_price: number | null;
    basis: "matched" | "segment" | "both";
    snapshot_date: string;
  };
}

// Euro-first badge, compact two-line form (tier + saving), same conventions
// as the listing tiles: full tiers state the live figure, Trending hedges
// (rounded €500, "around").
function bestValueBadgeParts(bv: BestValueCar["best_value"]): { tier: string; saving: string } {
  const sav = Math.round(bv.saving_eur);
  if (bv.tier === "number_one")
    return { tier: "#1 Bestseller", saving: `€${sav.toLocaleString()} less than in Ireland` };
  if (bv.tier === "bestseller")
    return { tier: "Bestseller", saving: `€${sav.toLocaleString()} less than in Ireland` };
  const rounded = Math.round(sav / 500) * 500;
  return {
    tier: "Trending Bestseller",
    saving: rounded >= 1000 ? `around €${rounded.toLocaleString()} less in Ireland` : "",
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
      // Fetch a deep slice and diversify below: the list is ordered by
      // saving, and the biggest savings cluster in one model (the BMW XM
      // effect) — a band of identical cars looks broken. 60 is the
      // endpoint's max page size.
      fetch(`${API_BASE}/best-value/0/60`, { next: { revalidate: 900 } }),
    ]);
    const indexJson = await indexRes.json();
    const bvJson = await bvRes.json();
    // Eight cars, eight different models, at most two per make (owner spec
    // 2026-08-03: "eight different types of cars rather than all the same")
    // — still in biggest-saving order within those rules.
    const seenModels = new Set<string>();
    const perMake = new Map<string, number>();
    const bestValue: BestValueCar[] = (bvJson?.data?.cars ?? [])
      .filter((c: BestValueCar) => c.featured_image && c.best_value)
      .filter((c: BestValueCar) => {
        const make = c.make_name ?? "";
        const modelKey = `${make}|${c.model_name ?? ""}`;
        if (seenModels.has(modelKey)) return false;
        if ((perMake.get(make) ?? 0) >= 2) return false;
        seenModels.add(modelKey);
        perMake.set(make, (perMake.get(make) ?? 0) + 1);
        return true;
      })
      .slice(0, 8);
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
            Over {count > 0 ? count.toLocaleString() : "135,000"} cars to choose from
          </p>
          <h1 className={styles.heroHeadline}>
            Importing a car
            <br />
            should feel <em>this simple.</em>
          </h1>
          <div className={styles.heroDash} />
        </div>
        <p className={styles.heroCount}>
          Over {count > 0 ? count.toLocaleString() : "135,000"} cars to choose from
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
            <h2 className={styles.sectionTitle}>The Bestseller Series</h2>
            <p className={styles.sectionSub}>
              Every euro is benchmarked against a real Irish asking price or the Irish
              median for the exact model and year — refreshed weekly, checked live.
            </p>
            <div className={styles.arrivalGrid}>
              {bestValue.map((c) => (
                <div key={c.car_id} className={styles.valueItem}>
                <Link href={`/car/${c.car_id}`} className={styles.arrivalCard}>
                  <span className={styles.valueBadge}>
                    <span className={styles.valueBadgeTier}>{bestValueBadgeParts(c.best_value).tier}</span>
                    {bestValueBadgeParts(c.best_value).saving && (
                      <span className={styles.valueBadgeSaving}>
                        {bestValueBadgeParts(c.best_value).saving}
                      </span>
                    )}
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
              <Link href="/used-cars?bestseller=1">
                {`See all ${bvCount.toLocaleString()} Bestsellers — priced under the Irish market`} &rarr;
              </Link>
            </p>
          </div>
        </section>
      )}

      <ProcessTimeline stockLabel={formatStockCount(count)} />

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
        <ReviewCarousel reviews={REVIEWS} />
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
