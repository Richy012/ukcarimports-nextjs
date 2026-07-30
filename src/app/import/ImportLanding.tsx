import Link from "next/link";
import styles from "./page.module.css";

export interface LandingData {
  make: string;
  model: string | null;
  count: number;
  price_min: number | null;
  price_max: number | null;
  price_avg: number | null;
  models: { model: string; slug: string; n: number }[];
  comparison: {
    snapshot_date: string;
    total: number;
    uk_cheaper: number;
    avg_saving_pct: number;
  } | null;
  fliers: {
    car_id: string;
    car_name: string;
    year: string | null;
    our_price: number;
    irish_price: number;
    saving_pct: number;
  }[];
}

const API_BASE = "https://api.ukcarimports.ie/public";

export async function getLanding(makeSlug: string, modelSlug?: string): Promise<LandingData | null> {
  const url =
    `${API_BASE}/import-landing/${encodeURIComponent(makeSlug)}` +
    (modelSlug ? `?model=${encodeURIComponent(modelSlug)}` : "");
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bBmw\b/, "BMW").replace(/\bMg\b/, "MG").replace(/\bByd\b/, "BYD").replace(/\bDs\b/, "DS");
}

function euro(v: number | null): string {
  return v === null ? "-" : "€" + Math.round(v).toLocaleString();
}

export default function ImportLanding({ data, makeSlug }: { data: LandingData; makeSlug: string }) {
  const makeT = titleCase(data.make);
  const modelT = data.model ? titleCase(data.model) : null;
  const subject = modelT ? `${makeT} ${modelT}` : makeT;
  const browseHref = data.model
    ? `/used-cars?Make=${encodeURIComponent(data.make)}&Model=${encodeURIComponent(data.model)}`
    : `/used-cars?Make=${encodeURIComponent(data.make)}`;
  const ukCheaperShare =
    data.comparison && data.comparison.total > 0
      ? Math.round((data.comparison.uk_cheaper / data.comparison.total) * 100)
      : null;

  const faq = [
    {
      q: `Is VRT included in the price of an imported ${subject}?`,
      a: `Yes — every ${subject} on ukcarimports.ie is priced fully landed: VRT, VAT, customs duty (where applicable), UK–Ireland transport and our handling are all included. The price you see is the price you pay.`,
    },
    {
      q: `How long does it take to import a ${subject} from the UK?`,
      a: `Typically about two weeks from deposit to handover on Irish plates. We handle the purchase, an independent mechanical inspection, customs, VRT and registration — you collect in Dublin or take delivery at your door.`,
    },
    {
      q: `Is it cheaper to import a ${subject} from the UK?`,
      a: `Often, yes — UK supply is roughly ten times larger than the Irish market, and we reclaim UK VAT to reduce the Irish tax base. We benchmark every car against real Irish asking prices weekly and flag the exceptional deals.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://ukcarimports.ie/" },
          { "@type": "ListItem", position: 2, name: `${makeT} imports`, item: `https://ukcarimports.ie/import/${makeSlug}` },
          ...(data.model
            ? [{ "@type": "ListItem", position: 3, name: `${subject} imports` }]
            : []),
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span>{" "}
        {data.model ? (
          <>
            <Link href={`/import/${makeSlug}`}>{makeT} imports</Link> <span>/</span> <span>{modelT}</span>
          </>
        ) : (
          <span>{makeT} imports</span>
        )}
      </nav>

      <h1>
        Import a {subject} from the UK — {data.count.toLocaleString()} available now
      </h1>
      <p className={styles.intro}>
        Choose from {data.count.toLocaleString()} {subject} cars at established UK garages, every one
        priced fully landed for Ireland — VRT, VAT, customs and delivery included. Independent
        inspection before you commit, Irish plates on handover, typically two weeks door to door.
      </p>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{data.count.toLocaleString()}</span>
          <span className={styles.statLabel}>in stock today</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{euro(data.price_min)}</span>
          <span className={styles.statLabel}>from (all-in price)</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{euro(data.price_avg)}</span>
          <span className={styles.statLabel}>average price</span>
        </div>
        {/* Comparison-engine stats deliberately NOT rendered publicly yet:
            owner's rule — no market-comparison numbers in front of customers
            until the matching data passes his sign-off (credibility first).
            Re-enable by restoring this block and the fliers section below. */}
      </div>

      <div className={styles.ctaRow}>
        <Link href={browseHref} className={styles.ctaPrimary}>
          Browse {data.count.toLocaleString()} {subject} cars
        </Link>
        <Link href="/how-it-works" className={styles.ctaSecondary}>
          How it works
        </Link>
      </div>

      {/* Flyer cards withheld from public pages pending owner sign-off on
          comparison data quality — see note above. */}

      {data.models.length > 0 && (
        <section className={styles.models}>
          <h2>{makeT} models available to import</h2>
          <div className={styles.modelGrid}>
            {data.models.map((m) => (
              <Link key={m.slug} href={`/import/${makeSlug}/${m.slug}`} className={styles.modelCard}>
                <span>{titleCase(m.model)}</span>
                <span className={styles.modelCount}>{m.n.toLocaleString()} cars</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={styles.faq}>
        <h2>Importing a {subject}: common questions</h2>
        {faq.map((f) => (
          <details key={f.q} className={styles.faqItem}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

    </main>
  );
}
