import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

// Same facet endpoints the public /used-cars server page calls; whitelisted
// so this proxy can't be pointed at arbitrary API paths.
const ALLOWED = new Set(["makes", "fuel-types", "body-styles", "transmission-types", "seats"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ facet: string }> }) {
  const { facet } = await params;
  if (!ALLOWED.has(facet)) {
    return NextResponse.json({ error: "Unknown facet" }, { status: 404 });
  }
  const body = await req.text();
  const res = await fetch(`${API_BASE}/${facet}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
