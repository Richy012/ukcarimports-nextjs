import { NextRequest, NextResponse } from "next/server";
import { valueTradeIn } from "../../../lib/valuation";
import { priceRoutes } from "../../../lib/routePricing";

/**
 * A price per route for one car — the data behind the intro page the owner
 * asked for on 4 Sep. Read-only, no side effects, nothing stored.
 *
 * Both routes come off the SAME Irish dealer median for the exact car, which
 * is what stops two cards contradicting each other. The retail ladder is
 * lib/valuation.ts, untouched; this only decides what share of it each route
 * keeps.
 *
 * The garage-package route (prong 2) is deliberately ABSENT: its fee is €500
 * in the design document and €900 in the built Deal Builder, and at €900 that
 * card shows less money than the wholesale route on cars under about €12,500,
 * so the page would argue against itself. That is the owner's decision to
 * make, and until it is made the card cannot honestly be rendered.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const make = (q.get("make") || "").trim();
  const model = (q.get("model") || "").trim();
  if (!make || !model) {
    return NextResponse.json({ ok: false, error: "make and model are required" }, { status: 400 });
  }

  const yearNum = Number((q.get("year") || "").trim());
  const year =
    Number.isInteger(yearNum) && yearNum >= 1980 && yearNum <= 2035 ? yearNum : null;

  const raw = Number((q.get("km") || q.get("mileage") || "").replace(/[^0-9.]/g, ""));
  const unit = (q.get("unit") || "km").toLowerCase();
  const km =
    Number.isFinite(raw) && raw > 0
      ? Math.round(unit.startsWith("mi") ? raw * 1.609 : raw)
      : null;

  if (!km) {
    return NextResponse.json(
      { ok: false, error: "mileage is required — no route can be priced without it" },
      { status: 400 },
    );
  }

  const trim = (q.get("trim") || "").trim().toUpperCase().slice(0, 40) || null;

  const valuation = await valueTradeIn(make, model, year, km, trim);
  const pricing = await priceRoutes(
    make,
    model,
    year,
    km,
    valuation.estimateEur,
    valuation.comparables,
  );

  if (!pricing) {
    return NextResponse.json({
      ok: true,
      priced: false,
      reason: valuation.note,
      valuation,
    });
  }

  return NextResponse.json({ ok: true, priced: true, valuation, pricing });
}
