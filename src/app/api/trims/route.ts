import { NextRequest, NextResponse } from "next/server";
import { trimsFor } from "../../../lib/trimIndex";

/**
 * The trims we can actually price for a make and model.
 *
 * This exists so the form offers a DROPDOWN rather than a text box. A text box
 * would recreate the exact problem the trim index solves: Carzone's own free-
 * text version field holds 20,515 near-unique strings and is useless for
 * grouping, which is why knowing the trim was worth EUR 71 before it was
 * normalised against our own catalogue's vocabulary and EUR 753-2,235 after.
 * A customer typing "amg line prem+" would land back in that mess.
 *
 * An empty list is a normal answer - it means we hold no priceable trims for
 * that car, and the form should not ask the question at all rather than ask it
 * and ignore the reply.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const make = (req.nextUrl.searchParams.get("make") || "").trim();
  const model = (req.nextUrl.searchParams.get("model") || "").trim();
  if (!make || !model) {
    return NextResponse.json({ ok: false, error: "make and model are required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, trims: await trimsFor(make, model) });
}
