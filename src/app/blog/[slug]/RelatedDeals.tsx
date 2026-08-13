// Live internal links from article content into the bestseller inventory
// (owner-approved 2026-08-14). Server-rendered so Google gets real <a> tags
// and readers get live numbers; links go to MODEL/MAKE import pages only —
// never individual cars, which sell and die within days at our churn.
import { getLanding, titleCase, displayModel } from "@/app/import/ImportLanding";
import s from "./RelatedDeals.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

// Brand names that are ordinary English words: only match them written the
// way the brand is written (SEAT the car is never lowercase "seat").
const AMBIGUOUS = new Set(["seat", "mini", "mg", "ds", "smart"]);

interface IndexData {
  makes: { make: string; slug: string; n: number }[];
  models: { make_slug: string; model_slug: string; n: number }[];
}

async function getIndex(): Promise<IndexData | null> {
  try {
    const res = await fetch(`${API_BASE}/import-landing-index`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

function slugPattern(slug: string): RegExp {
  return new RegExp("\\b" + slug.replace(/-/g, "[ -]") + "\\b", "i");
}

function makeMentioned(text: string, slug: string): boolean {
  if (AMBIGUOUS.has(slug)) {
    return new RegExp("\\b" + slug.toUpperCase() + "\\b").test(text);
  }
  return slugPattern(slug).test(text);
}

export default async function RelatedDeals({ text }: { text: string }) {
  const idx = await getIndex();
  if (!idx) return null;
  const plain = text.replace(/<[^>]+>/g, " ");

  const makeHits = idx.makes.filter((m) => makeMentioned(plain, m.slug));
  if (makeHits.length === 0) return null;
  const makeSlugs = new Set(makeHits.map((m) => m.slug));

  const modelHits = idx.models
    .filter((md) => makeSlugs.has(md.make_slug) && slugPattern(md.model_slug).test(plain))
    .slice(0, 4);

  const targets: { make: string; model?: string }[] = modelHits.length
    ? modelHits.map((md) => ({ make: md.make_slug, model: md.model_slug }))
    : makeHits.slice(0, 2).map((m) => ({ make: m.slug }));

  const landings = await Promise.all(
    targets.map((t) => getLanding(t.make, t.model).then((d) => ({ t, d }))),
  );

  const cards = landings
    .filter((x) => x.d && x.d.count > 0)
    .map((x) => {
      const d = x.d!;
      const name = x.t.model
        ? `${titleCase(d.make)} ${displayModel(d.make, d.model || x.t.model)}`
        : titleCase(d.make);
      const saving =
        d.bestseller && d.bestseller.count > 0 ? Math.round(d.bestseller.max_saving_eur) : null;
      return {
        href: x.t.model ? `/import/${x.t.make}/${x.t.model}` : `/import/${x.t.make}`,
        name,
        count: d.count,
        saving,
      };
    })
    .sort((a, b) => (b.saving ?? 0) - (a.saving ?? 0))
    .slice(0, 3);

  if (cards.length === 0) return null;

  return (
    <aside className={s.panel}>
      <div className={s.kicker}>LIVE FROM THE BESTSELLER INDEX</div>
      {cards.map((c) => (
        <a key={c.href} href={c.href} className={s.card}>
          <span className={s.name}>{c.name}</span>
          <span className={s.facts}>
            {c.count.toLocaleString()} available from the UK
            {c.saving ? ` · up to €${c.saving.toLocaleString()} under Irish prices` : ""}
          </span>
        </a>
      ))}
      <a href="/best-value" className={s.moreLink}>
        See every car priced under the Irish market — with the maths →
      </a>
    </aside>
  );
}
