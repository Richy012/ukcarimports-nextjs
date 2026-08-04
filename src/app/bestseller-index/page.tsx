import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "The Bestseller Index™ — UK vs Ireland Car Prices, Measured Weekly",
  description:
    "Every week we benchmark every make, model and year we stock against real Irish asking prices. See how many cars are €2,500+ under the Irish market right now — and check the maths on every one.",
};

interface IndexStats {
  snapshot_date: string;
  number_one: number;
  bestseller: number;
  segments_covered: number;
}

interface BandCar {
  car_id: string;
  car_name: string;
  tier: string | null;
  saving_eur: number | null;
  final_price?: number | null;
}

async function getStats(): Promise<IndexStats | null> {
  try {
    const res = await fetch(`${API_BASE}/bestseller-index-stats`, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? null;
  } catch {
    return null;
  }
}

async function getExamples(): Promise<BandCar[]> {
  try {
    const res = await fetch(`${API_BASE}/best-value/0/60`, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json();
    const cars: BandCar[] = data?.data?.cars ?? [];
    // One per model, max two per make — same dedupe idea as the homepage band.
    const seenModel = new Set<string>();
    const perMake = new Map<string, number>();
    const out: BandCar[] = [];
    for (const c of cars) {
      const words = (c.car_name || "").split(" ");
      const make = words[0] ?? "";
      const model = words.slice(0, 3).join(" ");
      if (seenModel.has(model)) continue;
      if ((perMake.get(make) ?? 0) >= 2) continue;
      seenModel.add(model);
      perMake.set(make, (perMake.get(make) ?? 0) + 1);
      out.push(c);
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}

const eur = (n: number) => `€${Math.round(n).toLocaleString()}`;

export default async function BestsellerIndexPage() {
  const [stats, examples] = await Promise.all([getStats(), getExamples()]);
  const total = stats ? stats.number_one + stats.bestseller : null;

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1>The Bestseller Index&trade;</h1>
        <p className={styles.heroSub}>
          UK vs Ireland car prices, measured weekly. Every make, model and year we stock,
          benchmarked against real Irish asking prices — the first methodical comparison of its
          kind. No estimates, no adjustments, and the full maths behind every figure.
        </p>
      </section>

      {stats && total !== null && (
        <section className={styles.statsBand}>
          <div className={styles.statTile}>
            <span className={styles.statNumber}>{total.toLocaleString()}</span>
            <span className={styles.statLabel}>cars €2,500+ under the Irish market right now</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNumber}>{stats.number_one.toLocaleString()}</span>
            <span className={styles.statLabel}>of them €5,000+ under — #1 Bestsellers</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statNumber}>{stats.segments_covered.toLocaleString()}</span>
            <span className={styles.statLabel}>model-years measured against 10+ Irish listings</span>
          </div>
          <p className={styles.statFootnote}>
            Live figures — refreshed every 15 minutes against our current prices. Irish market
            snapshot: {stats.snapshot_date}. Irish evidence covers listings from the past six
            months, each car counted once at its most recent asking price (measured on 24,775
            identical listings ten days apart: 91% unchanged).
          </p>
        </section>
      )}

      {examples.length > 0 && (
        <section className={styles.examples}>
          <h2>This week&rsquo;s standouts</h2>
          <p className={styles.examplesSub}>
            Six different models, each with the full working one click away.
          </p>
          <ul className={styles.exampleList}>
            {examples.map((c) => (
              <li key={c.car_id} className={styles.exampleRow}>
                <Link href={`/car/${c.car_id}`} className={styles.exampleName}>
                  {c.car_name}
                </Link>
                <span className={styles.exampleSaving}>
                  {c.saving_eur ? `${eur(c.saving_eur)} less than in Ireland` : ""}
                </span>
                <Link href={`/best-value/why/${c.car_id}`} className={styles.exampleMaths}>
                  See the maths &rarr;
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.ctaRow}>
            <Link href="/used-cars?bestseller=1" className={styles.ctaButton}>
              Browse every Bestseller
            </Link>
            <Link href="/sign-up" className={styles.ctaSecondary}>
              Get alerted when new ones land &rarr;
            </Link>
          </p>
        </section>
      )}

      <section className={styles.method}>
        <h2>How we work this out</h2>
        <p>
          Each week we record every Carzone listing for the makes, models and years we stock. For
          any model-year with 10 or more Irish listings we take the <strong>median</strong> asking
          price — the middle price, which ignores freak highs and lows. We compare it with our{" "}
          <strong>all-in delivered price</strong>: the car, VAT, customs, VRT, transport and our
          fee — what you actually pay to have it on Irish plates in your name. Savings of €2,500+
          we call a <strong>Bestseller</strong>; €5,000+ a <strong>#1 Bestseller</strong>. Every
          comparison shows how many Irish listings it is based on and the week it was measured.
          Irish figures are asking prices; ours is the final price.
        </p>
        <p>
          <em>
            We do not adjust for mileage or specification. We measured both: our cars average
            slightly higher mileage (worth about €585 per 10,000 km) and slightly higher
            specification (worth about €765). The two cancel to within about €55, so we compare
            prices exactly as listed.
          </em>
        </p>
        <p className={styles.methodNote}>
          We would like to publish the full detail of every comparison, but other sellers&rsquo;
          adverts are their own — it isn&rsquo;t our place to republish their car data. Best
          practice is followed throughout, with Claude AI — Fable 5, Anthropic&rsquo;s most
          advanced model — involved in the statistical modelling behind this price comparison.
        </p>
      </section>
    </main>
  );
}
