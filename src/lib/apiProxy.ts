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

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const res = await fetch(`${API_BASE}${apiPath}`, {
    method: req.method,
    headers,
    body: body || undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
