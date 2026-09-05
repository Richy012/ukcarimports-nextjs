// Same-origin proxy for the facet count endpoints, so the client can refresh
// dropdown counts when a filter changes without a page reload. Added
// 2026-08-04: toggling Bestseller Series left every dropdown showing
// whole-stock counts ("hyundai (5,947)" when only 373 Hyundais are
// Bestsellers), because the counts were only ever rendered server-side.
// 2026-09-05: every dropdown is now connected to every other filter, and
// colour and engine size became real facets, so models, colors and
// engine-types joined the list. Same CORS reasoning as the models route.
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";
const ALLOWED = new Set([
  "makes",
  "models",
  "fuel-types",
  "body-styles",
  "transmission-types",
  "seats",
  "colors",
  "engine-types",
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: "unknown facet" }, { status: 404 });
  }
  const body = await req.text();
  const res = await fetch(`${API_BASE}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, {
    status: res.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
