export const revalidate = 3600;

const API_BASE = "https://api.ukcarimports.ie/public";
const SITE = "https://ukcarimports.ie";

type CarRow = { id: string; lastmod: string | null };

// One part of the car sitemap: a fixed car_id range ("2026-09b" = adverts
// created 16-30 Sep 2026), "new" (saved in the last 48 h) or "older"
// (pre-2026 ids). The API applies the same rules the listing applies (live,
// VRT-matched, not vrt-pending, priced), so every URL here is a page a visitor
// can actually reach. The old numeric parts (0-5) 404 on purpose: they were
// offsets into a moving list, which is the defect this replaces.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ part: string }> },
) {
  const { part } = await ctx.params;
  const key = String(part).replace(/\.xml$/, "").toLowerCase();
  if (!/^(new|older|\d{4}-\d{2}[ab])$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  let cars: CarRow[] = [];
  try {
    const res = await fetch(`${API_BASE}/sitemap/cars-part/${key}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new Response("Not found", { status: 404 });
    const json = await res.json();
    cars = json?.data?.cars ?? [];
  } catch {
    return new Response("Temporarily unavailable", { status: 503 });
  }

  // No changefreq: it was "daily" for every car, which is untrue for most and
  // ignored by Google anyway. lastmod is the car's own last_updated_ts.
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    cars
      .map(
        (c) =>
          `<url><loc>${SITE}/car/${c.id}</loc>` +
          (c.lastmod ? `<lastmod>${c.lastmod}</lastmod>` : "") +
          `</url>`,
      )
      .join("\n") +
    `\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
