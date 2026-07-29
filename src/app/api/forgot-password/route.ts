import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

// Not using the generic proxyRequest() helper here because this route needs
// to inject redirect_base -- the API now defaults reset links to the live
// site (ukcarimports.ie) unless told otherwise, and staging needs its own
// reset-password page, not the live site's.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_BASE}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, redirect_base: "https://staging.ukcarimports.ie" }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
