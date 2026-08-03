// Same-origin proxy for the FilterBar's live result count, same reason as
// api/models/route.ts: Cloudflare's api-cors-backstop rule blocks browser
// calls from staging.ukcarimports.ie straight to api.ukcarimports.ie.
import { NextRequest, NextResponse } from "next/server";
import { toTileCar } from "@/lib/publicCar";

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
  // Project rows to tile fields: full rows made every scroll batch ~700KB.
  if (Array.isArray(data?.data?.cars)) {
    data.data.cars = data.data.cars.map(toTileCar);
  }
  return NextResponse.json(data, { status: res.status });
}
