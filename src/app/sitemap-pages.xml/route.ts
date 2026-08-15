export const revalidate = 86400;

const API_BASE = "https://api.ukcarimports.ie/public";
const SITE = "https://ukcarimports.ie";

// The page-level sitemap: static pages plus the /import make and model
// landing pages. This is exactly what app/sitemap.ts emitted before the car
// pages needed an index; only the delivery moved.
export async function GET() {
  const fixed: { loc: string; freq: string; pri: string }[] = [
    { loc: `${SITE}/`, freq: "daily", pri: "1.0" },
    { loc: `${SITE}/used-cars`, freq: "hourly", pri: "0.9" },
    { loc: `${SITE}/how-it-works`, freq: "monthly", pri: "0.7" },
    { loc: `${SITE}/car-sourcing`, freq: "monthly", pri: "0.6" },
    { loc: `${SITE}/faq`, freq: "monthly", pri: "0.5" },
    { loc: `${SITE}/about-us`, freq: "monthly", pri: "0.4" },
    { loc: `${SITE}/blog`, freq: "weekly", pri: "0.5" },
    { loc: `${SITE}/contact`, freq: "yearly", pri: "0.3" },
  ];

  const urls = [...fixed];
  try {
    const res = await fetch(`${API_BASE}/import-landing-index`, {
      next: { revalidate: 86400 },
    });
    const json = await res.json();
    const data = json?.data;
    for (const m of data?.makes ?? []) {
      urls.push({ loc: `${SITE}/import/${m.slug}`, freq: "daily", pri: "0.8" });
    }
    for (const m of data?.models ?? []) {
      urls.push({
        loc: `${SITE}/import/${m.make_slug}/${m.model_slug}`,
        freq: "daily",
        pri: "0.7",
      });
    }
  } catch {
    // Landing index unreachable: publish the static pages rather than nothing.
  }


  // 2026-08-15: individual blog posts were in no sitemap at all - only the
  // /blog index was listed, leaving Google to find every article by crawling
  // that page. The guides are the SEO asset, so they get their own entries.
  try {
    const res = await fetch(`${API_BASE}/get-blogs`, { next: { revalidate: 3600 } });
    const json = await res.json();
    for (const b of json?.data ?? []) {
      if (b?.blog_url) {
        urls.push({ loc: `${SITE}/blog/${b.blog_url}`, freq: "monthly", pri: "0.6" });
      }
    }
  } catch {
    // Blog API unreachable: publish the rest rather than nothing.
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `<url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`,
      )
      .join("\n") +
    `\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
