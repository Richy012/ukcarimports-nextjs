import { NextRequest, NextResponse } from "next/server";
import {
  withDb,
  moveDeal,
  nowIso,
  MISDESCRIPTION_CHECKLIST,
  type CancelCategory,
  type Cancellation,
} from "../../../../lib/dealstore";
import { notify, lines, eur } from "../../../../lib/dealnotify";

// Post-acceptance cancellation with a STRUCTURED reason (owner design,
// 19 Aug). Every cancellation records category + detail and attaches to the
// pack — future bidders on a relist see misdescription history. A dealer
// claiming misdescription must name checklist items and give an account; the
// buyer then has 48h to accept or contest before staff resolve it. The €500
// description guarantee and the dealer's refund/credit are STAFF decisions
// (admin console) — this endpoint never moves money.

export const runtime = "nodejs";

type Mail = Parameters<typeof notify>[0];

interface Result {
  status: number;
  error?: string;
  mails?: Mail[];
}

const CATEGORIES: CancelCategory[] = [
  "misdescription", "changed_mind", "car_unavailable", "logistics", "other",
];

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
  const dealId = str(body.dealId, 64);
  const category = str(body.category, 30) as CancelCategory;
  const detail = str(body.detail, 2000);
  const rawItems = Array.isArray(body.checklistItems) ? body.checklistItems : [];
  const checklistItems = rawItems
    .map((x) => str(x, 40))
    .filter((x): x is (typeof MISDESCRIPTION_CHECKLIST)[number] =>
      (MISDESCRIPTION_CHECKLIST as readonly string[]).includes(x));

  if (!token || !dealId) return bad("token and dealId are required");
  if (!CATEGORIES.includes(category)) return bad("a cancellation reason is required");
  if (detail.length < 20) return bad("give a proper account — it goes on the record");
  if (category === "misdescription" && checklistItems.length === 0) {
    return bad("name the undisclosed checklist item(s) — the guarantee only covers those");
  }

  const r = await withDb((db): Result => {
    // who is cancelling? dealer token or buyer token
    const dealer = db.dealers.find((d) => d.token === token && !d.banned);
    const deal = db.deals.find((d) =>
      dealer ? d.id === dealId : d.id === dealId && d.buyerToken === token,
    );
    if (!deal) return { status: 404, error: "not found" };
    const bid = db.bids.find((b) => b.id === deal.acceptedBidId);
    // winner check FIRST and generic — a non-winning dealer learns nothing
    // about this deal's stage from the error string
    if (dealer && (!bid || bid.dealerId !== dealer.id)) {
      return { status: 404, error: "not found" };
    }
    if (deal.status !== "accepted" && deal.status !== "matched") {
      return { status: 400, error: `deal is ${deal.status}; nothing to cancel here` };
    }
    // a description claim is made AT the inspection — which only exists after
    // matching. Pre-match there is nothing to have inspected.
    if (dealer && category === "misdescription" && deal.status !== "matched") {
      return { status: 400, error: "description claims are made at inspection, after matching" };
    }
    // misdescription is a dealer claim about the buyer's pack, never the reverse
    if (!dealer && category === "misdescription") {
      return { status: 400, error: "pick the reason that fits — misdescription is the dealer's claim" };
    }

    const by = dealer ? "dealer" : "buyer";
    const misdescription = category === "misdescription";
    const cancellation: Cancellation = {
      by,
      dealerId: bid?.dealerId ?? null,
      category,
      checklistItems,
      detail,
      at: nowIso(),
      buyerResponse: "",
      buyerRespondedAt: null,
      resolution: misdescription ? "" : "dismissed",
      resolvedAt: misdescription ? null : nowIso(),
      vrmWatchUntil: misdescription
        ? new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
        : null,
    };
    deal.cancellations = [...(deal.cancellations ?? []), cancellation];
    try {
      moveDeal(deal, by === "dealer" ? "collapsed_dealer" : "collapsed_buyer",
        `${by} cancelled: ${category} — ${detail.slice(0, 160)}`);
    } catch (e) {
      deal.cancellations.pop();
      return { status: 400, error: e instanceof Error ? e.message : "illegal transition" };
    }
    if (bid && bid.status === "accepted") {
      bid.status = "withdrawn";
      bid.updatedAt = nowIso();
    }
    deal.acceptedBidId = null;
    deal.buyerDepositPaid = false;
    deal.dealerDepositPaid = false;
    deal.renegotiation = null;

    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg || "trade-in";
    const items = checklistItems.map((x) => x.replace(/_/g, " ")).join(", ");

    const mails: Mail[] = [
      {
        audience: "staff",
        to: null,
        dealerId: dealer?.id ?? null,
        dealId: deal.id,
        kind: "deal_cancelled",
        subject: `Deal cancelled (${category}) on ${label}${misdescription ? " — GUARANTEE CLAIM" : ""}`,
        body: lines(
          `Deal ${deal.id} cancelled by the ${by}.`,
          `Reason: ${category}${items ? ` (${items})` : ""}`,
          `Account: ${detail}`,
          bid ? `Accepted figure was ${eur(bid.allowanceEur)}.` : false,
          misdescription
            ? `Buyer has 48h to accept or contest. Evidence standard: fault shown WITH the car identifiable, judged against the buyer's own pack. Uncontested + evidenced = refund the dealer next day (buyer's ${eur(db.config.buyerGuaranteeEur)} passes through + ${eur(db.config.dealerCreditEur)} credit). Contested or thin = slow path; reg watched on Carzone/DoneDeal until ${cancellation.vrmWatchUntil?.slice(0, 10)}.`
            : `No guarantee claim. Relist from the console when ready.`,
        ),
      },
    ];
    if (misdescription) {
      mails.push({
        audience: "buyer",
        to: deal.buyer.email,
        dealId: deal.id,
        kind: "misdescription_claimed",
        subject: `The dealer has cancelled — and says your ${label} wasn't as described`,
        body: lines(
          `The dealer cancelled the deal and reports: ${items}.`,
          `Their account: ${detail}`,
          ``,
          `You have 48 hours to respond on your status page — accept it, or contest it if it's wrong.`,
          `Honest mistakes about wear and condition never trigger the description guarantee; the listed checklist items are the only things that do.`,
          `Status page: /trade-ins/status/${deal.buyerToken}`,
        ),
      });
    } else if (by === "dealer") {
      mails.push({
        audience: "buyer",
        to: deal.buyer.email,
        dealId: deal.id,
        kind: "deal_cancelled",
        subject: `The dealer has pulled out of your ${label} deal`,
        body: lines(
          `The dealer cancelled (${category.replace(/_/g, " ")}). No fault is recorded against you.`,
          `We can put your car straight back in front of the other bidders — reply to this email or use your status page.`,
          `Status page: /trade-ins/status/${deal.buyerToken}`,
        ),
      });
    }
    return { status: 200, mails };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
