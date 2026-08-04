// Shared same-origin proxy for authenticated/write API calls made from
// client components. Cloudflare's api-cors-backstop rule only allows
// https://ukcarimports.ie as a browser Origin, so any client-side fetch
// straight to api.ukcarimports.ie from staging.ukcarimports.ie is blocked
// before it ever leaves the browser (confirmed live: `fetch()` throws
// "Failed to fetch" even though the API itself works fine) -- same reason
// api/models and api/car-count already exist. Every other endpoint a client
// component calls needs the same treatment, hence this shared helper.
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

export async function proxyRequest(req: NextRequest, apiPath: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authToken = req.headers.get("x-auth-token");
  if (authToken) headers["X-Auth-Token"] = authToken;

  // Forward the browser's Origin. Server-to-server fetch drops it otherwise,
  // and the API uses it to decide which site a request came from -- the
  // deposit success/cancel URLs, and (during a deposit test window) which
  // Stripe key to use. Without this every proxied deposit looked origin-less
  // and fell back to the live key, so a staging test produced a cs_live_
  // session and Stripe rejected the 4242 test card.
  const origin = req.headers.get("origin");
  if (origin) headers["Origin"] = origin;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const res = await fetch(`${API_BASE}${apiPath}`, {
    method: req.method,
    headers,
    body: body || undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  // NEVER let a proxied response be cached. Found live 2026-08-04: Cloudflare
  // had edge-cached an authenticated /api/staff-leads response and was then
  // serving that customer data (names, emails, phones) to ANY anonymous
  // request, and simultaneously showing staff a stale list. Auth was working
  // correctly -- the cache was the whole leak. Private + no-store on every
  // proxied response, belt and braces with the Cloudflare bypass rule.
  return NextResponse.json(data, {
    status: res.status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      Vary: "X-Auth-Token, Origin",
    },
  });
}
