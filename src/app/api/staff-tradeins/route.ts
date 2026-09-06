import { NextRequest, NextResponse } from "next/server";
import { readOnly, dealForStaff } from "../../../lib/dealstore";

/**
 * Trade-in submissions for the STAFF dashboard. Staging.
 *
 * Gate: the staff JWT is minted by the Lumen API, and this app cannot check
 * its signature. So the token is forwarded to a Lumen endpoint that only
 * answers for staff (the same one the dashboard's leads panel uses); a 200
 * there is the proof. No admin key in the browser, nothing new to remember.
 *
 * Never cached — this carries customer names and phone numbers, and the
 * 2026-08-04 leak was exactly an edge-cached authenticated response.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "X-Auth-Token",
};

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-auth-token") || "";
  if (!token) return NextResponse.json({ ok: false, error: "staff only" }, { status: 401, headers: NO_STORE });

  let staff = false;
  try {
    const r = await fetch("https://api.ukcarimports.ie/public/user/get-leads", {
      headers: { "X-Auth-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    staff = r.status === 200;
  } catch {
    staff = false;
  }
  if (!staff) return NextResponse.json({ ok: false, error: "staff only" }, { status: 403, headers: NO_STORE });

  const deals = await readOnly((db) =>
    [...db.deals]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((d) => {
        const s = dealForStaff(d, db) as Record<string, unknown>;
        delete s.buyerToken; // the buyer's magic link is theirs, not ours to show
        return s;
      }),
  );
  return NextResponse.json({ ok: true, deals }, { headers: NO_STORE });
}
