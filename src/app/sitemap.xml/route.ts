export const revalidate = 3600;

const API_BASE = "https://api.ukcarimports.ie/public";
const SITE = "https://ukcarimports.ie";

type Part = { key: string; count: number; lastmod: string | null };

// Sitemap index. ~129k car URLs are far past Google's 50,000-per-file limit,
// so the car pages are split across /sitemap-cars/<part>.xml and listed here.
// robots.txt and Search Console point at /sitemap.xml, so nothing needs
// resubmitting when the parts change.
//
// 1 Oct 2026: parts are fixed car_id ranges (half-months of advert creation
// date, plus "new" for the last 48 h and "older" for pre-2026 ids) instead of
// 25,000-row offsets. Offsets slid between one part's cache and the next's and
// left ~21,000 live cars in no part. Each entry now carries the part's real
// newest lastmod; the previous index stamped every child with now(), which is
// exactly what makes Google ignore lastmod.
export async function GET() {
  let parts: Part[] = [];
  try {
    const res = await fetch(`${API_BASE}/sitemap/cars-index`, {
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    parts = json?.data?.parts ?? [];
  } catch {
    // Car index unreachable: still publish the page sitemap rather than
    // serving Google an empty or broken index.
    parts = [];
  }

  const entries = [`<sitemap><loc>${SITE}/sitemap-pages.xml</loc></sitemap>`];
  for (const p of parts) {
    if (!/^(new|older|\d{4}-\d{2}[ab])$/.test(p.key)) continue;
    entries.push(
      `<sitemap><loc>${SITE}/sitemap-cars/${p.key}.xml</loc>` +
        (p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : "") +
        `</sitemap>`,
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
