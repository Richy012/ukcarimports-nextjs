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
          <Link href="/best-value">Back to best value &rarr;</Link>
        </p>
      </main>
    );
  }

  const qualifyingMatch = data.matches.find(
    (m) =>
      m.direction === "uk_cheaper" &&
      m.match_score >= 0.8 &&
      m.live_saving_pct !== null &&
      m.live_saving_pct >= 10 &&
      m.live_saving_pct <= 45
  );
  const seg = data.segment;
  const segQualifies =
    seg?.avg_saving_pct != null && seg.n != null && seg.n >= 5 && seg.avg_saving_pct >= 10 && seg.avg_saving_pct <= 45;

  return (
    <main className={styles.whyPage}>
      <p className={styles.sectionSub}>
        <Link href={`/car/${data.car_id}`}>&larr; Back to this car</Link> ·{" "}
        <Link href="/best-value">All best-value cars</Link>
      </p>
      <h1 className={styles.sectionTitle}>{data.car_name}</h1>
      <p className={styles.sectionSub}>
        Our live all-in price: <strong>{data.live_price ? eur(data.live_price) : "—"}</strong>{" "}
        (VRT, VAT, customs &amp; delivery included) · Irish market data snapshot:{" "}
        {data.snapshot_date}
      </p>

      {qualifyingMatch && data.live_price && (
        <section className={styles.whyBlock}>
          <h2>Route 1 — matched to a real Irish ad</h2>
          <p className={styles.whyFormula}>
            ({eur(qualifyingMatch.irish_price)} Irish asking − {eur(data.live_price)} ours) ÷{" "}
            {eur(qualifyingMatch.irish_price)} ={" "}
            <strong>{qualifyingMatch.live_saving_pct}% saving</strong>
          </p>
          <p>
            Qualifies because the saving is between 10% and 45% and the match confidence is{" "}
            {qualifyingMatch.match_score} (threshold 0.8).
          </p>
        </section>
      )}

      {!qualifyingMatch && segQualifies && seg && (
        <section className={styles.whyBlock}>
          <h2>Route 2 — its class is cheaper in the UK</h2>
          <p>
            This exact car has no direct Irish match, but{" "}
            <strong>
              {seg.make} {seg.model} ({seg.year})
            </strong>{" "}
            as a class averages <strong>{seg.avg_saving_pct}% cheaper</strong> than Irish
            equivalents across <strong>{seg.n} real matched comparisons</strong> (threshold: at
            least 5). Every live example of the class inherits that evidence, worded
            &ldquo;typically&rdquo;.
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
          <li>Route 1: this exact car, matched with confidence ≥ 0.8, live saving 10–45%.</li>
          <li>Route 2: the model-year class averages 10–45% cheaper across ≥ 5 real comparisons.</li>
          <li>Savings above 45% are excluded as implausible; prices re-checked live so the badge always equals the arithmetic of the prices shown.</li>
          <li>A car that is merely cheaper than its own class&rsquo;s norm — while the class is dearer than Ireland — qualifies under neither route.</li>
        </ul>
      </section>
    </main>
  );
}
