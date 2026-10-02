import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy for the Search features box's "Do you mean ...?" coaching (owner, 3 Oct 2026). Browser calls to
// api.ukcarimports.ie are CORS-blocked from the site, same reason as api/models and api/car-count.
const API_BASE = "https://api.ukcarimports.ie/public";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 80);
  if (!q.trim()) return NextResponse.json({ resolved: null, suggestions: [] });
  try {
    const res = await fetch(`${API_BASE}/feature-resolve?q=${encodeURIComponent(q)}`, { next: { revalidate: 300 } });
    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ resolved: null, suggestions: [] });
  }
}
