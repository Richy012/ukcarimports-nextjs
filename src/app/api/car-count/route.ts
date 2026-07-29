// Same-origin proxy for the FilterBar's live result count, same reason as
// api/models/route.ts: Cloudflare's api-cors-backstop rule blocks browser
// calls from staging.ukcarimports.ie straight to api.ukcarimports.ie.
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/allcarsnew/0/1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
