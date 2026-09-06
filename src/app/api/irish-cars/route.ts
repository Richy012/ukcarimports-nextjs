import { NextRequest, NextResponse } from "next/server";
import { irishListings, irishListing } from "../../../lib/irishListings";
import { notify } from "../../../lib/dealnotify";

/**
 * Public read of the Irish-registered (Above Board Cars) cars, and the enquiry
 * path for one of them. STAGING.
 *
 * GET  /api/irish-cars           every live listing (no seller details)
 * GET  /api/irish-cars?id=deal_x one listing
 * POST /api/irish-cars           {id, name, email, phone, message}
 *      An enquiry never reaches the seller directly: it goes to us, and we
 *      pass it on. That is the point of Above Board Cars — the seller is not
 *      fielding strangers.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (id) {
    const one = await irishListing(id);
    return one
      ? NextResponse.json({ ok: true, listing: one })
      : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, listings: await irishListings() });
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  const id = str(b.id, 64);
  const name = str(b.name, 120);
  const email = str(b.email, 200).toLowerCase();
  const phone = str(b.phone, 40);
  const message = str(b.message, 2000);
  if (!id || !name || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "name and a valid email are required" }, { status: 400 });
  }
  const listing = await irishListing(id);
  if (!listing) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  await notify({
    audience: "staff",
    to: null,
    dealId: id,
    kind: "irish_car_enquiry",
    subject: `Enquiry on ${listing.title} (Above Board Cars listing ${id})`,
    body: [
      `A buyer has enquired about the ${listing.title} advertised on ukcarimports.ie.`,
      ``,
      `Name:   ${name}`,
      `Email:  ${email}`,
      `Phone:  ${phone || "-"}`,
      ``,
      message ? `Message:\n${message}` : "(no message)",
      ``,
      `The seller has NOT been contacted. Pass it on from the staff Trade-ins page.`,
    ].join("\n"),
  });
  return NextResponse.json({ ok: true });
}
