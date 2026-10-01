import Link from "next/link";
import { titleCase, displayModel } from "@/app/import/ImportLanding";
import { COUNTIES } from "@/lib/counties";
import styles from "./Footer.module.css";

// Site-wide link rows to the pages that earn search traffic (1 Oct 2026
// review): the 43 /import make pages, the biggest model pages, the 26 county
// pages and the guides. Before this the home page linked 9 makes, no model
// page, no post and no county, and /used-cars linked no /import page at all -
// so the ~470 pages Google ranks were fed almost entirely by car pages.
// Server component: the lists are in the HTML, which is the point.

const API_BASE = "https://api.ukcarimports.ie/public";
const MODEL_LINKS = 48;

type MakeRow = { make: string; slug: string; n: number };
type ModelRow = { make_slug: string; model_slug: string; make?: string; model?: string; n: number };
type BlogRow = { blog_url?: string; blog_heading?: string };

function modelLabel(m: ModelRow): string {
  // The index carries the stored names since 1 Oct 2026; label exactly as the
  // model page's own h1 does. The slug fallback below is for an older index.
  if (m.make && m.model) return `${titleCase(m.make)} ${displayModel(m.make, m.model)}`;
  const makeSlug = m.make_slug;
  const modelSlug = m.model_slug;
  // Slugs are the stored model name with spaces as hyphens ("1-series",
  // "xc90", "e-tron", "model-3"). Give displayModel the spaced form where the
  // page itself would show a space.
  const spaced = modelSlug
    .replace(/^(\d+)-series$/, "$1 series")
    .replace(/^model-(\w+)$/, "model $1")
    .replace(/^(\w+)-class$/, "$1-class");
  return `${titleCase(makeSlug)} ${displayModel(makeSlug, spaced)}`;
}

async function getLinks() {
  let makes: MakeRow[] = [];
  let models: ModelRow[] = [];
  let guides: { href: string; label: string }[] = [];
  try {
    const res = await fetch(`${API_BASE}/import-landing-index`, { next: { revalidate: 3600 } });
    const json = await res.json();
    makes = json?.data?.makes ?? [];
    // The index is ordered by stock, and one make with many variants (BMW)
    // filled all 40 slots. Take the top two models of each make instead, in
    // stock order, so the row reads across the market.
    const perMake = new Map<string, number>();
    models = ((json?.data?.models ?? []) as ModelRow[]).filter((m) => {
      const n = perMake.get(m.make_slug) ?? 0;
      if (n >= 2) return false;
      perMake.set(m.make_slug, n + 1);
      return true;
    }).slice(0, MODEL_LINKS);
  } catch {
    // Index unreachable: the footer still renders the counties and the rest.
  }
  try {
    const res = await fetch(`${API_BASE}/get-blogs`, { next: { revalidate: 3600 } });
    const json = await res.json();
    guides = ((json?.data ?? []) as BlogRow[])
      .filter((b) => b.blog_url && b.blog_heading)
      .map((b) => ({ href: `/blog/${b.blog_url}`, label: String(b.blog_heading) }));
  } catch {
    // Blog API unreachable: skip the guides row.
  }
  return { makes, models, guides };
}

export default async function FooterBrowse() {
  const { makes, models, guides } = await getLinks();
  return (
    <nav className={styles.browse} aria-label="Browse the site">
      {makes.length > 0 && (
        <div className={styles.browseRow}>
          <h3>Import by make</h3>
          <ul>
            {makes.map((m) => (
              <li key={m.slug}>
                <Link href={`/import/${m.slug}`}>{titleCase(m.make)}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {models.length > 0 && (
        <div className={styles.browseRow}>
          <h3>Popular models</h3>
          <ul>
            {models.map((m) => (
              <li key={`${m.make_slug}/${m.model_slug}`}>
                <Link href={`/import/${m.make_slug}/${m.model_slug}`}>
                  {modelLabel(m)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.browseRow}>
        <h3>Used cars by county</h3>
        <ul>
          {COUNTIES.map((c) => (
            <li key={c.slug}>
              <Link href={`/used-cars/${c.slug}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.browseRow}>
        <h3>Guides</h3>
        <ul>
          <li><Link href="/how-it-works">How importing works</Link></li>
          <li><Link href="/car-sourcing">Car sourcing</Link></li>
          <li><Link href="/trade-ins">Trade-ins</Link></li>
          <li><Link href="/sell-my-car">Sell my car</Link></li>
          {guides.map((g) => (
            <li key={g.href}>
              <Link href={g.href}>{g.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
