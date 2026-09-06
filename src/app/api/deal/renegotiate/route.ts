import { NextRequest, NextResponse } from "next/server";
import { withDb, nowIso } from "../../../../lib/dealstore";
import { notify, lines, eur } from "../../../../lib/dealnotify";

// Renegotiation-first (owner + prior art, 19 Aug): most "not as described"
// cars complete at an agreed chip, not a collapse. The WINNING dealer, after
// inspection (deal matched), proposes a revised allowance with what he found.
// The buyer is always free to decline. If the description was accurate the
// price does not change at the door — that promise lives in the buyer copy;
// this endpoint just records what is proposed, judged against the buyer's
// own pack by staff if it ever escalates.

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

function num(v: unknown): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
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
  const dealId = str(body.dealId, 64);
  const revised = num(body.allowanceEur);
  const note = str(body.note, 1000);

  if (!token || !dealId) return bad("token and dealId are required");
  if (revised == null || revised <= 0 || revised > 500000) {
    return bad("a realistic revised allowance in euro is required");
  }
  if (note.length < 20) {
    return bad("say what you found — the buyer sees this word for word");
  }

  const r = await withDb((db): Result => {
    const dealer = db.dealers.find((d) => d.token === token);
    if (!dealer || dealer.banned) return { status: 404, error: "not found" };

    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) return { status: 404, error: "deal not found" };
    if (deal.status !== "matched") {
      return { status: 400, error: "price adjustments happen after matching, at inspection" };
    }
    const bid = db.bids.find((b) => b.id === deal.acceptedBidId);
    if (!bid || bid.dealerId !== dealer.id) {
      return { status: 403, error: "only the winning dealer can propose an adjustment" };
    }
    if (deal.renegotiation && deal.renegotiation.status === "proposed") {
      return { status: 400, error: "an adjustment is already waiting for the buyer" };
    }
    // one agreed chip per match — no salami-slicing an already-chipped figure
    if (deal.renegotiation && deal.renegotiation.status === "accepted") {
      return { status: 400, error: "a revised figure was already agreed — complete at it, or cancel with a documented reason" };
    }
    if (revised >= bid.allowanceEur) {
      return { status: 400, error: "the revised figure must be below the accepted allowance" };
    }

    deal.renegotiation = {
      originalAllowanceEur: bid.allowanceEur,
      allowanceEur: Math.round(revised),
      note,
      proposedAt: nowIso(),
      status: "proposed",
      respondedAt: null,
    };
    deal.history.push({
      at: nowIso(),
      event: "price_adjustment_proposed",
      detail: `${eur(bid.allowanceEur)} -> ${eur(revised)}: ${note.slice(0, 160)}`,
    });
    deal.updatedAt = nowIso();

    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg || "trade-in";

    const mails: Mail[] = [
      {
        audience: "buyer",
        to: deal.buyer.email,
        dealId: deal.id,
        kind: "price_adjustment_proposed",
        subject: `The dealer proposes a revised figure for your ${label}`,
        body: lines(
          `After inspecting your ${label}, the dealer proposes ${eur(revised)} instead of the accepted ${eur(bid.allowanceEur)}.`,
          ``,
          `What they found: ${note}`,
          ``,
          `The decision is entirely yours — accept the revised figure or decline it on your status page.`,
          `If you decline, the deal can still complete at the original figure, or either side can cancel with a documented reason.`,
          `Status page: /trade-ins/status/${deal.buyerToken}`,
        ),
      },
      {
        audience: "staff",
        to: null,
        dealerId: dealer.id,
        dealId: deal.id,
        kind: "price_adjustment_proposed",
        subject: `Chip proposed on ${label}: ${eur(bid.allowanceEur)} -> ${eur(revised)}`,
        body: lines(
          `${dealer.name} proposes ${eur(revised)} (was ${eur(bid.allowanceEur)}).`,
          `Reason given: ${note}`,
          `No action needed unless it escalates — the buyer accepts or declines on their page.`,
        ),
      },
    ];
    return { status: 200, mails };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
