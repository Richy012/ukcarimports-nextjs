import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../../page.module.css";
import AdminCzLink from "./AdminCzLink";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "How this deal was calculated",
  robots: { index: false },
};

interface WhyMatch {
  irish_version: string;
  irish_year: number;
  irish_mileage_km: number | null;
  irish_price: number;
  irish_county: string | null;
  irish_dealer: string | null;
  irish_url: string | null;
  match_score: number;
  snapshot_saving_pct: number;
  live_saving_pct: number | null;
  direction: string;
}

interface WhyData {
  car_id: string;
  car_name: string;
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

  // Unified euro-band rule: a matched pair counts when the LIVE euro saving
  // clears the €2,500 Bestseller band (the badge itself is the authority on
  // the tier; this just picks the best real ad to show the working against).
  const qualifyingMatch =
    data.live_price != null
      ? data.matches.find(
          (m) => m.direction === "uk_cheaper" && m.irish_price - (data.live_price as number) >= 2500
        )
      : undefined;
  const seg = data.segment;
  const med = data.median;
  const medQualifies = med != null && med.saving_eur >= 2500;

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
              ? "The saving is real but the evidence behind it is thin, so we call it a trend rather than a verified figure."
              : data.badge.matched_pair && data.badge.segment_median
                ? "Proven both ways: matched directly to a real Irish ad AND priced under the Irish median for its exact model and year — the strongest evidence class we have."
                : data.badge.matched_pair
                  ? "Qualified by a direct match: this exact car against a real Irish ad."
                  : "Qualified by market position: priced under the Irish median for its exact model and year."}{" "}
            The figure refreshes with our live price, so it always equals the arithmetic below.
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
            Qualifies because the saving clears €2,500 (a Bestseller; €5,000+ makes a #1
            Bestseller) against a real Irish advert, match confidence{" "}
            {qualifyingMatch.match_score}.
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
          <h2>The real Irish ads behind this ({data.matches.length})</h2>
          <div className={styles.whyTableWrap}>
            <table className={styles.whyTable}>
              <thead>
                <tr>
                  <th>Irish version</th>
                  <th>Year</th>
                  <th>Mileage</th>
                  <th>County</th>
                  <th>Asking</th>
                  <th>Confidence</th>
                  <th>Live saving</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m, i) => (
                  <tr key={i}>
                    <td>{m.irish_version}</td>
                    <td>{m.irish_year}</td>
                    <td>{m.irish_mileage_km ? `${m.irish_mileage_km.toLocaleString()} km` : "—"}</td>
                    <td>{m.irish_county ?? "—"}</td>
                    <td>{eur(m.irish_price)}</td>
                    <td>{m.match_score}</td>
                    <td>{m.live_saving_pct !== null ? `${m.live_saving_pct}%` : "—"}</td>
                    <td>
                      <AdminCzLink url={m.irish_url} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {seg && seg.siblings.length > 0 && (
        <section className={styles.whyBlock}>
          <h2>
            Class evidence: {seg.make} {seg.model} ({seg.year}) — {seg.siblings.length} other
            matched examples
          </h2>
          <div className={styles.whyTableWrap}>
            <table className={styles.whyTable}>
              <thead>
                <tr>
                  <th>Car</th>
                  <th>Landed price</th>
                  <th>Irish asking</th>
                  <th>Saving</th>
                </tr>
              </thead>
              <tbody>
                {seg.siblings.map((s) => (
                  <tr key={s.car_id}>
                    <td>
                      <Link href={`/car/${s.car_id}`}>{s.car_id}</Link>
                    </td>
                    <td>{eur(s.landed_price)}</td>
                    <td>{eur(s.irish_price)}</td>
                    <td>{s.saving_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.whyBlock}>
        <h2>The rules, in plain terms</h2>
        <ul>
          <li>A saving only counts against a <strong>real Irish asking price</strong>, never a prediction.</li>
          <li><strong>Bestseller: €2,500+ under the Irish market. #1 Bestseller: €5,000+.</strong> Euro figures, not percentages — €2,800 off a €48k car is real money even when the percentage looks small.</li>
          <li>Route 1: this exact car against a real Irish advert, with strong evidence — several comparisons, high match confidence, or same year with our mileage no higher.</li>
          <li>Route 2: our all-in price against the <strong>median</strong> asking price of 10 or more real Irish listings for the exact make, model and year.</li>
          <li>A real saving whose evidence doesn&rsquo;t stand up is a <strong>Trending Bestseller</strong> — worded &ldquo;around&rdquo;, never as a verified figure.</li>
          <li>We do not adjust for mileage or specification — we measured both (about €585 per 10,000 km against about €765 of extra spec on our side) and they cancel to within about €55, so we compare prices exactly as listed.</li>
          <li>Savings above 45% are excluded as implausible; every figure is re-checked against our live price, so the badge always equals the arithmetic of the prices shown. Irish figures are asking prices; ours is the final all-in price.</li>
        </ul>
      </section>
    </main>
  );
}
