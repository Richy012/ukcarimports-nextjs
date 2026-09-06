import { NextRequest, NextResponse } from "next/server";
import { withDb, moveDeal } from "../../../../lib/dealstore";
import { notify, lines } from "../../../../lib/dealnotify";

// Buyer withdraws the deal. Legal from submitted / live / paused_car — the
// state machine in dealstore enforces exactly that, so an attempt from any
// other status comes back as "illegal transition". Every dealer who bid is
// told the car is gone (with NO buyer identity, hard rule 1), so nobody
// keeps pricing a dead deal.

export const runtime = "nodejs";

type Mail = Parameters<typeof notify>[0];

interface Result {
  status: number;
  error?: string;
  mails?: Mail[];
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const j: unknown = await req.json();
    body = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return bad("invalid JSON body");
  }

  const token = str(body.token, 64);
  const reason = str(body.reason, 500);
  if (!token) return bad("token is required");

  const r = await withDb((db): Result => {
    const deal = db.deals.find((d) => d.buyerToken === token);
    if (!deal) return { status: 404, error: "not found" };

    try {
      moveDeal(deal, "withdrawn", reason ? `buyer withdrew: ${reason}` : "buyer withdrew");
    } catch (e) {
      return { status: 400, error: e instanceof Error ? e.message : "illegal transition" };
    }

    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg ||
      "trade-in";

    const mails: Mail[] = [
      {
        audience: "staff",
        to: null,
        dealId: deal.id,
        kind: "deal_withdrawn",
        subject: `Deal withdrawn by buyer: ${label}`,
        body: lines(
          `Deal ${deal.id} was withdrawn by the buyer.`,
          reason ? `Reason given: ${reason}` : `No reason given.`,
        ),
      },
    ];

    const bidderIds = Array.from(
      new Set(db.bids.filter((b) => b.dealId === deal.id).map((b) => b.dealerId)),
    );
    for (const dealerId of bidderIds) {
      const dealer = db.dealers.find((d) => d.id === dealerId);
      if (!dealer) continue;
      mails.push({
        audience: "dealer",
        to: dealer.email,
        dealerId: dealer.id,
        dealId: deal.id,
        kind: "deal_withdrawn",
        subject: `Deal withdrawn: ${label}`,
        body: lines(
          `The ${label} you bid on has been withdrawn by its owner.`,
          `Nothing is owed and no action is needed. New deals appear in your portal as they go live.`,
        ),
      });
    }
    return { status: 200, mails };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
