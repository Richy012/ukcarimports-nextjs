import { NextRequest, NextResponse } from "next/server";
import { withDb, nowIso } from "../../../../lib/dealstore";
import { notify, lines, eur } from "../../../../lib/dealnotify";

// Buyer answers a proposed price adjustment. Accept rewrites the accepted
// bid's allowance (the original is kept on the renegotiation record and in
// history); decline leaves the deal matched at the original figure — the
// dealer completes at that figure or cancels with a documented reason.

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
  const action = str(body.action, 10); // "accept" | "decline"
  if (!token || (action !== "accept" && action !== "decline")) {
    return bad("token and action (accept|decline) are required");
  }

  const r = await withDb((db): Result => {
    const deal = db.deals.find((d) => d.buyerToken === token);
    if (!deal) return { status: 404, error: "not found" };
    const rn = deal.renegotiation;
    if (!rn || rn.status !== "proposed") {
      return { status: 400, error: "no adjustment is waiting for an answer" };
    }
    if (deal.status !== "matched") {
      return { status: 400, error: `deal is ${deal.status}` };
    }
    const bid = db.bids.find((b) => b.id === deal.acceptedBidId);
    const dealer = bid ? db.dealers.find((d) => d.id === bid.dealerId) : undefined;

    rn.status = action === "accept" ? "accepted" : "declined";
    rn.respondedAt = nowIso();
    if (action === "accept" && bid) {
      bid.allowanceEur = rn.allowanceEur;
      bid.updatedAt = nowIso();
    }
    deal.history.push({
      at: nowIso(),
      event: `price_adjustment_${rn.status}`,
      detail:
        action === "accept"
          ? `buyer accepted ${eur(rn.allowanceEur)} (was ${eur(rn.originalAllowanceEur)})`
          : `buyer declined; deal stands at ${eur(rn.originalAllowanceEur)}`,
    });
    deal.updatedAt = nowIso();

    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg || "trade-in";

    const mails: Mail[] = [];
    if (dealer) {
      mails.push({
        audience: "dealer",
        to: dealer.email,
        dealerId: dealer.id,
        dealId: deal.id,
        kind: `price_adjustment_${rn.status}`,
        subject:
          action === "accept"
            ? `Buyer accepted your revised figure on the ${label}`
            : `Buyer declined your revised figure on the ${label}`,
        body: lines(
          action === "accept"
            ? `The deal now completes at ${eur(rn.allowanceEur)} for the ${label}.`
            : `The accepted figure of ${eur(rn.originalAllowanceEur)} stands.`,
          action === "decline"
            ? `You can complete at that figure, or cancel with a documented reason from your deal page.`
            : false,
        ),
      });
    }
    mails.push({
      audience: "staff",
      to: null,
      dealId: deal.id,
      kind: `price_adjustment_${rn.status}`,
      subject: `Chip ${rn.status} on ${label}`,
      body: lines(
        `Deal ${deal.id}: buyer ${rn.status} the adjustment ${eur(rn.originalAllowanceEur)} -> ${eur(rn.allowanceEur)}.`,
      ),
    });
    return { status: 200, mails };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
