import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../../page.module.css";
import AdminWhyDetails from "./AdminWhyDetails";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "How this deal was calculated",
  robots: { index: false },
};

interface WhyMatch {
  irish_year: number;
  irish_price: number;
  match_score: number;
  mileage_relation: "higher" | "lower" | "similar" | null;
  live_saving_pct: number | null;
  direction: string;
  // SOUND-MAX (owner 2026-09-02). strong = the evidence test; in_band = within
  // 15% of the car's own 10+ Irish median (null when no such median exists);
  // sound = strong AND not out of band. Absent on a pre-upgrade API payload.
  strong?: boolean;
  in_band?: boolean | null;
  sound?: boolean;
  live_saving_eur?: number | null;
}

interface WhyData {
  car_id: string;
  car_name: string;
  make: string;
  model: string;
  year: number;
  live_price: number | null;
  snapshot_date: string;
  badge: {
    tier: "bestseller" | "number_one" | "trending";
    saving_eur: number;
    matched_pair: number;
    segment_median: number;
  } | null;
  median: {
    irish_median: number;
    ads: number;
    saving_eur: number;
  } | null;
  matches: WhyMatch[];
  evidence?: {
    deciding_route: "pair" | "median" | null;
    sound_pair_saving_eur: number | null;
    median_saving_eur: number | null;
    band_pct: number;
  } | null;
  segment_market: { listings: number; low: number; high: number } | null;
  segment: {
    make: string;
    model: string;
    year: number;
    avg_saving_pct: number | null;
    n: number | null;
    siblings: { car_id: string; saving_pct: number; irish_price: number; landed_price: number }[];
  } | null;
}

const TIER_LABELS: Record<string, string> = {
  number_one: "#1 Bestseller",
  bestseller: "Bestseller",
  trending: "Trending Bestseller",
};

async function getWhy(carId: string): Promise<WhyData | null> {
  try {
    const res = await fetch(`${API_BASE}/best-value-why/${carId}`, {
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

// Plain-English identity grade: match_score measures advert-text mess, not
// car dissimilarity, so customers get words rather than a raw decimal.
function confidenceLabel(score: number): string {
  if (score >= 0.95) return "Exact spec match";
  if (score >= 0.8) return "Close spec match";
  return "Similar model";
}

const eur = (n: number) => `€${Math.round(n).toLocaleString()}`;

export default async function BestValueWhyPage(props: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await props.params;
  const data = await getWhy(carId);
  if (!data) {
    return (
      <main className={styles.whyPage}>
        <h1 className={styles.sectionTitle}>No comparison data for this car</h1>
        <p className={styles.sectionSub}>
          It may have been matched in an earlier snapshot, or sold.{" "}
          <Link href="/used-cars?bestseller=1">Browse all Bestsellers &rarr;</Link>
        </p>
      </main>
    );
  }

  // SOUND-MAX (owner 2026-09-02): the working shown as "Route 1" must be a
  // SOUND pair — strong evidence AND priced within 15% of the Irish median for
  // this model-year. The API orders sound pairs first. If the API has not been
  // upgraded yet (no 'sound' booleans), fall back to today's rule so the page
  // never regresses during a deploy window.
  const upgraded = data.matches.some((m) => typeof m.sound === "boolean");
  const liveSaving = (m: WhyMatch): number | null =>
    m.live_saving_eur != null
      ? m.live_saving_eur
      : data.live_price != null
        ? m.irish_price - data.live_price
        : null;
  const qualifyingMatch =
    data.live_price != null
      ? upgraded
        ? data.matches.find((m) => m.sound === true && (liveSaving(m) ?? 0) >= 2500)
        : data.matches.find(
            (m) => m.direction === "uk_cheaper" && m.irish_price - (data.live_price as number) >= 2500
          )
      : undefined;
  const med = data.median;
  const medQualifies = med != null && med.saving_eur >= 2500;
  // Which route the page will actually SHOW as the badge's working. Derived
  // from what renders (a route only counts when its live saving clears the
  // band); the API's deciding_route is a tiebreak only.
  const pairSaving = qualifyingMatch ? (liveSaving(qualifyingMatch) ?? 0) : null;
  const decidedBy: "pair" | "median" | null =
    qualifyingMatch && pairSaving != null && (!medQualifies || pairSaving > (med as { saving_eur: number }).saving_eur)
      ? "pair"
      : qualifyingMatch && pairSaving != null && medQualifies && pairSaving === (med as { saving_eur: number }).saving_eur
        ? (data.evidence?.deciding_route ?? "pair")
        : medQualifies
          ? "median"
          : qualifyingMatch
            ? "pair"
            : null;
  // A strong ad exists but sits outside the 15% band (the only case the
  // "outside the normal range" sentence may describe).
  const outOfBandStrongAd = upgraded && data.matches.some((m) => m.strong === true && m.in_band === false);
  // The single ad a Trending figure rests on: the one whose live saving is the badge saving.
  const trendingAd =
    data.badge?.tier === "trending"
      ? data.matches.find((m) => liveSaving(m) != null && Math.round(liveSaving(m) as number) === data.badge?.saving_eur)
      : undefined;

  return (
    <main className={styles.whyPage}>
      <p className={styles.sectionSub}>
        <Link href={`/car/${data.car_id}`}>&larr; Back to this car</Link> ·{" "}
        <Link href="/used-cars?bestseller=1">All Bestsellers</Link>
      </p>
      <h1 className={styles.sectionTitle}>{data.car_name}</h1>
      <p className={styles.sectionSub}>
        Our live all-in price: <strong>{data.live_price ? eur(data.live_price) : "—"}</strong>{" "}
        (VRT, VAT, customs &amp; delivery included) · Irish market data snapshot:{" "}
        {data.snapshot_date}
      </p>

      {data.badge && (
        <section className={styles.whyBlock}>
          <h2>
            &#9889; {TIER_LABELS[data.badge.tier]} — {eur(data.badge.saving_eur)} under the
            Irish market right now
          </h2>
          <p>
            {data.badge.tier === "trending"
              ? "The saving is real against one Irish advert, but that advert is either thinly evidenced or priced outside the normal range for this model-year, so we call it a trend rather than a verified figure."
              : qualifyingMatch && medQualifies
                ? `Qualifies both ways: matched to a real Irish advert${med ? " priced within the normal range for its model-year" : ""}, and priced under the Irish median of ${med ? med.ads : ""} listings — the strongest evidence we hold. The badge shows the bigger of the two savings — Route ${decidedBy === "median" ? "2" : "1"} below.`
                : decidedBy === "pair"
                  ? med
                    ? "Qualified by a direct match: this exact car against a real Irish advert priced within 15% of the Irish median for its model and year — a representative price, not a freak listing."
                    : "Qualified by a direct match: this exact car against a real Irish advert. There is no 10-listing Irish median for this model-year, so the strong-match test alone applies."
                  : decidedBy === "median"
                    ? "Qualified by market position: priced under the Irish median for its exact model and year."
                    : data.badge.matched_pair
                      ? "Qualified by a direct match: this exact car against a real Irish advert."
                      : "Qualified by market position: priced under the Irish median for its exact model and year."}
            {data.badge.tier !== "trending" && decidedBy === "median" && upgraded && data.matches.length > 0 && !qualifyingMatch
              ? outOfBandStrongAd
                ? " A direct advert match also exists, but its asking price sits outside the normal range for this model-year, so it is listed below for reference and did not decide the badge."
                : " A direct advert match also exists, but it did not pass our evidence test — a strong match at a representative price — so it is listed below for reference and did not decide the badge."
              : ""}
            {(qualifyingMatch || medQualifies)
              ? " Both the badge and the working below are recomputed from our live all-in price every 15 minutes, so they never drift apart for more than a few minutes."
              : ""}
          </p>
        </section>
      )}

      {qualifyingMatch && data.live_price && (
        <section className={styles.whyBlock}>
          <h2>Route 1 — matched to a real Irish ad</h2>
          <p className={styles.whyFormula}>
            {eur(qualifyingMatch.irish_price)} Irish asking − {eur(data.live_price)} ours ={" "}
            <strong>{eur(qualifyingMatch.irish_price - data.live_price)} saving</strong>
          </p>
          <p>
            Qualifies because the saving clears €750 (the Bestseller ladder; €2,500+ is a Bestseller,
            €5,000+ a #1 Bestseller) against a real Irish advert ({confidenceLabel(qualifyingMatch.match_score).toLowerCase()},
            same model and year)
            {upgraded && med
              ? ", and that advert's asking price sits within 15% of the Irish median for this model-year — a representative price, not a freak listing."
              : upgraded
                ? ". There is no 10-listing Irish median for this model-year, so the strong-match test alone applies."
                : "."}
          </p>
        </section>
      )}

      {medQualifies && med && data.live_price && (
        <section className={styles.whyBlock}>
          <h2>Route 2 — under the Irish median for its exact model and year</h2>
          <p className={styles.whyFormula}>
            {eur(med.irish_median)} Irish median (across {med.ads} real listings) −{" "}
            {eur(data.live_price)} ours = <strong>{eur(med.saving_eur)} saving</strong>
          </p>
          <p>
            The median is the middle asking price of all {med.ads} Irish listings for this
            exact make, model and year — it ignores freak highs and lows, and one or two
            mispriced ads cannot move it. We only use medians built from 10 or more real
            listings.
          </p>
        </section>
      )}

      {data.matches.length > 0 && (
        <section className={styles.whyBlock}>
          <h2>The real Irish {data.matches.length === 1 ? "advert" : "adverts"} behind this</h2>
          <ul>
            {data.matches.map((m, i) => (
              <li key={i}>
                A live Irish advert for the same model ({m.irish_year}) &mdash;{" "}
                {confidenceLabel(m.match_score).toLowerCase()}
                {m.mileage_relation === "higher" && ", carrying higher mileage than ours"}
                {m.mileage_relation === "lower" && ", carrying lower mileage than ours"}
                {m.mileage_relation === "similar" && ", with similar mileage to ours"} &mdash; asking{" "}
                <strong>{eur(m.irish_price)}</strong>
                {!upgraded
                  ? "."
                  : trendingAd === m
                    ? m.strong === false
                      ? " — this is the advert behind the Trending figure; its evidence is thin, which is why we call it a trend rather than a verified figure."
                      : " — this is the advert behind the Trending figure; its asking price sits outside the normal range for this model-year, which is why we call it a trend rather than a verified figure."
                    : m.sound === true
                      ? med
                        ? " — representative of the Irish market for this model-year."
                        : " — a strong match; no 10-listing Irish median exists for this model-year to check it against."
                      : m.strong === false
                        ? " — thin evidence on its own, so it does not decide the badge."
                        : m.in_band === false
                          ? " — outside the normal price range for this model-year, so not used to decide the badge."
                          : "."}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: "0.85rem", color: "#777" }}>
            We would like to publish the full detail of every comparison, but other sellers&rsquo;
            adverts are their own &mdash; it isn&rsquo;t our place to republish their car data,
            especially where our cars compete directly with theirs on price. So the comparison
            uses the advertised asking price only. Best practice is followed throughout: real
            advertised prices, recorded weekly and compared like for like, with Claude AI &mdash;
            Fable 5, Anthropic&rsquo;s most advanced model &mdash; involved in the statistical
            modelling behind this price comparison. The best tools available, used properly, for
            the most reliable results.
          </p>
        </section>
      )}

      {data.segment_market && (
        <section className={styles.whyBlock}>
          <h2>
            The Irish market:{" "}
            <span style={{ textTransform: "capitalize" }}>
              {data.make} {data.model}
            </span>{" "}
            ({data.year})
          </h2>
          <p>
            {data.segment_market.listings} contemporary Irish{" "}
            {data.segment_market.listings === 1 ? "listing" : "listings"} for this model and year,
            asking roughly {eur(data.segment_market.low)}&ndash;{eur(data.segment_market.high)}.
          </p>
        </section>
      )}

      <AdminWhyDetails carId={data.car_id} />

      <section className={styles.whyBlock}>
        <details>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "1.05rem" }}>How we work this out — the rules</summary>
        <ul>
          <li>A saving only counts against a <strong>real Irish asking price</strong>, never a prediction.</li>
          <li>Irish evidence covers listings from the <strong>past six months</strong>, each car counted once at its most recent asking price — a car that sold at its price is proof the price was real. Measured drift is negligible (24,775 identical listings ten days apart: 91% unchanged, average move −€78).</li>
          <li><strong>The Bestseller ladder: any saving of €750+ earns the badge and the colour deepens with the saving — €2,500+ is a Bestseller, €5,000+ a #1 Bestseller.</strong> Euro figures, not percentages — €2,800 off a €48k car is real money even when the percentage looks small.</li>
          <li>Route 1: this exact car against a real Irish advert, with strong evidence — several comparisons, high match confidence, or same year with our mileage no higher — <strong>and</strong> that advert priced within 15% of the Irish median for its model and year where one exists, so a single freak listing can never earn a verified Bestseller badge; at most it shows as a trend.</li>
          <li>Route 2: our all-in price against the <strong>median</strong> asking price of 10 or more real Irish listings for the exact make, model and year.</li>
          <li>Only routes that pass their own test are in the running. Where both pass, the badge shows the <strong>bigger of the two savings</strong>; where one passes, that one decides.</li>
          <li>A real saving whose evidence doesn&rsquo;t stand up is a <strong>Trending Bestseller</strong> — worded &ldquo;around&rdquo;, never as a verified figure.</li>
          <li>We do not adjust for mileage or specification — we measured both (about €585 per 10,000 km against about €765 of extra spec on our side) and they cancel to within about €55, so we compare prices exactly as listed.</li>
          <li>Savings above 45% are excluded as implausible; every figure is re-checked against our live price, so the badge always equals the arithmetic of the prices shown. Irish figures are asking prices; ours is the final all-in price.</li>
        </ul>
        </details>
      </section>
    </main>
  );
}
