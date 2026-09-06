"use client";

import DraftBanner from "@/app/components/DraftBanner";

/**
 * Buyer status page — /trade-ins/status/<buyerToken>. STAGING.
 *
 * Everything shown here comes through dealForBuyer on the server, so dealer
 * identities are structurally absent until the deal is matched — this page
 * never has them to leak. Aliases and counties only, until both deposits are
 * in. The page polls itself every minute so an accepted bid or a revealed
 * contact appears without the buyer refreshing.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Cancellation, DealStatus, StaffOffer, RangesShown, Renegotiation, TradeInDetails, WantedCar, Valuation } from "../../../../lib/dealstore";

const money = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");

interface BuyerBid {
  id: string;
  alias: string;
  county: string;
  allowanceEur: number;
  atUkciPrice: boolean;
  adjustedTotalEur: number | null;
  conditions: string;
  status: string;
  accepted: boolean;
  subjectToInspection: boolean;
  dealer: { name: string; email: string; county: string } | null;
}

interface BuyerDeal {
  id: string;
  status: DealStatus;
  tradeIn: TradeInDetails;
  wanted: WantedCar;
  valuation: Valuation;
  offer?: StaffOffer | null;
  ranges?: RangesShown | null;
  targetEur: number | null;
  buyerDepositPaid: boolean;
  dealerDepositPaid: boolean;
  renegotiation: Renegotiation | null;
  cancellation: Cancellation | null;
  guaranteeEur: number;
  bids: BuyerBid[];
  history: { at: string; event: string; detail: string }[];
}

const STAGES: { key: DealStatus; name: string; blurb: string }[] = [
  { key: "submitted", name: "Submitted", blurb: "We're checking the details before dealers see it. You'll get an email the moment it goes live." },
  { key: "live", name: "With dealers", blurb: "Approved Irish dealers can see your car and are bidding. Offers appear below as they come in." },
  { key: "accepted", name: "Offer accepted", blurb: "You accepted an offer. Both sides now place a deposit — once both are in, you're put in contact with each other." },
  { key: "matched", name: "Matched", blurb: "Both deposits are in. You and the dealer have each other's details to arrange the inspection and the handover." },
  { key: "completed", name: "Done", blurb: "Handover confirmed. Enjoy the new car." },
];

const SIDE_STATES: Partial<Record<DealStatus, string>> = {
  paused_car: "The car you wanted has become unavailable. Pick another car on the site and we'll put your trade-in straight back in front of dealers.",
  declined: "We couldn't take this one forward — check your email for the reason.",
  withdrawn: "You withdrew this trade-in. Nothing more will happen with it.",
  expired: "The bidding window closed without a deal. We can relist it — just reply to our email.",
  collapsed_dealer: "The dealer pulled out after acceptance. We can put your car straight back to the other bidders — check your email.",
  collapsed_buyer: "This deal was cancelled after acceptance.",
};

export default function DealStatusPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [deal, setDeal] = useState<BuyerDeal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/deal?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (r.status === 404) {
        setNotFound(true);
        setDeal(null);
        setLoading(false);
        return;
      }
      const j = await r.json();
      if (j && j.ok && j.deal) {
        setDeal(j.deal as BuyerDeal);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch {
      /* transient network problem — keep whatever we were showing */
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load();
    }, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function accept(bid: BuyerBid) {
    const ok = window.confirm(
      `Accept ${bid.alias}'s offer of ${money(bid.allowanceEur)} for your car? ` +
      "Every bid is indicative and subject to a physical inspection of the car.",
    );
    if (!ok) return;
    setBusy(true);
    setActionErr("");
    try {
      const r = await fetch("/api/deal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, bidId: bid.id }),
      });
      const j = await r.json();
      if (!j || !j.ok) {
        setActionErr((j && j.error) || "Could not accept that offer — it may have changed. The page will refresh.");
      }
    } catch {
      setActionErr("Could not reach the server. Try again in a moment.");
    }
    setBusy(false);
    void load();
  }

  async function withdraw() {
    const reason = window.prompt(
      "Withdraw your car from dealers? Tell us why (optional), or press Cancel to keep it going.",
      "",
    );
    if (reason === null) return;
    setBusy(true);
    setActionErr("");
    try {
      const r = await fetch("/api/deal/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason }),
      });
      const j = await r.json();
      if (!j || !j.ok) {
        setActionErr((j && j.error) || "Could not withdraw. Refresh and try again.");
      }
    } catch {
      setActionErr("Could not reach the server. Try again in a moment.");
    }
    setBusy(false);
    void load();
  }

  async function respondAdjustment(action: "accept" | "decline") {
    if (!deal || !deal.renegotiation) return;
    const rn = deal.renegotiation;
    const msg =
      action === "accept"
        ? `Accept the revised figure of ${money(rn.allowanceEur)} (was ${money(rn.originalAllowanceEur)})?`
        : `Decline the revised figure? The deal can still complete at the original ${money(rn.originalAllowanceEur)}.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setActionErr("");
    try {
      const r = await fetch("/api/deal/renegotiate-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const j = await r.json();
      if (!j || !j.ok) setActionErr((j && j.error) || "That didn't go through — the page will refresh.");
    } catch {
      setActionErr("Could not reach the server. Try again in a moment.");
    }
    setBusy(false);
    void load();
  }

  async function respondClaim(action: "accept" | "contest") {
    let note = "";
    if (action === "contest") {
      const n = window.prompt("Tell us briefly what is wrong with the dealer's report:", "");
      if (n === null) return;
      note = n;
    } else if (!window.confirm("Accept the dealer's report? The description guarantee then applies, as agreed when you listed the car.")) {
      return;
    }
    setBusy(true);
    setActionErr("");
    try {
      const r = await fetch("/api/deal/cancel-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, note }),
      });
      const j = await r.json();
      if (!j || !j.ok) setActionErr((j && j.error) || "That didn't go through — the page will refresh.");
    } catch {
      setActionErr("Could not reach the server. Try again in a moment.");
    }
    setBusy(false);
    void load();
  }

  if (loading && !deal) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Every figure is indicative until the car is inspected.</DraftBanner>
        <p style={S.sm}>Loading your deal…</p>
      </main>
    );
  }

  if (notFound || !deal) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Every figure is indicative until the car is inspected.</DraftBanner>
        <h1 style={S.h1}>We can&rsquo;t find that deal</h1>
        <p style={S.sm}>
          Check the link in your email — it&rsquo;s unique to you and has to be
          used exactly as sent. If it still doesn&rsquo;t work, reply to the
          email and we&rsquo;ll sort it.
        </p>
      </main>
    );
  }

  const t = deal.tradeIn;
  const carName = [t.year ?? "", t.make, t.model].filter(Boolean).join(" ");
  const stageIdx = STAGES.findIndex((s) => s.key === deal.status);
  const sideNote = SIDE_STATES[deal.status];
  const settle = t.financeOutstanding === "yes" ? t.settlementEur : 0;
  const revealedBid = deal.bids.find((b) => b.accepted && b.dealer !== null);
  const acceptedBid = deal.bids.find((b) => b.accepted);
  const canWithdraw = deal.status === "submitted" || deal.status === "live" || deal.status === "paused_car";

  /*
   * The dealer-bidding stage tracker below describes ONE pathway. A seller who
   * chose Above Board Cars, or who is waiting on a hand-priced trade-in allowance,
   * is not in a bidding process at all and must not be shown "With dealers" or
   * "Offers appear below". Those two routes get their own page (owner's spec,
   * 31 Aug) and the bidding flow is left exactly as it was underneath.
   */
  if (t.route === "privateproof") {
    return <PrivateProofNext deal={deal} carName={carName} />;
  }
  if (t.route === "tradein") {
    return <TradeInNext deal={deal} carName={carName} />;
  }

  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Every figure is indicative until the car is inspected.</DraftBanner>

      <h1 style={S.h1}>Your trade-in</h1>
      <p style={S.lede}>
        {carName || "Your car"}{t.reg ? ` · ${t.reg}` : ""}
        {t.mileage ? ` · ${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit}` : ""}
      </p>

      {/* the journey, with where we are highlighted */}
      <div style={S.stages}>
        {STAGES.map((s, i) => (
          <div
            key={s.key}
            style={{
              ...S.stagePill,
              ...(i === stageIdx ? S.stageOn : {}),
              ...(stageIdx >= 0 && i < stageIdx ? S.stageDone : {}),
            }}
          >
            {stageIdx >= 0 && i < stageIdx ? "✓ " : ""}{s.name}
          </div>
        ))}
      </div>
      {stageIdx >= 0 && <p style={S.blurb}>{STAGES[stageIdx].blurb}</p>}
      {sideNote && <div style={S.notice}>{sideNote}</div>}

      {/* the deal itself */}
      <div style={S.card}>
        <div style={S.cardPad}>
          <div style={S.lab}>The car you want</div>
          <div style={S.mid}>{deal.wanted.title}</div>
          <div style={S.sm}>{deal.wanted.detail} · landed, all in, Irish plates</div>
          <div style={S.rowLine}>
            <span>All-in price</span>
            <b>{money(deal.wanted.landedEur)}</b>
          </div>
          <div style={S.rowLine}>
            <span>Your asking price for the {t.model || "car"}</span>
            <span>{deal.targetEur ? money(deal.targetEur) : "left to the dealers"}</span>
          </div>
          {settle > 0 && (
            <div style={S.rowLine}>
              <span>Finance to settle</span>
              <span>{money(settle)}</span>
            </div>
          )}
        </div>
      </div>

      {/* offers */}
      <h2 style={S.h2}>Offers from dealers</h2>
      {deal.bids.length === 0 ? (
        <p style={S.sm}>
          {deal.status === "submitted"
            ? "Dealers can't see your car yet — offers will appear here once it goes live."
            : "No offers yet. Dealers usually bid within the 48-hour window — this page updates itself."}
        </p>
      ) : (
        deal.bids.map((bid) => {
          const price = bid.atUkciPrice ? deal.wanted.landedEur : (bid.adjustedTotalEur ?? deal.wanted.landedEur);
          const pay = price - bid.allowanceEur + settle;
          return (
            <div key={bid.id} style={{ ...S.bidCard, ...(bid.accepted ? S.bidAccepted : {}) }}>
              <div style={S.bidHead}>
                <span>
                  <b>{bid.alias}</b>
                  <span style={S.muted}> · {bid.county || "Ireland"}</span>
                </span>
                {bid.accepted && <span style={S.pillGreen}>Accepted</span>}
              </div>
              <div style={S.bidBig}>
                {money(bid.allowanceEur)} <span style={S.bidFor}>for your car</span>
              </div>
              <div style={S.sm}>
                {bid.atUkciPrice
                  ? `At the shown all-in price of ${money(price)} — you'd pay ${money(pay)}`
                  : `At an adjusted total of ${money(price)} — you'd pay ${money(pay)}`}
                {settle > 0 ? " after your finance is settled." : "."}
              </div>
              {bid.conditions && <div style={S.conds}>Dealer&rsquo;s conditions: {bid.conditions}</div>}
              <div style={S.inspect}>Indicative offer — subject to a physical inspection of your car.</div>
              {deal.status === "live" && bid.status === "open" && (
                <button style={S.acceptBtn} disabled={busy} onClick={() => accept(bid)}>
                  Accept this offer
                </button>
              )}
            </div>
          );
        })
      )}

      {/* deposit gate, once an offer is accepted */}
      {deal.status === "accepted" && (
        <div style={S.panel}>
          <b style={S.panelT}>What happens now</b>
          <div style={S.depRow}>
            <span>Your deposit</span>
            <span style={deal.buyerDepositPaid ? S.okText : S.waitText}>
              {deal.buyerDepositPaid ? "received" : "we'll email you how to place it"}
            </span>
          </div>
          <div style={S.depRow}>
            <span>Dealer&rsquo;s deposit</span>
            <span style={deal.dealerDepositPaid ? S.okText : S.waitText}>
              {deal.dealerDepositPaid ? "received" : "being placed"}
            </span>
          </div>
          <p style={S.sm}>
            Once both deposits are in, you and the dealer get each other&rsquo;s
            contact details to arrange the inspection and the handover.
            {acceptedBid
              ? ` The accepted figure of ${money(acceptedBid.allowanceEur)} stays indicative until the dealer has physically inspected the car.`
              : " The accepted figure stays indicative until the dealer has physically inspected the car."}
          </p>
        </div>
      )}

      {/* the dealer, revealed only once matched */}
      {(deal.status === "matched" || deal.status === "completed") && revealedBid && revealedBid.dealer && (
        <div style={S.contact}>
          <b style={S.panelT}>Your dealer</b>
          <div style={S.mid}>{revealedBid.dealer.name}</div>
          <div style={S.sm}>{revealedBid.dealer.county}</div>
          <div style={S.sm}>{revealedBid.dealer.email}</div>
          <p style={S.sm}>
            The dealer collects and inspects the car at your address — payment
            before the car moves, and the ownership transfer is theirs to
            file. If everything matches your submission, the figure of{" "}
            {money(revealedBid.allowanceEur)} can&rsquo;t change at the door.
          </p>
        </div>
      )}

      {/* revised figure proposed at inspection — renegotiation-first */}
      {deal.status === "matched" && deal.renegotiation && deal.renegotiation.status === "proposed" && (
        <div style={S.panel}>
          <b style={S.panelT}>The dealer proposes a revised figure</b>
          <p style={S.sm}>
            After inspecting the car, the dealer proposes{" "}
            <b>{money(deal.renegotiation.allowanceEur)}</b> instead of the accepted{" "}
            {money(deal.renegotiation.originalAllowanceEur)}.
          </p>
          <p style={S.sm}>What they found: &ldquo;{deal.renegotiation.note}&rdquo;</p>
          <p style={S.sm}>
            The decision is entirely yours. If you decline, the deal can still
            complete at the original figure.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <button style={S.acceptBtn} disabled={busy} onClick={() => void respondAdjustment("accept")}>
              Accept {money(deal.renegotiation.allowanceEur)}
            </button>
            <button style={{ ...S.acceptBtn, background: "#555" }} disabled={busy} onClick={() => void respondAdjustment("decline")}>
              Decline — keep {money(deal.renegotiation.originalAllowanceEur)}
            </button>
          </div>
        </div>
      )}

      {/* misdescription claim — 48h to answer */}
      {deal.cancellation && deal.cancellation.category === "misdescription" && deal.cancellation.buyerResponse === "" && !deal.cancellation.resolution && (
        <div style={S.notice}>
          <b>The dealer cancelled — and reports the car wasn&rsquo;t as described</b>
          <p style={S.sm}>
            Reported: {deal.cancellation.checklistItems.map((x) => x.replace(/_/g, " ")).join(", ")}.
            Their account: &ldquo;{deal.cancellation.detail}&rdquo;
          </p>
          <p style={S.sm}>
            You have 48 hours to respond. If the report is right, the{" "}
            {money(deal.guaranteeEur || 500)} description guarantee you agreed at
            submission applies — it compensates the dealer, and we keep none of
            it. If it&rsquo;s wrong, contest it and we judge both accounts side
            by side. Honest mistakes about wear never trigger the guarantee.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <button style={S.acceptBtn} disabled={busy} onClick={() => void respondClaim("accept")}>
              The report is right — accept it
            </button>
            <button style={{ ...S.acceptBtn, background: "#555" }} disabled={busy} onClick={() => void respondClaim("contest")}>
              It&rsquo;s wrong — contest it
            </button>
          </div>
        </div>
      )}
      {deal.cancellation && deal.cancellation.category === "misdescription" && deal.cancellation.buyerResponse !== "" && !deal.cancellation.resolution && (
        <div style={S.notice}>
          You {deal.cancellation.buyerResponse} the dealer&rsquo;s report —
          we&rsquo;re reviewing both accounts side by side and will email the
          outcome.
        </div>
      )}

      {actionErr && <div style={S.err}>{actionErr}</div>}

      {canWithdraw && (
        <button style={S.withdrawLink} disabled={busy} onClick={withdraw}>
          Withdraw my car from dealers
        </button>
      )}

      <p style={S.foot}>
        This page updates itself every minute. Keep the link — it&rsquo;s unique to you.
      </p>
    </main>
  );
}

/**
 * The line the owner wants sellers to paste into their own DoneDeal / Carzone
 * advert, 31 Aug, close to verbatim. It is what makes a private ad read as safe
 * to a stranger, so it is handed over ready to copy rather than described.
 * Keep this identical to AD_LINE in trade-ins/page.tsx.
 */
// The advert line lives in src/lib/aboveBoard.ts, shared with /trade-ins and the customer page.
import { AD_LINE } from "@/lib/aboveBoard";

/** Copy-to-clipboard with a visible confirmation. Falls back to selecting the
 *  text if the clipboard API is unavailable (older browsers, non-secure host),
 *  because a button that silently does nothing is worse than no button. */
function Copyable({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div style={S.copyWrap}>
      <div style={S.copyText}>{text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={S.copyBtn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setFailed(false);
              window.setTimeout(() => setCopied(false), 2500);
            } catch {
              setFailed(true);
            }
          }}
        >
          {copied ? "✓ Copied" : label}
        </button>
        {failed && (
          <span style={{ fontSize: 12.5, color: "#9a6a00" }}>
            Your browser wouldn&rsquo;t let us copy it — select the text above and copy it yourself.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * THE OFFER — made by a person, from the staff console, after the photos and
 * answers have been looked at (owner, 5 Sep). Until then the trade-in page
 * says so and shows nothing else. The model's own figure never reaches here:
 * dealForBuyer does not emit it.
 */
function OfferBlock({ offer, range }: { offer: StaffOffer | null | undefined; range: { lowEur: number; highEur: number } | null | undefined }) {
  if (!offer) {
    return (
      <div style={S.notice}>
        We are going through your photographs and your answers now and will come back with our
        offer{range ? ` — the range for a car like yours was ${money(range.lowEur)} – ${money(range.highEur)}` : ""}.
        Usually the same working day.
      </div>
    );
  }
  return (
    <div style={S.contact}>
      <div style={S.lab}>Our offer</div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.6px", margin: "2px 0 4px" }}>{money(offer.eur)}</div>
      {offer.note && <p style={S.sm}>{offer.note}</p>}
      <p style={S.sm}>
        Credited off your import on delivery day. It holds at handover as long as the car matches
        what you declared. Reply to our email to accept, or ring us &mdash; nothing is committed until
        you say yes.
      </p>
    </div>
  );
}

/** The private route gets its RANGE back, and only the range: what they list
 *  at is their call (owner, 5 Sep). */
function RangeBlock({ range }: { range: { lowEur: number; highEur: number } | null | undefined }) {
  if (!range) return null;
  return (
    <div style={S.contact}>
      <div style={S.lab}>Your range</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.6px", margin: "2px 0 4px" }}>{money(range.lowEur)} &ndash; {money(range.highEur)}</div>
      <p style={S.sm}>
        Where comparable private ads that actually sold were priced &mdash; the bottom went quickly,
        the top waited for the right buyer. What you list it at within that is your call; private
        buyers settle a little under the asking price.
      </p>
    </div>
  );
}

/** Above Board Cars — what the seller does next, in the owner's order (31 Aug). */
function PrivateProofNext({ deal, carName }: { deal: BuyerDeal; carName: string }) {
  const t = deal.tradeIn;
  // Absolute, because the whole point is that it gets pasted somewhere else.
  const [shareLink, setShareLink] = useState("/above-board-cars");
  useEffect(() => {
    setShareLink(window.location.origin + "/above-board-cars");
  }, []);

  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
      <h1 style={S.h1}>Your car is in</h1>
      <p style={S.lede}>
        {carName || "Your car"}{t.reg ? ` · ${t.reg}` : ""}
        {t.mileage ? ` · ${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit}` : ""}
      </p>

      <RangeBlock range={deal.ranges?.private} />

      <div style={S.notice}>
        We&rsquo;re building your advert from your photographs and your condition record, and
        listing it on this site. We&rsquo;ll email you the moment it&rsquo;s live — usually the
        same day.
      </div>

      <h2 style={S.h2}>Three things to do while we build it</h2>

      <div style={S.card}>
        <div style={S.cardPad}>
          <div style={S.lab}>1 — List it on DoneDeal or Carzone</div>
          <div style={S.mid}>
            {deal.ranges?.private
              ? `List it anywhere between ${money(deal.ranges.private.lowEur)} and ${money(deal.ranges.private.highEur)} — your call`
              : "Put the car on DoneDeal or Carzone"}
          </div>
          <p style={S.sm}>
            That is where Irish private buyers look, and you reach far more of them than any one
            site can. Use the same photographs — they are on your advert here already.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <a href="https://www.donedeal.ie/" target="_blank" rel="noopener noreferrer" style={S.copyBtn}>Open DoneDeal ↗</a>
            <a href="https://www.carzone.ie/" target="_blank" rel="noopener noreferrer" style={S.copyBtn}>Open Carzone ↗</a>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardPad}>
          <div style={S.lab}>2 — Put this line in that advert</div>
          <div style={S.mid}>It is what makes a private sale look safe to a stranger</div>
          <p style={S.sm}>
            A private buyer&rsquo;s worry is handing money to someone they have never met. This
            line answers it before they ask.
          </p>
          <Copyable text={AD_LINE} label="Copy the line" />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardPad}>
          <div style={S.lab}>3 — Send this link to anyone who contacts you</div>
          <div style={S.mid}>It explains how Above Board Cars works</div>
          <p style={S.sm}>
            You don&rsquo;t have to explain the escrow, the inspection or the warranty yourself —
            send the link and let the page do it.
          </p>
          <Copyable text={shareLink} label="Copy the link" />
          <p style={S.sm}>
            <a href="/above-board-cars" style={{ color: "#1a5fb4" }}>
              See what your buyer sees →
            </a>
          </p>
        </div>
      </div>

      <div style={S.panel}>
        <b style={S.panelT}>What we do</b>
        <ol style={S.ol}>
          <li>Hold the buyer&rsquo;s money until the car has changed hands properly.</li>
          <li>Organise the mechanical inspection, so nobody is taking anybody&rsquo;s word for it.</li>
          <li>Put an industry-standard warranty behind the car.</li>
        </ol>
        <p style={S.sm}>
          <b>You stay the seller throughout</b> and you keep driving the car until it sells. We
          never take title to it.
        </p>
      </div>

      {t.thirdPartyOptOut && (
        <p style={S.foot}>
          You asked us not to offer your car on to third-party garages. We won&rsquo;t.
        </p>
      )}
      <p style={S.foot}>
        Keep this link — it&rsquo;s unique to you, and everything about your sale lives here.
      </p>
    </main>
  );
}

/** Straight trade-in — assessed and priced by hand for now (owner, 31 Aug:
 *  "the car comes to me for the first while ... I'll get back to them with a
 *  plan"). No figure is shown, because no figure exists yet. */
function TradeInNext({ deal, carName }: { deal: BuyerDeal; carName: string }) {
  const t = deal.tradeIn;
  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
      <h1 style={S.h1}>Your car is in</h1>
      <p style={S.lede}>
        {carName || "Your car"}{t.reg ? ` · ${t.reg}` : ""}
        {t.mileage ? ` · ${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit}` : ""}
      </p>

      <OfferBlock offer={deal.offer} range={deal.ranges?.trade} />

      {!deal.offer && (
        <div style={S.notice}>
          We have your photographs, your condition record and your details. Nothing else is needed
          from you right now.
        </div>
      )}

      <div style={S.panel}>
        <b style={S.panelT}>What happens next</b>
        <ol style={S.ol}>
          <li>We go through your photographs and your answers.</li>
          <li>
            <b>We come back to you with our offer</b> by email, and it appears on this page.
          </li>
          <li>
            The allowance comes off the price of the car we import, and you hand over the keys on
            delivery day. You keep driving it until then.
          </li>
        </ol>
        <p style={S.sm}>
          Nothing is committed and there is nothing to pay. If the figure doesn&rsquo;t suit, you
          can take the Above Board Cars route instead — just reply to our email and say so.
        </p>
      </div>

      {t.thirdPartyOptOut && (
        <p style={S.foot}>
          You asked us not to offer your trade-in or your import purchase on to third-party
          garages. We won&rsquo;t.
        </p>
      )}
      <p style={S.foot}>
        Keep this link — it&rsquo;s unique to you, and everything about your car lives here.
      </p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  // listStyle explicit — the site's global reset strips markers otherwise.
  ol: { margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, color: "#555", lineHeight: 1.75, listStyle: "decimal" },
  copyWrap: { border: "1px solid #e2e2e2", background: "#fbfbf9", borderRadius: 8, padding: "12px 14px", marginTop: 12 },
  copyText: { fontSize: 13, lineHeight: 1.6, color: "#1a1a1a" },
  copyBtn: { fontSize: 13, padding: "9px 14px", borderRadius: 6, border: "1px solid #1a1a1a", background: "#1a1a1a", color: "#fff", cursor: "pointer", fontFamily: "inherit" },
  page: { maxWidth: 760, margin: "0 auto", padding: "22px 16px 60px", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#1a1a1a" },
  banner: { background: "#fff8e6", border: "1px solid #f0dfae", color: "#9a6a00", fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 6, marginBottom: 18 },
  h1: { fontSize: 28, margin: "0 0 6px", letterSpacing: "-.6px" },
  h2: { fontSize: 19, margin: "24px 0 10px", letterSpacing: "-.3px" },
  lede: { fontSize: 14.5, color: "#555", margin: "0 0 18px", lineHeight: 1.55 },
  stages: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  stagePill: { fontSize: 11.5, padding: "5px 11px", borderRadius: 999, background: "#f0f0ee", color: "#888" },
  stageOn: { background: "#1a1a1a", color: "#fff", fontWeight: 700 },
  stageDone: { background: "#eef4ee", color: "#0a7d33", fontWeight: 600 },
  blurb: { fontSize: 13.5, color: "#555", lineHeight: 1.55, margin: "0 0 14px" },
  notice: { border: "1px solid #f0dfae", background: "#fffdf4", color: "#7a5a00", borderRadius: 8, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.55, marginBottom: 14 },
  card: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fff", marginBottom: 4 },
  cardPad: { padding: "16px 18px 18px" },
  lab: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 6 },
  mid: { fontSize: 16, fontWeight: 600 },
  sm: { fontSize: 12.5, color: "#5c5c5c", lineHeight: 1.55, marginTop: 4 },
  muted: { fontSize: 12.5, color: "#777", fontWeight: 400 },
  rowLine: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderTop: "1px solid #f2f2f2", marginTop: 8, paddingTop: 8 },
  bidCard: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fff", padding: "14px 16px", marginBottom: 10 },
  bidAccepted: { borderColor: "#0a7d33", background: "#f8fcf9" },
  bidHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 14 },
  bidBig: { fontSize: 24, fontWeight: 700, letterSpacing: "-.5px", margin: "4px 0 2px" },
  bidFor: { fontSize: 13, fontWeight: 500, color: "#8a8a8a", letterSpacing: 0 },
  conds: { fontSize: 12.5, color: "#5c5c5c", lineHeight: 1.55, marginTop: 8, borderLeft: "3px solid #e6e6e6", paddingLeft: 10 },
  inspect: { fontSize: 11.5, color: "#9a6a00", marginTop: 8 },
  acceptBtn: { background: "#b60b0c", color: "#fff", border: "none", borderRadius: 6, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 10 },
  pillGreen: { fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: "#eef4ee", color: "#0a7d33", fontWeight: 700 },
  panel: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fafaf8", padding: "14px 16px", marginTop: 16 },
  panelT: { fontSize: 13.5, display: "block", marginBottom: 8 },
  depRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" },
  okText: { color: "#0a7d33", fontWeight: 600 },
  waitText: { color: "#9a6a00" },
  contact: { border: "1px solid #bfe0c6", borderRadius: 10, background: "#f4faf5", padding: "14px 16px", marginTop: 16 },
  err: { border: "1px solid #e8b4b4", background: "#fdf3f3", color: "#b60b0c", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, marginTop: 14 },
  withdrawLink: { background: "none", border: "none", color: "#1a5fb4", textDecoration: "underline", fontSize: 13, marginTop: 22, cursor: "pointer", padding: 0, display: "block" },
  foot: { fontSize: 11.5, color: "#999", marginTop: 16 },
};
