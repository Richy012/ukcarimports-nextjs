import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

// Not using the generic proxyRequest() helper here because this route needs
// to inject redirect_base -- the API now defaults reset links to the live
// site (ukcarimports.ie) unless told otherwise, and staging needs its own
// reset-password page, not the live site's.
//
// Website review 3 Oct 2026 #8: this file is shared with staging and had the
// staging address hard-coded, so reset emails from the live site sent customers
// to staging. The address now follows the site the request came from, and is
// the live site unless that is clearly staging (the API allow-lists both).
const LIVE_SITE = "https://ukcarimports.ie";
const STAGING_SITE = "https://staging.ukcarimports.ie";

function siteFor(req: NextRequest): string {
  const origin = (req.headers.get("origin") || "").trim().toLowerCase();
  if (origin === STAGING_SITE) return STAGING_SITE;
  if (origin === LIVE_SITE || origin === "https://www.ukcarimports.ie") return LIVE_SITE;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  return host === "staging.ukcarimports.ie" ? STAGING_SITE : LIVE_SITE;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_BASE}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, redirect_base: siteFor(req) }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
