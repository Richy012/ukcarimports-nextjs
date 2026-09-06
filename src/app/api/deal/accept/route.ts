import { NextRequest, NextResponse } from "next/server";
import { withDb, moveDeal, nowIso } from "../../../../lib/dealstore";
import { notify, lines, eur } from "../../../../lib/dealnotify";

// Buyer accepts a bid. Deal live -> accepted, the bid becomes "accepted",
// every other open bid STAYS open — losers only lose when the deal matches.
// The winning dealer is told to place a deposit but gets NO buyer identity
// yet (hard rule 1: identities are released by the serializers at "matched",
// never here).

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
    const deal = db.deals.find((d) => d.buyerToken === token);
    if (!deal) return { status: 404, error: "not found" };
    if (deal.status !== "live") {
      return { status: 400, error: `deal is ${deal.status}, not live` };
    }
    const bid = db.bids.find((b) => b.id === bidId && b.dealId === deal.id);
    if (!bid) return { status: 404, error: "bid not found" };
    if (bid.status !== "open") {
      return { status: 400, error: `bid is ${bid.status}, not open` };
    }

    try {
      moveDeal(deal, "accepted", `buyer accepted bid ${bid.id}`);
    } catch (e) {
      return { status: 400, error: e instanceof Error ? e.message : "illegal transition" };
    }
    bid.status = "accepted";
    bid.updatedAt = nowIso();
    deal.acceptedBidId = bid.id;

    const dealer = db.dealers.find((d) => d.id === bid.dealerId);
    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg ||
      "trade-in";
    const area = deal.buyer.eircode ? deal.buyer.eircode.trim().slice(0, 3).toUpperCase() : "";

    const mails: Mail[] = [];
    if (dealer) {
      mails.push({
        audience: "dealer",
        to: dealer.email,
        dealerId: dealer.id,
        dealId: deal.id,
        kind: "bid_accepted",
        subject: `Your bid was accepted — next step is your deposit`,
        body: lines(
          `The buyer has accepted your offer of ${eur(bid.allowanceEur)} for the ${label}${area ? ` (area ${area})` : ""}.`,
          bid.atUkciPrice
            ? `You bid at the shown all-in price of ${eur(deal.wanted.landedEur)} for the ${deal.wanted.title}.`
            : `Your adjusted total for the ${deal.wanted.title} was ${eur(bid.adjustedTotalEur)}.`,
          ``,
          `Next step: the €900 introduction fee locks the deal (instructions follow from us). The buyer places a deposit too.`,
          `The seller's contact details are released to you the moment both are in — not before.`,
          ``,
          `You collect and inspect the car at the seller's address; payment before the car moves; the ownership transfer is yours to file.`,
          `If something on the checklist wasn't disclosed, propose a revised figure through your deal page — most description issues end in an agreed price, not a cancellation. If the description was accurate, the figure doesn't change at the door.`,
          ``,
          `Every trade-in's reg is tracked on Carzone weekly, so we see where cars end up.`,
          `Every bid is indicative and subject to physical inspection of the car.`,
        ),
      });
    }
    mails.push({
      audience: "staff",
      to: null,
      dealId: deal.id,
      kind: "bid_accepted",
      subject: `Bid accepted on ${label} — collect both deposits`,
      body: lines(
        `Deal ${deal.id}: buyer accepted ${dealer ? dealer.name : "unknown dealer"}'s bid of ${eur(bid.allowanceEur)}.`,
        `Mark the buyer and dealer deposits in the staff console once each arrives; matching is automatic when both are in.`,
      ),
    });
    return { status: 200, mails };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
