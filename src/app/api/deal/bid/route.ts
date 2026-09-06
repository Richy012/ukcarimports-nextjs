import { NextRequest, NextResponse } from "next/server";
import {
  withDb,
  newId,
  nowIso,
  dealerAlias,
  type Bid,
} from "../../../../lib/dealstore";
import { notify, lines, eur } from "../../../../lib/dealnotify";

// A dealer bids on a live deal. Approved, un-banned dealers only. A dealer's
// previous open bid is superseded — one open bid per dealer per deal. The
// buyer hears "Dealer <alias> offered <eur>" (aliases only, hard rule 1) and
// every bid carries subjectToInspection stamped on the record (hard rule 3).

export const runtime = "nodejs";

type Mail = Parameters<typeof notify>[0];

interface Result {
  status: number;
  error?: string;
  mails?: Mail[];
  bid?: Bid;
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
  const allowance = num(body.allowanceEur);
  const atUkciPrice = body.atUkciPrice === true;
  const adjusted = num(body.adjustedTotalEur);
  const conditions = str(body.conditions, 1000);

  if (!token || !dealId) return bad("token and dealId are required");
  if (allowance == null || allowance <= 0 || allowance > 500000) {
    return bad("a realistic trade-in allowance in euro is required");
  }
  if (!atUkciPrice && (adjusted == null || adjusted <= 0 || adjusted > 1000000)) {
    return bad("give the adjusted total, or bid at the shown price");
  }

  const r = await withDb((db): Result => {
    const dealer = db.dealers.find((d) => d.token === token);
    if (!dealer) return { status: 404, error: "not found" };
    if (dealer.banned) return { status: 403, error: "not available" };
    if (!dealer.approved) return { status: 403, error: "dealer not approved yet" };

    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) return { status: 404, error: "deal not found" };
    if (deal.status !== "live") {
      return { status: 400, error: `deal is ${deal.status}, not open for bids` };
    }

    const prev = db.bids.find(
      (b) => b.dealId === deal.id && b.dealerId === dealer.id && b.status === "open",
    );
    if (prev) {
      prev.status = "superseded";
      prev.updatedAt = nowIso();
    }

    const bid: Bid = {
      id: newId("bid"),
      dealId: deal.id,
      dealerId: dealer.id,
      allowanceEur: Math.round(allowance),
      atUkciPrice,
      adjustedTotalEur: atUkciPrice ? null : Math.round(adjusted as number),
      conditions,
      status: "open",
      placedAt: nowIso(),
      updatedAt: nowIso(),
      subjectToInspection: true,
    };
    db.bids.push(bid);

    const alias = dealerAlias(deal.id, dealer.id, db);
    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg ||
      "trade-in";

    const mails: Mail[] = [
      {
        audience: "staff",
        to: null,
        dealerId: dealer.id,
        dealId: deal.id,
        kind: "new_bid",
        subject: `New bid on ${label}: ${eur(bid.allowanceEur)} from ${dealer.name}`,
        body: lines(
          `Deal ${deal.id}: ${dealer.name} (${dealer.county}) bid ${eur(bid.allowanceEur)} allowance.`,
          bid.atUkciPrice
            ? `At the shown all-in price of ${eur(deal.wanted.landedEur)}.`
            : `Adjusted total: ${eur(bid.adjustedTotalEur)}.`,
          bid.conditions ? `Conditions: ${bid.conditions}` : `No conditions attached.`,
          prev ? `Supersedes their earlier bid of ${eur(prev.allowanceEur)}.` : false,
        ),
      },
      {
        audience: "buyer",
        to: deal.buyer.email,
        dealId: deal.id,
        kind: "new_bid",
        subject: `New offer on your ${label}`,
        body: lines(
          `Dealer ${alias} offered ${eur(bid.allowanceEur)} for your ${label}.`,
          bid.atUkciPrice
            ? `That is at the shown all-in price of ${eur(deal.wanted.landedEur)} for the ${deal.wanted.title}.`
            : `They propose an adjusted total of ${eur(bid.adjustedTotalEur)} for the ${deal.wanted.title}.`,
          bid.conditions ? `Conditions: ${bid.conditions}` : false,
          ``,
          `Every offer is indicative and subject to physical inspection of your car.`,
          `See all offers and accept one on your status page: /trade-ins/status/${deal.buyerToken}`,
        ),
      },
    ];

    return { status: 200, mails, bid };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true, bid: r.bid });
}
