import Link from "next/link";
import styles from "./page.module.css";

export interface LandingData {
  make: string;
  model: string | null;
  is_family?: boolean;
  variants?: { model: string; slug: string; n: number }[];
  count: number;
  price_min: number | null;
  price_max: number | null;
  price_avg: number | null;
  models: { model: string; slug: string; n: number }[];
  siblings?: { model: string; slug: string; n: number }[];
  years?: { year: number; n: number }[];
  fuels?: { fuel: string; n: number }[];
  bestseller?: {
    count: number;
    max_saving_eur: number;
    top: {
      car_id: string;
      car_name: string;
      year: number;
      tier: string;
      saving_eur: number;
    } | null;
  } | null;
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

// Model names are stored the way the scraper found them (xc90, glc, 320d,
// A180d, 3 Series after family grouping). Render them the way a human — and
// a Google query — writes them.
export function displayModel(make: string, model: string): string {
  const m = model.trim();
  const mk = make.toLowerCase();
  if (mk === "bmw" && /^i[x0-9][a-z0-9]*$/i.test(m)) return "i" + m.slice(1).toUpperCase();
  if (mk === "hyundai" && /^i\d+$/i.test(m)) return m.toLowerCase();
  if (/[\s-]/.test(m)) return titleCase(m);
  if (/^[a-z]+$/.test(m)) return m.length <= 3 ? m.toUpperCase() : titleCase(m);
  if (/^[a-z]{1,2}\d+[a-z]*$/.test(m)) return m.toUpperCase();
  return m;
}

function euro(v: number | null): string {
  return v === null ? "-" : "€" + Math.round(v).toLocaleString();
}

export default function ImportLanding({ data, makeSlug }: { data: LandingData; makeSlug: string }) {
  const makeT = titleCase(data.make);
  const modelT = data.model ? displayModel(data.make, data.model) : null;
  const subject = modelT ? `${makeT} ${modelT}` : makeT;
  const isFamily = !!data.is_family;
  // The listing's Model filter takes a real model_name — a family ("3
  // Series") isn't one, so family pages browse at make level and rely on
  // the variant grid for the precise cut.
  const browseHref =
    data.model && !isFamily
      ? `/used-cars?Make=${encodeURIComponent(data.make)}&Model=${encodeURIComponent(data.model)}`
      : `/used-cars?Make=${encodeURIComponent(data.make)}`;
  const bs = data.bestseller && data.bestseller.count > 0 ? data.bestseller : null;

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
      a: bs
        ? `Often, yes — and we measure it rather than claim it. Right now ${bs.count.toLocaleString()} of our ${subject} cars are priced at least €2,500 under comparable Irish asking prices (the biggest is €${bs.max_saving_eur.toLocaleString()} under), benchmarked weekly against real Irish ads. UK supply is roughly ten times larger than the Irish market, and we reclaim UK VAT to reduce the Irish tax base.`
        : `Often, yes — UK supply is roughly ten times larger than the Irish market, and we reclaim UK VAT to reduce the Irish tax base. We benchmark every car against real Irish asking prices weekly and flag the exceptional deals.`,
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/images/hero-rot-irishprice.jpg"
        alt={`Browse the UK's ${subject} market - buy at the Irish price. VRT, VAT, customs and delivery included.`}
        width={1672}
        height={941}
        className={styles.landingBanner}
      />

      <h1>
        {data.model
          ? `Used ${subject} for Sale in Ireland — ${data.count.toLocaleString()} UK imports`
          : `Import a ${subject} from the UK — ${data.count.toLocaleString()} available now`}
      </h1>
      <p className={styles.intro}>
        Choose from {data.count.toLocaleString()} {subject} cars at established UK garages, every one
        priced fully landed for Ireland — VRT, VAT, customs and delivery included. Independent
        inspection before you commit, Irish plates on handover, typically two weeks door to door.
        {bs && (
          <>
            {" "}Right now <strong>{bs.count.toLocaleString()}</strong> of them are priced at least
            €2,500 under comparable Irish asking prices.
          </>
        )}
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
        {bs && (
          <div className={styles.statCard}>
            <span className={styles.statValue}>{euro(bs.max_saving_eur)}</span>
            <span className={styles.statLabel}>biggest saving vs Ireland right now</span>
          </div>
        )}
      </div>

      {bs && (
        <section className={styles.bsBand}>
          <div className={styles.bsText}>
            <span className={styles.bsTier}>Bestseller Series</span>
            <p>
              {bs.count.toLocaleString()} {subject} {bs.count === 1 ? "car is" : "cars are"} priced{" "}
              <strong>€2,500 or more under the Irish market</strong> today
              {bs.top && (
                <>
                  {" "}— the biggest is{" "}
                  <strong>€{bs.top.saving_eur.toLocaleString()} under</strong>
                  {bs.top.year ? ` on a ${bs.top.year}` : ""} model
                </>
              )}
              . Every figure is benchmarked against real Irish asking prices, refreshed weekly.
            </p>
          </div>
          <div className={styles.bsActions}>
            {bs.top && (
              <Link href={`/best-value/why/${bs.top.car_id}`} className={styles.bsMaths}>
                See the maths behind the biggest saving
              </Link>
            )}
            <Link
              href={`${browseHref}&bestseller=1`}
              className={styles.bsBrowse}
            >
              Browse Bestseller {subject} cars
            </Link>
          </div>
        </section>
      )}

      <div className={styles.ctaRow}>
        <Link href={browseHref} className={styles.ctaPrimary}>
          Browse {isFamily ? `all ${makeT} cars` : `${data.count.toLocaleString()} ${subject} cars`}
        </Link>
        <Link href="/how-it-works" className={styles.ctaSecondary}>
          How it works
        </Link>
      </div>

      {isFamily && (data.variants?.length ?? 0) > 0 && (
        <section className={styles.models}>
          <h2>Choose your {subject}</h2>
          <div className={styles.modelGrid}>
            {data.variants!.map((v) => (
              <Link key={v.slug} href={`/import/${makeSlug}/${v.slug}`} className={styles.modelCard}>
                <span>{displayModel(data.make, v.model)}</span>
                <span className={styles.modelCount}>{v.n.toLocaleString()} cars</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.model && !isFamily && (data.years?.length ?? 0) > 0 && (
        <section className={styles.models}>
          <h2>{subject} by year</h2>
          <div className={styles.chipRow}>
            {data.years!.filter((y) => y.n >= 1).map((y) => (
              <Link
                key={y.year}
                href={`${browseHref}&minYear=${y.year}&maxYear=${y.year}`}
                className={styles.chip}
              >
                {y.year} <span className={styles.chipCount}>({y.n.toLocaleString()})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.model && !isFamily && (data.fuels?.length ?? 0) > 1 && (
        <section className={styles.models}>
          <h2>{subject} by fuel type</h2>
          <div className={styles.chipRow}>
            {data.fuels!.filter((f) => f.n >= 3).map((f) => (
              <Link
                key={f.fuel}
                href={`${browseHref}&Fuel=${encodeURIComponent(f.fuel)}`}
                className={styles.chip}
              >
                {f.fuel} <span className={styles.chipCount}>({f.n.toLocaleString()})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.models.length > 0 && (
        <section className={styles.models}>
          <h2>{makeT} models available to import</h2>
          <div className={styles.modelGrid}>
            {data.models.map((m) => (
              <Link key={m.slug} href={`/import/${makeSlug}/${m.slug}`} className={styles.modelCard}>
                <span>{displayModel(data.make, m.model)}</span>
                <span className={styles.modelCount}>{m.n.toLocaleString()} cars</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(data.siblings?.length ?? 0) > 0 && (
        <section className={styles.models}>
          <h2>More {makeT} models to import</h2>
          <div className={styles.modelGrid}>
            {data.siblings!.map((m) => (
              <Link key={m.slug} href={`/import/${makeSlug}/${m.slug}`} className={styles.modelCard}>
                <span>{displayModel(data.make, m.model)}</span>
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
