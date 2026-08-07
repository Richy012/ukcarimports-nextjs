export const revalidate = 21600;

const API_BASE = "https://api.ukcarimports.ie/public";
const SITE = "https://ukcarimports.ie";

type CarRow = { id: string; lastmod: string | null };

// One chunk of car URLs. The API applies the same rules the listing applies
// (live, VRT-matched, not vrt-pending, >= EUR 15,000), so every URL here is a
// page a visitor can actually reach -- a sitemap full of soft 404s costs more
// crawl budget than it wins.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ part: string }> },
) {
  const { part } = await ctx.params;
  const n = Number(String(part).replace(/\.xml$/, ""));
  if (!Number.isFinite(n) || n < 0) {
    return new Response("Not found", { status: 404 });
  }

  let cars: CarRow[] = [];
  try {
    const res = await fetch(`${API_BASE}/sitemap/cars-part/${n}`, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) return new Response("Not found", { status: 404 });
    const json = await res.json();
    cars = json?.data?.cars ?? [];
  } catch {
    return new Response("Temporarily unavailable", { status: 503 });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    cars
      .map(
        (c) =>
          `<url><loc>${SITE}/car/${c.id}</loc>` +
          (c.lastmod ? `<lastmod>${c.lastmod}</lastmod>` : "") +
          `<changefreq>daily</changefreq></url>`,
      )
      .join("\n") +
    `\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=21600",
    },
  });
}
