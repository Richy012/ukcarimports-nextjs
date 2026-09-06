import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, CarFront } from "lucide-react";
import HomeSearchPanel from "./HomeSearchPanel";
import ProcessTimeline from "./ProcessTimeline";
import ReviewCarousel from "./ReviewCarousel";
import googleReviews from "@/data/google-reviews.json";
import { getStockCount, formatStockCount, roundStockDown } from "@/lib/stockCount";
import styles from "./page.module.css";
import { heroForDay } from "@/lib/brandArt";
import { irishListings } from "@/lib/irishListings";
import { ladderRung, RUNG_LABEL } from "@/lib/ladder";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "UK Car Imports — The Price You See Is The Price You Pay",
  description:
    "Import your next car from the UK: 135,000+ cars priced fully landed for Ireland — VRT, VAT, customs & delivery included. Independent inspection, Irish plates in ~2 weeks. Est. 2013.",
  alternates: { canonical: "https://ukcarimports.ie/" },
};

// Organization + WebSite — the two structured-data blocks Google expects on a
// homepage. Address and phone match the footer exactly.
const HOME_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://ukcarimports.ie/#organization",
    name: "UK Car Imports",
    url: "https://ukcarimports.ie/",
    logo: "https://ukcarimports.ie/assets/images/logo.png",
    foundingDate: "2013",
    telephone: "+353-1-556-8261",
    email: "info@ukcarimports.ie",
    address: {
      "@type": "PostalAddress",
      streetAddress: "51 Bracken Rd, Sandyford Business Park",
      addressLocality: "Sandyford",
      addressRegion: "Dublin",
      postalCode: "D18 CV48",
      addressCountry: "IE",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://ukcarimports.ie/#website",
    name: "UK Car Imports",
    url: "https://ukcarimports.ie/",
  },
];

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
function bestValueBadgeParts(bv: BestValueCar["best_value"]): { tier: string; saving: string; rung: number } {
  const sav = Math.round(bv.saving_eur);
  // Ladder (owner 2026-09-03): the rung label and colour, exact figure under it.
  const rung = ladderRung(bv.tier, sav);
  if (rung) return { tier: RUNG_LABEL[rung], saving: `€${sav.toLocaleString()} less than in Ireland`, rung };
  const rounded = Math.round(sav / 500) * 500;
  return {
    tier: "Trending Bestseller",
    saving: rounded >= 1000 ? `around €${rounded.toLocaleString()} less than in Ireland` : "",
    rung: 0,
  };
}

async function getHomeData() {
  const empty = {
    bestValue: [] as BestValueCar[],
    bvCount: 0,
    count: null as number | null,
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
        body: JSON.stringify({ minPrice: "1" }),
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
    // Homepage chips are a CURATED shortlist, not the top 8 by volume (owner
    // 2026-08-07). DISPLAY ONLY -- every make stays in the search dropdown
    // (allMakes below), the /used-cars filters, the make pages and the
    // sitemap. Order follows FEATURED_MAKE_SLUGS.
    const featured = FEATURED_MAKE_SLUGS.map((slug) =>
      (indexJson?.data?.makes ?? []).find((m: { slug: string }) => m.slug === slug),
    ).filter(Boolean) as { make: string; slug: string; n: number }[];
    // If the index ever stops returning one of them, fall back to volume order
    // rather than rendering a short or empty row.
    const makes: { make: string; slug: string; n: number }[] =
      featured.length >= 6 ? featured : (indexJson?.data?.makes ?? []).slice(0, 8);
    const makesJson = await makesRes.json();
    const allMakes: { make: string; n: number }[] = (makesJson?.make ?? [])
      .filter((m: { make: string }) => m.make)
      .map((m: { make: string; total: number }) => ({ make: m.make, n: m.total }));
    return { bestValue, bvCount, count, makes, allMakes };
  } catch {
    return empty;
  }
}



// Title-case a make for display while keeping acronyms upper -- the plain
// word-boundary version rendered "Bmw".
function makeLabel(make: string): string {
  return make
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bBmw\b/, "BMW")
    .replace(/\bMg\b/, "MG")
    .replace(/\bByd\b/, "BYD")
    .replace(/\bDs\b/, "DS");
}

// Curated homepage chips, biggest live stock first. Changing this list
// changes the chips ONLY -- it does not affect search, filtering or
// indexing anywhere on the site.
const FEATURED_MAKE_SLUGS = [
  "bmw",
  "audi",
  "mercedes-benz",
  "nissan",
  "skoda",
  "land-rover",
  "volvo",
  "tesla",
  "polestar",
];

// Hero artwork now lives in src/lib/brandArt.ts so the same set can be
// reused for make-specific banners elsewhere on the site.

export default async function HomePage() {
  const { bestValue, bvCount, count, makes, allMakes } = await getHomeData();

  const heroArt = heroForDay();
  // Irish-registered (Above Board Cars) cars — the section below only renders when there are any
  const irish = await irishListings().catch(() => []);
  // The original hero keeps its pre-cropped letterbox variants (the CSS
  // defaults). Rotation artwork points every breakpoint at itself and at its
  // own 1672x941 aspect so it shows WHOLE -- cropping to 760/687 tall would
  // cut the bottom feature strip off three of the composites.
  // Typed as a plain record: custom properties are not part of CSSProperties,
  // and a union of two literals cannot be asserted to it directly.
  const heroVars = (
    heroArt.img.includes("hero-full")
      ? { "--hero-img": `url(${heroArt.img})` }
      : {
          "--hero-img": `url(${heroArt.img})`,
          "--hero-img-w22": `url(${heroArt.img})`,
          "--hero-img-w24": `url(${heroArt.img})`,
          "--hero-aspect-w22": "1672 / 941",
          "--hero-aspect-w24": "1672 / 941",
        }
  ) as unknown as CSSProperties;
  return (
    <main>
      {(() => null)()}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSONLD) }}
      />
      <section
        className={[styles.hero, heroArt.alt && styles.heroAlt, heroArt.strip && styles.heroStrip, heroArt.mobileRight && styles.heroMobileRight, heroArt.mobileDeep && styles.heroMobileDeep].filter(Boolean).join(" ")}
        style={heroVars}
      >
        {/* Mobile-only text: on desktop the composite image carries logo + headline */}
        <div className={styles.heroCopy}>
          {count !== null && (
            <p className={styles.heroEyebrow}>
              Over {roundStockDown(count).toLocaleString()} cars to choose from
            </p>
          )}
          <h1 className={styles.heroHeadline}>
            Importing a car
            <br />
            should feel <em>this simple.</em>
          </h1>
          <div className={styles.heroDash} />
        </div>
        {count !== null && (
          <p className={styles.heroCount}>
            Over {roundStockDown(count).toLocaleString()} cars to choose from
          </p>
        )}
        <div className={styles.heroPanelDock}>
          <HomeSearchPanel
            makes={(allMakes.length ? allMakes : makes.map((m) => ({ make: m.make, n: m.n })))}
            totalCount={count === null ? null : roundStockDown(count)}
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

      {/* THE TRADE-IN ADVERT — owner, 6 Sep */}
      <section className={styles.alertBand} style={{ background: "#fdf7f7", borderTop: "1px solid #f3d6d6", borderBottom: "1px solid #f3d6d6" }}>
        <div className={styles.valueInner} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
          <div>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Got a car to sell? See what it is worth in ten seconds.</h2>
            <p className={styles.sectionSub} style={{ margin: "4px 0 0" }}>
              Reg and mileage, and we show you two measured ranges: trade it in against your import, or sell it
              privately with an inspection, a warranty and protected payment behind you. No sign-up, no obligation.
            </p>
          </div>
          <Link href="/trade-ins" style={{ display: "inline-block", padding: "12px 18px", background: "#b60b0c", color: "#fff", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
            Value my car &rarr;
          </Link>
        </div>
      </section>

      {/* FINANCE — owner, 6 Sep: main banks only; quote + invoice once a car is chosen and a deposit is in place */}
      <section className={styles.alertBand} style={{ background: "#f7f9fc", borderBottom: "1px solid #e2e8f0" }}>
        <div className={styles.valueInner} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
          <div>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Buying on finance? We work with the main banks.</h2>
            <p className={styles.sectionSub} style={{ margin: "4px 0 0" }}>
              Once you have chosen your car and your deposit is in place, we give you the quote and the invoice
              AIB, Bank of Ireland or PTSB need to approve your car loan. Bank finance only &mdash; finance houses
              do not fund cars bought this way.
            </p>
          </div>
          <Link href="/contact" style={{ display: "inline-block", padding: "12px 18px", border: "2px solid #b60b0c", color: "#b60b0c", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
            Ask about finance &rarr;
          </Link>
        </div>
      </section>

      {/* IRISH REGISTERED CARS — only when an Above Board Cars sale is live */}
      {irish.length > 0 && (
        <section className={styles.valueBand}>
          <div className={styles.valueInner}>
            <h2 className={styles.sectionTitle}>Irish registered cars, sold privately &mdash; protected</h2>
            <p className={styles.sectionSub}>
              Already on Irish plates, sold by their owners with Above Board Cars behind every sale: independent
              inspection, warranty and protected payment. Private-sale value, garage-level safety.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 12 }}>
              {irish.slice(0, 4).map((c) => (
                <Link key={c.id} href={`/irish-cars/${c.id}`} style={{ display: "block", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", color: "inherit" }}>
                  {c.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photos[0]} alt={c.title} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }} />
                  ) : null}
                  <div style={{ padding: "8px 10px 10px" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a7d33", fontWeight: 700 }}>Irish registered · Above Board Cars</div>
                    <div style={{ fontWeight: 700 }}>{c.title}</div>
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>{c.mileage != null ? `${c.mileage.toLocaleString("en-IE")} ${c.mileageUnit}` : ""}{c.area ? ` · ${c.area}` : ""}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{c.priceEur ? "€" + Math.round(c.priceEur).toLocaleString("en-IE") : "Price on application"}</div>
                  </div>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 10 }}><Link href="/irish-cars">All Irish registered cars &rarr;</Link></p>
          </div>
        </section>
      )}

      {bestValue.length > 0 && (
        <section className={`${styles.valueBand} wm-green`}>
          <div className={styles.valueInner}>
            <h2 className={styles.sectionTitle}>The Bestseller Series</h2>
            <p className={styles.sectionSub}>
              <strong>{bvCount.toLocaleString()} cars priced €750 or more under the Irish market right now.</strong>{" "}
              Every euro is benchmarked against a real Irish asking price or the Irish
              median for the exact model and year — refreshed weekly, checked live.
            </p>
            <div className={styles.arrivalGrid}>
              {bestValue.map((c) => (
                <div key={c.car_id} className={styles.valueItem}>
                <Link href={`/car/${c.car_id}`} className={styles.arrivalCard}>
                  <span className={`${styles.valueBadge} ${styles[`valueBadgeR${bestValueBadgeParts(c.best_value).rung}`] ?? ""}`}>
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
              <Link href="/used-cars?bestseller=1&saving_sort=1">
                {`See all ${bvCount.toLocaleString()} Bestsellers — biggest saving first`} &rarr;
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
              {makeLabel(m.make)} <span>{m.n.toLocaleString()}</span>
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
            {count === null ? "Browse all cars" : `Browse ${roundStockDown(count).toLocaleString()}+ cars`}
          </Link>
        </div>
      </section>
    </main>
  );
}
