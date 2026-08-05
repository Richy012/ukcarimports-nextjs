// Legacy make/model landing URLs (/used-cars/ireland/{make}/{model?}) still
// rank on Google (GSC 2026-08-05: thousands of impressions) but died at
// cutover. 301 them into the filtered listing — with a stock probe to decide
// whether a hyphen is a real hyphen (mercedes-benz, e-tron) or the legacy
// URL-safe form of a space (land-rover, alfa-romeo). Static config redirects
// can't make that call; one cached count probe per variant can.
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

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
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean)
    .slice(0, 2);

  const dest = new URL("/used-cars", req.nextUrl.origin);
  if (parts.length > 0) {
    const [make, model = ""] = parts;
    // Try the raw values first (real hyphens), then the de-hyphenated form.
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
  }
  return NextResponse.redirect(dest, 301);
}
