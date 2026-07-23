// Same-origin proxy for the Make->Model dependent dropdown. The client
// component can't call api.ukcarimports.ie directly: Cloudflare's
// api-cors-backstop rule hardcodes Access-Control-Allow-Origin to exactly
// https://ukcarimports.ie, which blocks staging.ukcarimports.ie. Server-to-
// server calls (this route to the API) aren't subject to browser CORS at
// all, so proxying through here sidesteps the restriction entirely.
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
