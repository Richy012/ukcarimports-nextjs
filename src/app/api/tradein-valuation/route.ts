import { NextRequest, NextResponse } from "next/server";
import { valueTradeIn } from "../../../lib/valuation";

// Tiny read-only wrapper over lib/valuation.ts so the buyer flow can price a
// trade-in the moment the reg lookup lands. No firm valuation exists here:
// the answer is a band + comparables count, or "not enough Irish evidence".

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const make = (req.nextUrl.searchParams.get("make") || "").trim();
  const model = (req.nextUrl.searchParams.get("model") || "").trim();
  const yearRaw = (req.nextUrl.searchParams.get("year") || "").trim();

  if (!make || !model) {
    return NextResponse.json(
      { ok: false, error: "make and model are required" },
      { status: 400 },
    );
  }

  const yearNum = Number(yearRaw);
  const year =
    Number.isInteger(yearNum) && yearNum >= 1980 && yearNum <= 2035 ? yearNum : null;

  // Mileage is optional and the answer is strictly better with it: it is the
  // strongest single thing we know about the car. Accept either name, and
  // accept miles, because the trade-in form offers both units.
  const kmRaw = Number(
    (req.nextUrl.searchParams.get("km") || req.nextUrl.searchParams.get("mileage") || "")
      .replace(/[^0-9.]/g, ""),
  );
  const unit = (req.nextUrl.searchParams.get("unit") || "km").toLowerCase();
  const km =
    Number.isFinite(kmRaw) && kmRaw > 0
      ? Math.round(unit.startsWith("mi") ? kmRaw * 1.609 : kmRaw)
      : null;

  const trim =
    (req.nextUrl.searchParams.get("trim") || "").trim().toUpperCase().slice(0, 40) || null;

  const valuation = await valueTradeIn(make, model, year, km, trim);
  return NextResponse.json({ ok: true, valuation });
}
