import { NextRequest, NextResponse } from "next/server";
import { withDb, moveDeal, nowIso } from "../../../../../lib/dealstore";
import { notify, lines, eur } from "../../../../../lib/dealnotify";

// A dealer withdraws their own bid. An OPEN bid simply becomes "withdrawn".
// If the bid was the ACCEPTED bid on an "accepted" deal (pre-deposit), the
// dealer is walking: the deal goes back to "live" with acceptedBidId reset
// and the buyer + staff are told (kind=dealer_walked_pre_deposit). Once the
// deal is matched there is no API path out — that is a staff collapse.

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

function str(v: unknown, max = 300): string {
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
  const bidId = str(body.bidId, 64);
  if (!token || !bidId) return bad("token and bidId are required");

  const r = await withDb((db): Result => {
    const dealer = db.dealers.find((d) => d.token === token);
    if (!dealer) return { status: 404, error: "not found" };

    const bid = db.bids.find((b) => b.id === bidId && b.dealerId === dealer.id);
    if (!bid) return { status: 404, error: "bid not found" };

    const deal = db.deals.find((d) => d.id === bid.dealId);
    if (!deal) return { status: 404, error: "deal not found" };

    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg ||
      "trade-in";
    const mails: Mail[] = [];

    if (bid.status === "open") {
      bid.status = "withdrawn";
      bid.updatedAt = nowIso();
      mails.push({
        audience: "staff",
        to: null,
        dealerId: dealer.id,
        dealId: deal.id,
        kind: "bid_withdrawn",
        subject: `Bid withdrawn on ${label}`,
        body: lines(
          `${dealer.name} withdrew their open bid of ${eur(bid.allowanceEur)} on deal ${deal.id}.`,
        ),
      });
      return { status: 200, mails };
    }

    if (bid.status === "accepted" && deal.acceptedBidId === bid.id) {
      if (deal.status !== "accepted") {
        return {
          status: 400,
          error: `cannot withdraw an accepted bid while the deal is ${deal.status}`,
        };
      }
      try {
        moveDeal(deal, "live", `dealer withdrew accepted bid ${bid.id} before deposits`);
      } catch (e) {
        return { status: 400, error: e instanceof Error ? e.message : "illegal transition" };
      }
      bid.status = "withdrawn";
      bid.updatedAt = nowIso();
      deal.acceptedBidId = null;
      // A deposit marked against the walked pairing must NOT survive into the
      // next acceptance — otherwise the next deal reaches "matched" on a single
      // deposit and reveals buyer identity to a dealer who never paid.
      deal.buyerDepositPaid = false;
      deal.dealerDepositPaid = false;

      mails.push(
        {
          audience: "staff",
          to: null,
          dealerId: dealer.id,
          dealId: deal.id,
          kind: "dealer_walked_pre_deposit",
          subject: `Dealer walked pre-deposit: ${label}`,
          body: lines(
            `${dealer.name} withdrew the ACCEPTED bid of ${eur(bid.allowanceEur)} on deal ${deal.id} before deposits completed.`,
            `The deal is live again for the other bids. Consider whether this dealer keeps access.`,
          ),
        },
        {
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "dealer_walked_pre_deposit",
          subject: `The dealer behind your accepted offer has pulled out`,
          body: lines(
            `The dealer whose offer of ${eur(bid.allowanceEur)} you accepted for your ${label} has withdrawn before deposits were completed.`,
            `No deposit was lost. Your deal is live again — any other offers remain open and new ones can still arrive.`,
            `See where things stand: /trade-ins/status/${deal.buyerToken}`,
          ),
        },
      );
      return { status: 200, mails };
    }

    return { status: 400, error: `bid is ${bid.status}, not open` };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
