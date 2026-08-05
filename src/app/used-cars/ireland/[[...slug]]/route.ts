// Legacy make/model landing URLs (/used-cars/ireland/{make}/{model?}) still
// rank on Google (GSC 2026-08-05: thousands of impressions) but died at
// cutover. They now 301 into the /import/{make}[/{model}] SEO landing pages
// when one exists (the legacy path segments are already slugs, and the
// import-landing endpoint resolves families like bmw/3-series itself) —
// falling back to the filtered listing via the stock probe that resolves
// hyphen ambiguity (mercedes-benz and e-tron are real hyphens, land-rover is
// the legacy URL-safe form of a space).
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";
// Behind the Apache proxy SITE is localhost:3101 — redirects
// must carry the canonical public origin.
const SITE = "https://ukcarimports.ie";

async function landingExists(makeSlug: string, modelSlug?: string): Promise<boolean> {
  try {
    const url =
      `${API_BASE}/import-landing/${encodeURIComponent(makeSlug)}` +
      (modelSlug ? `?model=${encodeURIComponent(modelSlug)}` : "");
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json?.data && (!modelSlug || !!json.data.model);
  } catch {
    return false;
  }
}

async function stockCount(make: string, model: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/allcarsnew/0/1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Make: make, Model: model, minPrice: "15000", pagenum: 0, limit: 1 }),
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    return Number(data?.data?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const parts = (slug ?? [])
    .map((s) => decodeURIComponent(s).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length > 0) {
    const [make, model = ""] = parts;

    // Preferred destination: the SEO landing page for this make/model.
    if (await landingExists(make, model || undefined)) {
      const dest = new URL(
        model ? `/import/${make}/${model}` : `/import/${make}`,
        SITE,
      );
      return NextResponse.redirect(dest, 301);
    }

    // Fallback: the filtered listing, with the stock probe deciding whether
    // a hyphen is a real hyphen or a space.
    const dest = new URL("/used-cars", SITE);
    const candidates: Array<[string, string]> = [[make, model]];
    const spacedMake = make.replace(/-/g, " ");
    const spacedModel = model.replace(/-/g, " ");
    if (spacedMake !== make || spacedModel !== model) {
      candidates.push([spacedMake, spacedModel]);
      if (spacedMake !== make && model) candidates.push([spacedMake, model]);
      if (spacedModel !== model && make) candidates.push([make, spacedModel]);
    }
    let chosen = candidates[0];
    for (const c of candidates) {
      if ((await stockCount(c[0], c[1])) > 0) {
        chosen = c;
        break;
      }
    }
    dest.searchParams.set("Make", chosen[0]);
    if (chosen[1]) dest.searchParams.set("Model", chosen[1]);
    return NextResponse.redirect(dest, 301);
  }

  return NextResponse.redirect(new URL("/used-cars", SITE), 301);
}
