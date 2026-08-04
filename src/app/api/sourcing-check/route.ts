// Pre-check for the car-sourcing page: paste a UK advert URL and find out,
// before paying anything, whether (a) we already have that car, (b) the
// seller refuses Irish/trade buyers, or (c) sourcing is the right route.
//
// Built 2026-08-04 after a customer paid attention to a cinch iX3 we could
// never have bought for him: cinch's own terms require the buyer to be UK
// resident and bar purchases "in the course of business". Doing this by hand
// took an evening; the site should answer it in a second.
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.ukcarimports.ie/public";

// Sellers we cannot buy from, with the real reason. Keep in step with
// ExcludeBannedDealers::BANNED_NAME_PREFIXES on the API side.
const BLOCKED: { match: RegExp; name: string; reason: string }[] = [
  {
    match: /cinch\.co\.uk/i,
    name: "cinch",
    reason:
      "cinch's own terms require the buyer to be resident in the United Kingdom, and separately bar buying a car in the course of business. Neither you nor we can complete a purchase there.",
  },
  {
    match: /cazoo\.co\.uk/i,
    name: "Cazoo",
    reason: "Cazoo sells to UK-resident private buyers only and does not release cars for export.",
  },
  {
    match: /(johnclark|jcselect)\.co\.uk/i,
    name: "John Clark",
    reason: "This group does not sell for export to Ireland.",
  },
  {
    match: /arnoldclark\.com/i,
    name: "Arnold Clark",
    reason: "Arnold Clark does not release stock for export to Ireland.",
  },
  {
    match: /marshall\.co\.uk/i,
    name: "Marshall",
    reason: "Marshall does not sell for export to Ireland.",
  },
  {
    match: /motorline\.co\.uk/i,
    name: "Motorline",
    reason: "Motorline does not sell for export to Ireland.",
  },
  {
    match: /parks(motorgroup)?\.co\.uk/i,
    name: "Park's",
    reason: "Park's does not sell for export to Ireland.",
  },
];

// Pull make/model out of a dealer URL path. Most UK sites use
// /used-cars/<make>/<model>/... which is enough to search our own stock.
function guessMakeModel(url: string): { make?: string; model?: string } {
  try {
    const parts = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
    const skip = new Set(["used-cars", "used", "cars", "car", "vehicle", "vehicles", "details", "search", "stock", "classified"]);
    const words = parts.filter((p) => !skip.has(p) && !/^\d+$/.test(p) && p.length > 1 && !/^[0-9a-f-]{20,}$/.test(p));
    return { make: words[0]?.replace(/-/g, " "), model: words[1]?.replace(/-/g, " ") };
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({ url: "" }));
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ status: "invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const blocked = BLOCKED.find((b) => b.match.test(url));
  const { make, model } = guessMakeModel(url);

  // What we already have, so a customer never pays to source something in stock.
  let matches: { car_id: string; car_name: string; price: number | null; mileage: string }[] = [];
  if (make) {
    try {
      const res = await fetch(`${API_BASE}/get-all-used-cars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Make: make, Model: model || "", minPrice: "15000", pagenum: 0, limit: 3 }),
        cache: "no-store",
      });
      const json = await res.json();
      matches = (json?.data?.cars ?? []).slice(0, 3).map((c: Record<string, unknown>) => ({
        car_id: String(c.car_id),
        car_name: String(c.car_name ?? ""),
        price: (c.car_info as { final_price?: number } | undefined)?.final_price ?? null,
        mileage: String(c.mileage ?? ""),
      }));
    } catch {
      /* a failed lookup must never block the answer */
    }
  }

  return NextResponse.json(
    {
      status: blocked ? "blocked" : matches.length ? "in_stock" : "sourceable",
      seller: blocked?.name ?? null,
      reason: blocked?.reason ?? null,
      make: make ?? null,
      model: model ?? null,
      matches,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
