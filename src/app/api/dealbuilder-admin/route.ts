import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import {
  withDb,
  readOnly,
  newToken,
  nowIso,
  moveDeal,
  dealForStaff,
  type Deal,
  type Dealer,
} from "../../../lib/dealstore";
import { notify, lines, eur, tradeInOfferEmail } from "../../../lib/dealnotify";

// Staff console API. Staff see everything (dealForStaff) — this surface is
// keyed, never linked publicly. Every state transition goes through moveDeal
// so an illegal one comes back as 400 {ok:false,error:"illegal transition..."}.
// Deposits are marked HERE by staff (no Stripe yet, hard rule 6): the moment
// both flags are true the deal moves to "matched" and the serializers start
// revealing identities on the next fetch — this route also sends the
// contact_revealed mails so neither side has to keep polling.

export const runtime = "nodejs";

const BASE = "https://staging.ukcarimports.ie";
const UPLOAD_ROOT = `${process.cwd()}/uploads/tradein`;
const SAFE_DRAFT = /^[A-Za-z0-9_-]{6,64}$/;

async function docOnFile(draftId: string, file: string): Promise<boolean> {
  if (!SAFE_DRAFT.test(draftId)) return false;
  try {
    await stat(`${UPLOAD_ROOT}/${draftId}/${file}`);
    return true;
  } catch {
    return false;
  }
}

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

function dealLabel(deal: Deal): string {
  return (
    [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
    deal.tradeIn.reg ||
    "trade-in"
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "illegal transition";
}

export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get("key") || "").trim();

  const out = await readOnly((db) => {
    if (!db.config.adminKey || key !== db.config.adminKey) return null;
    return {
      deals: [...db.deals]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((d) => dealForStaff(d, db)),
      dealers: db.dealers.map((d) => ({ ...d })),
      notifications: db.notifications.slice(0, 200),
      config: {
        mailMode: db.config.mailMode,
        bandTiers: db.config.bandTiers,
        bidWindowHours: db.config.bidWindowHours,
        dealerFeeEur: db.config.dealerFeeEur,
        buyerGuaranteeEur: db.config.buyerGuaranteeEur,
        dealerCreditEur: db.config.dealerCreditEur,
      },
    };
  });

  if (!out) return bad("bad admin key", 403);
  for (const d of out.deals) {
    const row = d as unknown as Record<string, unknown>;
    row.vrcOnFile = await docOnFile(d.draftId, "vlc_cert.jpg");
    row.idOnFile = await docOnFile(d.draftId, "owner_id.jpg");
  }
  return NextResponse.json({ ok: true, ...out });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const j: unknown = await req.json();
    body = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return bad("invalid JSON body");
  }

  const key = str(body.key, 200);
  const action = str(body.action, 60);
  const dealId = str(body.dealId, 64);
  const dealerId = str(body.dealerId, 64);

  // computed outside the store transaction (sync callback): does the deal's
  // draft hold a VRC photo? Only consulted by approve_deal.
  let vrcSeen = false;
  let idSeen = false;
  if (action === "approve_deal" && dealId) {
    const draftId = await readOnly((db) => db.deals.find((d) => d.id === dealId)?.draftId ?? "");
    vrcSeen = await docOnFile(draftId, "vlc_cert.jpg");
    idSeen = await docOnFile(draftId, "owner_id.jpg");
  }

  const r = await withDb((db): Result => {
    if (!db.config.adminKey || key !== db.config.adminKey) {
      return { status: 403, error: "bad admin key" };
    }

    const mails: Mail[] = [];
    const fail = (error: string, status = 400): Result => ({ status, error });
    const done = (): Result => ({ status: 200, mails });

    const deal = db.deals.find((d) => d.id === dealId);
    const dealer = db.dealers.find((d) => d.id === dealerId);
    const approvedDealers = (): Dealer[] => db.dealers.filter((d) => d.approved && !d.banned);
    const acceptedDealer = (d: Deal): Dealer | undefined => {
      const acc = d.acceptedBidId ? db.bids.find((b) => b.id === d.acceptedBidId) : undefined;
      return acc ? db.dealers.find((x) => x.id === acc.dealerId) : undefined;
    };
    const area = (d: Deal): string =>
      d.buyer.eircode ? d.buyer.eircode.trim().slice(0, 3).toUpperCase() : "";

    switch (action) {
      case "approve_deal": {
        if (!deal) return fail("deal not found", 404);
        if ((!vrcSeen || !idSeen) && body.allowMissingVrc !== true) {
          const missing = [
            !vrcSeen ? "no VRC on file" : "",
            !idSeen ? "no photo ID on file" : "",
          ].filter(Boolean).join(" and ");
          return fail(`${missing} — the ID-matches-VRC check is the point of approval; override only if identity was verified another way`);
        }
        try {
          moveDeal(deal, "live", "staff approved — visible to dealers");
        } catch (e) {
          return fail(errMsg(e));
        }
        const marginNote = str(body.marginNote, 500);
        if (marginNote) deal.marginNote = marginNote;

        const label = dealLabel(deal);
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "deal_live",
          subject: `Your ${label} is live with Irish dealers`,
          body: lines(
            `Your trade-in is now in front of approved Irish dealers, who have about ${db.config.bidWindowHours} hours to bid.`,
            `Offers land on your status page as they come in: ${BASE}/trade-ins/status/${deal.buyerToken}`,
            ``,
            `Every offer is indicative and subject to physical inspection of your car.`,
          ),
        });
        for (const d of approvedDealers()) {
          mails.push({
            audience: "dealer",
            to: d.email,
            dealerId: d.id,
            dealId: deal.id,
            kind: "deal_live",
            subject: `New deal: ${label} + ${deal.wanted.title}`,
            body: lines(
              `A new deal is open for bids.`,
              `Trade-in: ${label}${
                deal.tradeIn.mileage != null
                  ? `, ${deal.tradeIn.mileage.toLocaleString("en-IE")} ${deal.tradeIn.mileageUnit}`
                  : ""
              }${deal.tradeIn.nct ? `, NCT: ${deal.tradeIn.nct}` : ""}${
                area(deal) ? `, area ${area(deal)}` : ""
              }.`,
              deal.valuation.estimateEur != null
                ? `Irish retail median ${eur(deal.valuation.estimateEur)} from ${deal.valuation.comparables} similar cars; indicative trade band ${eur(deal.valuation.bandLowEur)}–${eur(deal.valuation.bandHighEur)}.`
                : `Valuation: ${deal.valuation.note}.`,
              `They are buying: ${deal.wanted.title} at ${eur(deal.wanted.landedEur)} all-in — the sale is already attached.`,
              deal.targetEur != null
                ? `The owner's target for the trade-in: ${eur(deal.targetEur)}.`
                : `No target given — bid what the car is worth to you.`,
              ``,
              `View and bid: ${BASE}/deal-builder/deal/${deal.id}?token=${d.token}`,
              `Every bid is indicative and subject to physical inspection.`,
            ),
          });
        }
        return done();
      }

      case "make_offer": {
        // THE PERSON'S OFFER on a trade-in (owner, 5 Sep). Only ever made here,
        // after the photos and answers have been looked at; the model's own
        // placing of the car is a staff-side suggestion and nothing more. Sends
        // the customer the offer template (lib/dealnotify.ts) and puts the
        // figure on their status page. Re-making it replaces the previous one.
        if (!deal) return fail("deal not found", 404);
        if (deal.tradeIn.route !== "tradein") return fail("offers are made on the trade-in route only");
        if (["declined", "withdrawn", "expired", "completed"].includes(deal.status)) {
          return fail(`deal is ${deal.status}`);
        }
        const amount = Math.round(Number(body.eur));
        if (!Number.isFinite(amount) || amount < 100 || amount > 250000) return fail("give the offer in euro");
        const note = str(body.note, 600);
        deal.offer = { eur: amount, note, madeAt: nowIso(), by: "staff" };
        deal.updatedAt = nowIso();
        deal.history.push({ at: nowIso(), event: "offer_made", detail: `${eur(amount)} offered by staff${note ? `: ${note}` : ""}` });
        const car = dealLabel(deal);
        const mail = tradeInOfferEmail({
          name: deal.buyer.name,
          car,
          reg: deal.tradeIn.reg,
          eur: amount,
          note,
          wantedTitle: deal.wanted.title,
          wantedLandedEur: deal.wanted.landedEur,
          statusUrl: `${BASE}/trade-ins/status/${deal.buyerToken}`,
        });
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "offer_made",
          subject: mail.subject,
          body: mail.body,
        });
        return done();
      }

      case "decline_deal": {
        if (!deal) return fail("deal not found", 404);
        const reason = str(body.reason, 500);
        try {
          moveDeal(deal, "declined", reason ? `staff declined: ${reason}` : "staff declined");
        } catch (e) {
          return fail(errMsg(e));
        }
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "deal_declined",
          subject: `We can't take this one forward`,
          body: lines(
            `We looked at your ${dealLabel(deal)} and we can't take this deal to dealers as it stands.`,
            reason ? `Why: ${reason}` : false,
            `Nothing was charged and nothing is owed. You're welcome to try again with different figures or a different car.`,
          ),
        });
        return done();
      }

      case "pause_car": {
        if (!deal) return fail("deal not found", 404);
        try {
          moveDeal(deal, "paused_car", "the UKCI car became unavailable");
        } catch (e) {
          return fail(errMsg(e));
        }
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "deal_paused_car",
          subject: `The car you picked is no longer available`,
          body: lines(
            `The ${deal.wanted.title} has gone. It happens — good cars sell fast on both sides of the water.`,
            `Your trade-in, photos and offers are all saved. Pick another car on the site and we carry everything over.`,
            `Your status page: ${BASE}/trade-ins/status/${deal.buyerToken}`,
          ),
        });
        return done();
      }

      case "resume": {
        if (!deal) return fail("deal not found", 404);
        try {
          moveDeal(deal, "live", "staff resumed — replacement car selected");
        } catch (e) {
          return fail(errMsg(e));
        }
        return done();
      }

      case "expire": {
        if (!deal) return fail("deal not found", 404);
        try {
          moveDeal(deal, "expired", "bid window closed without acceptance");
        } catch (e) {
          return fail(errMsg(e));
        }
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "deal_expired",
          subject: `Your trade-in listing has closed`,
          body: lines(
            `The bidding window for your ${dealLabel(deal)} has closed.`,
            `Nothing is owed. If you'd like us to relist it — same photos, same details — just reply to this email.`,
          ),
        });
        return done();
      }

      case "relist": {
        if (!deal) return fail("deal not found", 404);
        const from = deal.status;
        try {
          moveDeal(deal, "live", `staff relisted from ${from}`);
        } catch (e) {
          return fail(errMsg(e));
        }
        if (from === "collapsed_dealer" || from === "collapsed_buyer") {
          const acc = deal.acceptedBidId
            ? db.bids.find((b) => b.id === deal.acceptedBidId)
            : undefined;
          if (acc) {
            acc.status = "lost";
            acc.updatedAt = nowIso();
          }
          deal.acceptedBidId = null;
          deal.buyerDepositPaid = false;
          deal.dealerDepositPaid = false;
          deal.renegotiation = null;
        }
        const label = dealLabel(deal);
        for (const d of approvedDealers()) {
          mails.push({
            audience: "dealer",
            to: d.email,
            dealerId: d.id,
            dealId: deal.id,
            kind: "deal_relisted",
            subject: `Relisted: ${label} + ${deal.wanted.title}`,
            body: lines(
              `This deal is open for bids again.`,
              `Trade-in: ${label}${area(deal) ? `, area ${area(deal)}` : ""}. They are buying the ${deal.wanted.title} at ${eur(deal.wanted.landedEur)} all-in.`,
              `View and bid: ${BASE}/deal-builder/deal/${deal.id}?token=${d.token}`,
              `Every bid is indicative and subject to physical inspection.`,
            ),
          });
        }
        return done();
      }

      case "approve_dealer": {
        if (!dealer) return fail("dealer not found", 404);
        if (dealer.banned) return fail("dealer is banned");
        dealer.approved = true;
        dealer.approvedAt = nowIso();
        mails.push({
          audience: "dealer",
          to: dealer.email,
          dealerId: dealer.id,
          kind: "dealer_approved",
          subject: `You're approved on the UK Car Imports Deal Builder`,
          body: lines(
            `${dealer.name}, your access is live.`,
            `Your portal — keep this link private, it is your login:`,
            `${BASE}/deal-builder?token=${dealer.token}`,
            ``,
            `Every live deal comes with the retail sale already attached: a trade-in you can retail, and a buyer already committed to their next car. You bid on the proposition.`,
            `Every bid is indicative and subject to physical inspection of the car.`,
          ),
        });
        return done();
      }

      case "ban_dealer": {
        if (!dealer) return fail("dealer not found", 404);
        dealer.banned = true;
        for (const b of db.bids) {
          if (b.dealerId !== dealer.id) continue;
          // Open bids simply die. An ACCEPTED bid held by the banned dealer must
          // also die AND unwind the deal back to live — otherwise the deal is
          // still marchable to "matched" and would hand the buyer's full contact
          // to a banned dealer. Reset the acceptance and both deposit flags, the
          // same unwind as a dealer walk.
          if (b.status === "accepted" && b.dealId) {
            const deal = db.deals.find((d) => d.id === b.dealId);
            if (deal && deal.acceptedBidId === b.id && (deal.status === "accepted" || deal.status === "matched")) {
              try {
                // pre-match: unwind to live. Post-match (identities already
                // out): collapse the dealer side — matched -> live is not a
                // legal move and must never be attempted silently.
                moveDeal(deal, deal.status === "matched" ? "collapsed_dealer" : "live",
                  `winning dealer ${dealer.id} banned — acceptance unwound`);
                deal.acceptedBidId = null;
                deal.buyerDepositPaid = false;
                deal.dealerDepositPaid = false;
                deal.renegotiation = null;
                mails.push({
                  audience: "buyer",
                  to: deal.buyer.email,
                  dealId: deal.id,
                  kind: "dealer_walked_pre_deposit",
                  subject: `The dealer behind your accepted offer is no longer available`,
                  body: lines(
                    `The dealer whose offer you accepted for your ${dealLabel(deal)} can no longer proceed.`,
                    `No deposit was lost. Your deal is live again and other offers remain open.`,
                    `See where things stand: /trade-ins/status/${deal.buyerToken}`,
                  ),
                });
              } catch {
                /* deal already terminal — leave it */
              }
            }
          }
          if (b.status === "open" || b.status === "accepted") {
            b.status = "withdrawn";
            b.updatedAt = nowIso();
          }
        }
        return done();
      }

      case "mark_deposit": {
        if (!deal) return fail("deal not found", 404);
        const side = str(body.side, 10);
        if (side !== "buyer" && side !== "dealer") {
          return fail('side must be "buyer" or "dealer"');
        }
        if (deal.status !== "accepted") {
          return fail(`deal is ${deal.status}; deposits are marked while it is accepted`);
        }
        // Never march a deal to matched — which reveals the buyer's contact — if
        // the winning dealer has since been banned. Belt to the ban_dealer unwind.
        const winnerNow = acceptedDealer(deal);
        if (winnerNow?.banned) {
          return fail("the winning dealer is banned; relist or collapse this deal instead");
        }
        if (side === "buyer") deal.buyerDepositPaid = true;
        else deal.dealerDepositPaid = true;
        deal.updatedAt = nowIso();
        deal.history.push({
          at: nowIso(),
          event: "deposit_marked",
          detail: `${side} deposit marked by staff`,
        });

        if (!(deal.buyerDepositPaid && deal.dealerDepositPaid)) return done();

        // both deposits in — match, reveal, and close out the losing bids
        try {
          moveDeal(deal, "matched", "both deposits in — identities revealed");
        } catch (e) {
          return fail(errMsg(e));
        }
        const winDealer = acceptedDealer(deal);
        const accBid = deal.acceptedBidId
          ? db.bids.find((b) => b.id === deal.acceptedBidId)
          : undefined;
        const label = dealLabel(deal);

        const losers = db.bids.filter((b) => b.dealId === deal.id && b.status === "open");
        for (const b of losers) {
          b.status = "lost";
          b.updatedAt = nowIso();
        }

        if (winDealer) {
          mails.push(
            {
              audience: "buyer",
              to: deal.buyer.email,
              dealId: deal.id,
              kind: "contact_revealed",
              subject: `You're matched — here is your dealer`,
              body: lines(
                `Both deposits are in. Your dealer for the ${label} deal:`,
                `${winDealer.name}, Co. ${winDealer.county}`,
                `Email: ${winDealer.email}`,
                ``,
                `You keep driving your car until the ${deal.wanted.title} lands — the swap happens at the dealer on the day.`,
                `The agreed allowance${accBid ? ` of ${eur(accBid.allowanceEur)}` : ""} remains subject to the physical inspection.`,
              ),
            },
            {
              audience: "dealer",
              to: winDealer.email,
              dealerId: winDealer.id,
              dealId: deal.id,
              kind: "contact_revealed",
              subject: `You're matched — here is your customer`,
              body: lines(
                `Both deposits are in. The customer behind the ${label}:`,
                `${deal.buyer.name}`,
                `Email: ${deal.buyer.email}`,
                deal.buyer.phone ? `Phone: ${deal.buyer.phone}` : false,
                deal.buyer.eircode ? `Eircode: ${deal.buyer.eircode}` : false,
                ``,
                `Arrange the inspection directly. The agreed allowance${accBid ? ` of ${eur(accBid.allowanceEur)}` : ""} is subject to that inspection.`,
              ),
            },
          );
        }
        const loserDealerIds = Array.from(new Set(losers.map((b) => b.dealerId)));
        for (const id of loserDealerIds) {
          const d = db.dealers.find((x) => x.id === id);
          if (!d) continue;
          mails.push({
            audience: "dealer",
            to: d.email,
            dealerId: d.id,
            dealId: deal.id,
            kind: "bid_lost",
            subject: `Another offer won: ${label}`,
            body: lines(
              `The ${label} deal has been matched with another dealer.`,
              `Nothing is owed. New deals appear in your portal as they go live.`,
            ),
          });
        }
        mails.push({
          audience: "staff",
          to: null,
          dealId: deal.id,
          kind: "deal_matched",
          subject: `Matched: ${label} — identities revealed`,
          body: lines(
            `Deal ${deal.id} is matched. Both deposits are marked and both sides now have each other's contact details.`,
            `Next: the inspection and the import. Mark the deal complete at handover.`,
          ),
        });
        return done();
      }

      case "complete": {
        if (!deal) return fail("deal not found", 404);
        if (deal.renegotiation && deal.renegotiation.status === "proposed") {
          return fail("an open price adjustment is waiting for the buyer — settle it before completing");
        }
        try {
          moveDeal(deal, "completed", "handover confirmed by staff");
        } catch (e) {
          return fail(errMsg(e));
        }
        const label = dealLabel(deal);
        const winDealer = acceptedDealer(deal);
        mails.push({
          audience: "staff",
          to: null,
          dealId: deal.id,
          kind: "invoice_due",
          subject: `Invoice due: deal ${deal.id} (${label})`,
          body: lines(
            `Handover confirmed on deal ${deal.id}.`,
            `The €900 introduction fee was taken at acceptance; raise the UK VAT reclaim engagement with the dealer if wanted.`,
          ),
        });
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "deal_completed",
          subject: `Handover confirmed — enjoy the ${deal.wanted.title}`,
          body: lines(
            `That's the deal done: your ${label} handed over, your ${deal.wanted.title} home.`,
            `Thanks for doing it through UK Car Imports.`,
          ),
        });
        if (winDealer) {
          mails.push({
            audience: "dealer",
            to: winDealer.email,
            dealerId: winDealer.id,
            dealId: deal.id,
            kind: "deal_completed",
            subject: `Handover confirmed: ${label}`,
            body: lines(
              `The handover on deal ${deal.id} is confirmed.`,
              `Our €900 introduction fee was taken at acceptance; the UK VAT reclaim engagement follows separately if you want it.`,
            ),
          });
        }
        return done();
      }

      case "collapse": {
        if (!deal) return fail("deal not found", 404);
        const side = str(body.side, 10);
        if (side !== "buyer" && side !== "dealer") {
          return fail('side must be "buyer" or "dealer"');
        }
        const note = str(body.note, 500);
        const to = side === "dealer" ? "collapsed_dealer" : "collapsed_buyer";
        try {
          moveDeal(deal, to, note || `${side} walked after acceptance`);
        } catch (e) {
          return fail(errMsg(e));
        }
        const accBid = deal.acceptedBidId ? db.bids.find((b) => b.id === deal.acceptedBidId) : undefined;
        if (accBid && accBid.status === "accepted") {
          accBid.status = "withdrawn";
          accBid.updatedAt = nowIso();
        }
        deal.acceptedBidId = null;
        deal.buyerDepositPaid = false;
        deal.dealerDepositPaid = false;
        deal.renegotiation = null;
        if (note) deal.staffNote = deal.staffNote ? deal.staffNote + "\n" + note : note;

        const label = dealLabel(deal);
        const winDealer = acceptedDealer(deal);
        const forfeit =
          side === "dealer"
            ? `As agreed at acceptance, a dealer who walks after acceptance forfeits the dealer deposit.`
            : false;

        mails.push({
          audience: "staff",
          to: null,
          dealId: deal.id,
          kind: "deal_collapsed",
          subject: `Deal collapsed (${side} side): ${label}`,
          body: lines(
            `Deal ${deal.id} collapsed on the ${side} side.`,
            note ? `Note: ${note}` : false,
            forfeit,
            side === "dealer" ? `Relist from the console to put it back in front of dealers.` : false,
          ),
        });
        mails.push({
          audience: "buyer",
          to: deal.buyer.email,
          dealId: deal.id,
          kind: "deal_collapsed",
          subject:
            side === "dealer"
              ? `Your deal has fallen through — we're on it`
              : `Your deal has been cancelled`,
          body: lines(
            side === "dealer"
              ? `The dealer side of your ${label} deal has fallen through.`
              : `Your ${label} deal has been cancelled at your end.`,
            side === "dealer"
              ? `We can relist your car to the other dealers straight away — your photos and details are all saved. We'll be in touch.`
              : false,
            note ? `Note from us: ${note}` : false,
          ),
        });
        if (winDealer) {
          mails.push({
            audience: "dealer",
            to: winDealer.email,
            dealerId: winDealer.id,
            dealId: deal.id,
            kind: "deal_collapsed",
            subject: `Deal collapsed: ${label}`,
            body: lines(
              `Deal ${deal.id} (${label}) has collapsed on the ${side} side.`,
              forfeit,
              note ? `Note: ${note}` : false,
            ),
          });
        }
        return done();
      }

      case "resolve_cancellation": {
        // Staff verdict on a misdescription claim (owner design, 19 Aug):
        //  guarantee_applied — evidenced + uncontested (or upheld): dealer is
        //    refunded next day; the buyer's €500 guarantee passes through as
        //    cash and the €400 gap lands as next-deal credit — the platform
        //    banks nothing on a failed deal.
        //  no_fault — evidence thin / both honest: no penalty, no credit,
        //    relist the corrected pack.
        //  dismissed — claim rejected outright.
        // Money itself moves by hand (no Stripe here, hard rule 6); this
        // records the verdict and the credit ledger.
        if (!deal) return fail("deal not found", 404);
        const resolution = str(body.resolution, 24);
        if (!["guarantee_applied", "no_fault", "dismissed"].includes(resolution)) {
          return fail('resolution must be "guarantee_applied", "no_fault" or "dismissed"');
        }
        const claim = [...(deal.cancellations ?? [])]
          .reverse()
          .find((c) => c.category === "misdescription" && c.resolution === "");
        if (!claim) return fail("no unresolved misdescription claim on this deal");
        claim.resolution = resolution as typeof claim.resolution;
        claim.resolvedAt = nowIso();
        deal.history.push({
          at: nowIso(),
          event: "claim_resolved",
          detail: resolution === "guarantee_applied"
            ? `guarantee_applied: €${db.config.buyerGuaranteeEur} buyer fee passes to the dealer + €${db.config.dealerCreditEur} next-deal credit`
            : resolution,
        });
        deal.updatedAt = nowIso();

        // the credit follows the dealer WHO MADE THE CLAIM — after a relist
        // the acceptance may belong to someone else entirely (review HIGH)
        const winDealer = (claim.dealerId
          ? db.dealers.find((x) => x.id === claim.dealerId)
          : undefined) ?? acceptedDealer(deal);
        const label = dealLabel(deal);
        if (resolution === "guarantee_applied" && winDealer) {
          winDealer.creditEur = (winDealer.creditEur ?? 0) + db.config.dealerCreditEur;
          mails.push({
            audience: "dealer",
            to: winDealer.email,
            dealerId: winDealer.id,
            dealId: deal.id,
            kind: "claim_upheld",
            subject: `Description claim upheld — your fee comes back`,
            body: lines(
              `Your claim on the ${label} was upheld.`,
              `${eur(db.config.buyerGuaranteeEur)} is refunded to you next working day, and ${eur(db.config.dealerCreditEur)} lands as credit against your next introduction fee (credit balance: ${eur(winDealer.creditEur)}) — your €900 made whole.`,
              `Thanks for documenting it properly — that is what makes the fast path possible.`,
            ),
          });
          mails.push({
            audience: "buyer",
            to: deal.buyer.email,
            dealId: deal.id,
            kind: "claim_upheld",
            subject: `The description guarantee has been applied`,
            body: lines(
              `The dealer's report on the ${label} was upheld against your submission, so the €${db.config.buyerGuaranteeEur} description guarantee applies, as agreed when you listed the car.`,
              `It compensates the dealer for the introduction fee and the wasted collection — we keep none of it.`,
              `Your import deal is unaffected. If you fix or disclose the issue we can relist the car to the other bidders.`,
            ),
          });
        }
        if (resolution !== "guarantee_applied") {
          mails.push({
            audience: "staff",
            to: null,
            dealId: deal.id,
            kind: "claim_closed",
            subject: `Claim on ${label} closed: ${resolution}`,
            body: lines(
              `No penalty, no credit. Refund the dealer per launch policy and relist the corrected pack when the seller is ready.`,
              claim.vrmWatchUntil ? `The reg stays on the Carzone/DoneDeal watch until ${claim.vrmWatchUntil.slice(0, 10)}.` : false,
            ),
          });
        }
        return done();
      }

      case "set_mail_mode": {
        const mode = str(body.mode, 20);
        if (mode === "log" || mode === "staff-only" || mode === "live") {
          db.config.mailMode = mode;
          return done();
        }
        return fail('mode must be "log", "staff-only" or "live"');
      }

      case "rotate_dealer_token": {
        if (!dealer) return fail("dealer not found", 404);
        dealer.token = newToken();
        return done();
      }

      default:
        return fail(action ? `unknown action "${action}"` : "action is required");
    }
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
