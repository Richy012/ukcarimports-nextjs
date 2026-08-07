export const revalidate = 21600;

const API_BASE = "https://api.ukcarimports.ie/public";
const SITE = "https://ukcarimports.ie";

// Sitemap index. 114k car URLs are far past Google's 50,000-per-file limit,
// so the car pages are split across /sitemap-cars/N.xml and listed here.
// robots.txt and Search Console already point at /sitemap.xml, so making this
// the index means nothing needs resubmitting.
export async function GET() {
  let parts = 1;
  try {
    const res = await fetch(`${API_BASE}/sitemap/cars-part/0`, {
      next: { revalidate: 21600 },
    });
    const json = await res.json();
    parts = Math.max(1, Number(json?.data?.parts) || 1);
  } catch {
    // Car files unreachable: still publish the page sitemap rather than
    // serving Google an empty or broken index.
    parts = 0;
  }

  const now = new Date().toISOString();
  const children = [
    `${SITE}/sitemap-pages.xml`,
    ...Array.from({ length: parts }, (_, i) => `${SITE}/sitemap-cars/${i}.xml`),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    children
      .map((loc) => `<sitemap><loc>${loc}</loc><lastmod>${now}</lastmod></sitemap>`)
      .join("\n") +
    `\n</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=21600",
    },
  });
}
