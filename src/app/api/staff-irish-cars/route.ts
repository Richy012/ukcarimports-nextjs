import { NextRequest, NextResponse } from "next/server";
import { withDb, nowIso } from "../../../lib/dealstore";
import { listingAudit } from "../../../lib/irishListings";

/**
 * Above Board Cars listings for the STAFF dashboard.
 *
 * Owner, 9 Sep 2026: a private-sale car was on the site with no photos and
 * nothing in admin registered it. GET lists every private-sale car with the
 * exact reason it is or is not advertised; POST pulls one off the site or puts
 * it back.
 *
 * Pulling a car down sets `listingHidden` on the deal, NOT its status: the
 * status runs the auction and withdrawing a live deal to fix a photo would be
 * a different, much worse thing.
 *
 * Gate: same as /api/staff-tradeins — the staff JWT is minted by the Lumen
 * API and this app cannot verify its signature, so the token is forwarded to a
 * staff-only Lumen endpoint and a 200 is the proof. Never cached; this carries
 * sellers' names and phone numbers, and the 2026-08-04 leak was exactly an
 * edge-cached authenticated response.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "X-Auth-Token",
};

async function isStaff(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-auth-token") || "";
  if (!token) return false;
  try {
    const r = await fetch("https://api.ukcarimports.ie/public/user/get-leads", {
      headers: { "X-Auth-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await isStaff(req))) {
    return NextResponse.json({ ok: false, error: "staff only" }, { status: 403, headers: NO_STORE });
  }
  const listings = await listingAudit();
  return NextResponse.json({ ok: true, listings }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!(await isStaff(req))) {
    return NextResponse.json({ ok: false, error: "staff only" }, { status: 403, headers: NO_STORE });
  }
  let body: { id?: string; hidden?: boolean; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // fall through to the validation below
  }
  const id = (body.id || "").trim();
  if (!id || typeof body.hidden !== "boolean") {
    return NextResponse.json({ ok: false, error: "id and hidden are required" }, { status: 400, headers: NO_STORE });
  }
  const reason = (body.reason || "").slice(0, 200);

  const result = await withDb((db) => {
    const d = db.deals.find((x) => x.id === id && x.tradeIn?.route === "privateproof");
    if (!d) return { ok: false as const, error: "no such private-sale car" };
    d.listingHidden = body.hidden;
    d.listingHiddenAt = body.hidden ? nowIso() : null;
    d.listingHiddenReason = body.hidden ? reason || "pulled by staff" : null;
    d.updatedAt = nowIso();
    d.history.push({
      at: nowIso(),
      event: body.hidden ? "listing pulled from site" : "listing put back on site",
      detail: body.hidden ? d.listingHiddenReason || "" : "",
    });
    return { ok: true as const };
  });

  if (!result.ok) return NextResponse.json(result, { status: 404, headers: NO_STORE });
  const listings = await listingAudit();
  return NextResponse.json({ ok: true, listings }, { headers: NO_STORE });
}
