import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, CarFront } from "lucide-react";
import HomeSearchPanel from "./HomeSearchPanel";
import ProcessTimeline from "./ProcessTimeline";
import ReviewCarousel from "./ReviewCarousel";
import googleReviews from "@/data/google-reviews.json";
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
    drop_eur?: number | null;
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
    allMakes: [] as { make: string; n: number }[],
  };
  try {
    const [count, indexRes, bvRes, makesRes] = await Promise.all([
      getStockCount(),
      fetch(`${API_BASE}/import-landing-index`, { next: { revalidate: 3600 } }),
      // rotate=daily: the API serves 60 of the ~3,000 #1 Bestsellers in an
      // order that reshuffles every day, so the band changes each morning
      // and every #1 car gets equal airtime over time (owner ask,
      // 2026-08-04). Diversify below — a band of identical cars looks
      // broken. 60 is the endpoint's max page size.
      fetch(`${API_BASE}/best-value/0/60?rotate=daily`, { next: { revalidate: 900 } }),
      // FULL makes list for the search dropdown -- the landing-index slice
      // of 8 below is only for the brand chips (owner report 2026-08-04:
      // "not all makes are listed in the dropdown"). Same facet the
      // /used-cars filter uses, same 15k public floor.
      fetch(`${API_BASE}/makes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPrice: "15000" }),
        next: { revalidate: 3600 },
      }),
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
      .slice(0, 8)
      // Display order: dealer-cut Bestsellers first (biggest cut leading),
      // then biggest saving — mirrors the API's band priority.
      .sort((a: BestValueCar, b: BestValueCar) => {
        const da = a.best_value?.drop_eur ?? 0;
        const db = b.best_value?.drop_eur ?? 0;
        if ((da > 0) !== (db > 0)) return db > 0 ? 1 : -1;
        if (da > 0 && db > 0) return db - da;
        return (b.best_value?.saving_eur ?? 0) - (a.best_value?.saving_eur ?? 0);
      });
    const bvCount: number = bvJson?.data?.count ?? 0;
    const makes: { make: string; slug: string; n: number }[] = (indexJson?.data?.makes ?? []).slice(0, 8);
    const makesJson = await makesRes.json();
    const allMakes: { make: string; n: number }[] = (makesJson?.make ?? [])
      .filter((m: { make: string }) => m.make)
      .map((m: { make: string; total: number }) => ({ make: m.make, n: m.total }));
    return { bestValue, bvCount, count, makes, allMakes };
  } catch {
    return empty;
  }
}



// Owner-supplied brand composites rotate daily with the original hero
// (owner ask 2026-08-05). UTC-day index keeps ISR caches coherent; mobile
// always shows the original artwork (its text-zone crop is artwork-specific,
// see page.module.css).
const HERO_ROTATION = [
  { img: "/assets/images/hero-full.jpg", alt: false },
  { img: "/assets/images/hero-rot-port.jpg", alt: true },
  { img: "/assets/images/hero-rot-irishprice.jpg", alt: true },
  { img: "/assets/images/hero-rot-nocosts.jpg", alt: true },
];

export default async function HomePage() {
  const { bestValue, bvCount, count, makes, allMakes } = await getHomeData();

  const heroArt = HERO_ROTATION[Math.floor(Date.now() / 86400000) % HERO_ROTATION.length];
  return (
    <main>
      {(() => null)()}
      <section
        className={heroArt.alt ? `${styles.hero} ${styles.heroAlt}` : styles.hero}
        style={{ "--hero-img": `url(${heroArt.img})` } as CSSProperties}
      >
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
            makes={(allMakes.length ? allMakes : makes.map((m) => ({ make: m.make, n: m.n })))}
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
                  {(c.best_value.drop_eur ?? 0) >= 300 && (
                    <span className={styles.arrivalDrop}>
                      &#8595; &euro;{(Math.round((c.best_value.drop_eur as number) / 50) * 50).toLocaleString()} price drop
                    </span>
                  )}
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
        <ReviewCarousel
          reviews={googleReviews}
          slots={3}
          gridClass={styles.reviewGrid}
          cardClass={styles.reviewCard}
        />
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
