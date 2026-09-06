"use client";

import DraftBanner from "@/app/components/DraftBanner";

/**
 * Deal Builder — dealer deal detail, staging.
 *
 * The full file on one trade-in proposition: photos, condition answers,
 * finance position, Irish market evidence, the import car at its all-in
 * price, and the bid form.
 *
 * There is no per-deal dealer endpoint by design — the deal comes out of
 * GET /api/dealer and is picked by id, so the ONLY serializer that ever
 * shapes what a dealer sees is dealForDealer in lib/dealstore. Buyer name,
 * email, phone and full eircode appear here exactly when the API starts
 * returning deal.buyer !== null (deal matched), and never before. Do not
 * add fields the serializer does not emit.
 *
 * The only price of the import car is wanted.landedEur, all-in. Every bid
 * figure and the submit button carry "indicative, subject to physical
 * inspection" (owner rule).
 */

import { Suspense, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

// ---------- shapes of what /api/dealer returns (mirrors dealForDealer) ----------

interface DealerBid {
  id: string;
  dealId: string;
  dealerId: string;
  allowanceEur: number;
  atUkciPrice: boolean;
  adjustedTotalEur: number | null;
  conditions: string;
  status: "open" | "superseded" | "withdrawn" | "accepted" | "lost";
  placedAt: string;
  updatedAt: string;
  subjectToInspection: true;
}

interface DealerDeal {
  id: string;
  status: string;
  createdAt: string;
  tradeIn: {
    reg: string;
    mileage: number | null;
    mileageUnit: "km" | "miles";
    make: string;
    model: string;
    year: number | null;
    lookupSource: string;
    financeOutstanding: "yes" | "no" | "";
    settlementEur: number;
    nct: string;
    serviceHistory: string;
    damage: string;
    damageNote: string;
    adLink: string;
  };
  wanted: { carId: string | null; title: string; detail: string; landedEur: number };
  valuation: {
    estimateEur: number | null;
    comparables: number;
    segment: string;
    bandLowEur: number | null;
    bandHighEur: number | null;
    note: string;
  };
  targetEur: number | null;
  wantFinanceQuotes: boolean;
  eircodeArea: string;
  photos: string; // draftId for /api/tradein-photo
  myBids: DealerBid[];
  bidCount: number;
  won: boolean;
  buyer: { name: string; email: string; phone: string; eircode: string } | null;
  depositGate: { yours: boolean; buyers: boolean } | null;
  renegotiation: {
    originalAllowanceEur: number;
    allowanceEur: number;
    note: string;
    proposedAt: string;
    status: "proposed" | "accepted" | "declined";
    respondedAt: string | null;
  } | null;
  priorIssues: { at: string; checklistItems: string[]; detail: string }[];
  introFeeEur: number;
}

interface PortalDealer {
  name: string;
  county: string;
  approved: boolean;
}

interface PhotoSlot {
  slot: string;
  bytes: number;
  takenAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  live: "Open for bids",
  accepted: "Bid accepted — deposit stage",
  matched: "Matched — contact revealed",
  completed: "Completed",
};

const STATUS_STYLE: Record<string, CSSProperties> = {
  live: { background: "#eef4ee", color: "#0a7d33" },
  accepted: { background: "#fff8e6", color: "#9a6a00" },
  matched: { background: "#e8f0fb", color: "#1a5fb4" },
  completed: { background: "#f0f0ee", color: "#555" },
};

// ---------- page ----------

export default function DealDetailPage() {
  return (
    <Suspense
      fallback={
        <main style={S.page}>
          <div style={S.sm}>Loading&hellip;</div>
        </main>
      }
    >
      <DealDetailInner />
    </Suspense>
  );
}

function DealDetailInner() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const token = useSearchParams().get("token") ?? "";

  const [dealer, setDealer] = useState<PortalDealer | null>(null);
  const [deals, setDeals] = useState<DealerDeal[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setError("This page needs your dealer access link — use the link from your approval email.");
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/dealer?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await r.json()) as {
        ok: boolean;
        error?: string;
        dealer?: PortalDealer;
        deals?: DealerDeal[];
      };
      if (!r.ok || !j.ok || !j.dealer) {
        setError("That access link isn't recognised. Use the link from your approval email.");
      } else {
        setDealer(j.dealer);
        setDeals(j.deals ?? []);
        setError("");
      }
    } catch {
      setError("Couldn't load the deal — try again in a moment.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const backHref = token ? `/deal-builder?token=${encodeURIComponent(token)}` : "/deal-builder";
  const deal = deals.find((d) => d.id === id) ?? null;

  if (loading) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <div style={S.sm}>Loading the deal&hellip;</div>
      </main>
    );
  }

  if (error || !dealer) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <h1 style={S.h1}>Deal Builder</h1>
        <div style={S.err}>{error || "Something went wrong."}</div>
        <Link href="/deal-builder" style={S.link}>Go to the dealer portal &rarr;</Link>
      </main>
    );
  }

  if (!dealer.approved) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <h1 style={S.h1}>Verification in progress</h1>
        <p style={S.body}>
          Your registration is still being verified. Once it&rsquo;s approved,
          this link shows the deal.
        </p>
        <Link href={backHref} style={S.link}>&larr; Back</Link>
      </main>
    );
  }

  if (!deal) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <h1 style={S.h1}>Deal not available</h1>
        <p style={S.body}>
          This deal isn&rsquo;t on your board — it may have closed, been
          withdrawn, or gone to another dealer.
        </p>
        <Link href={backHref} style={S.link}>&larr; All deals</Link>
      </main>
    );
  }

  const t = deal.tradeIn;
  const v = deal.valuation;
  const title = [t.year ?? "", t.make, t.model].filter(Boolean).join(" ") || "Trade-in";
  const myOpen = deal.myBids.find((b) => b.status === "open");
  const myAccepted = deal.myBids.find((b) => b.status === "accepted");
  const currentBid = myAccepted ?? myOpen;
  const canWithdraw =
    (myOpen && deal.status === "live") ||
    (myAccepted && deal.status === "accepted");

  async function withdrawBid(bid: DealerBid) {
    const warning =
      bid.status === "accepted"
        ? "This bid has been ACCEPTED by the buyer. Withdrawing now walks away from the deal and the buyer will be told. Withdraw?"
        : "Withdraw your bid on this deal?";
    if (!window.confirm(warning)) return;
    setActionError("");
    try {
      const r = await fetch("/api/deal/bid/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, bidId: bid.id }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) setActionError(j.error || "Couldn't withdraw the bid — try again.");
      await load();
    } catch {
      setActionError("Couldn't withdraw the bid — check your connection and try again.");
    }
  }

  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>

      <Link href={backHref} style={S.link}>&larr; All deals</Link>

      <div style={S.headRow}>
        <h1 style={{ ...S.h1, margin: 0 }}>{title}</h1>
        <span style={{ ...S.statusPill, ...(STATUS_STYLE[deal.status] ?? {}) }}>
          {STATUS_LABEL[deal.status] ?? deal.status}
        </span>
      </div>
      <p style={S.lede}>
        {t.reg ? `${t.reg.toUpperCase()} · ` : ""}
        {t.mileage != null
          ? `${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit === "miles" ? "miles" : "km"} · `
          : ""}
        area {deal.eircodeArea || "—"} · listed{" "}
        {new Date(deal.createdAt).toLocaleDateString("en-IE")} ·{" "}
        {deal.bidCount === 1 ? "1 open bid" : `${deal.bidCount} open bids`}
      </p>

      {deal.depositGate && (
        <div style={{ ...S.card, ...S.wonCard }}>
          <div style={S.pad}>
            <h2 style={S.h2}>You won this deal</h2>
            <p style={S.body}>
              The {money(deal.introFeeEur || 900)} introduction fee locks the
              deal — taken and confirmed by UK Car Imports staff (instructions
              are in your email) while the buyer places their deposit. The
              moment both are marked, contact details are released
              automatically. You collect and inspect at the seller&rsquo;s
              address; payment before the car moves; the ownership transfer is
              yours to file.
            </p>
            <div style={S.gateRow}>
              <span style={{ ...S.gatePill, ...(deal.depositGate.yours ? S.gateDone : {}) }}>
                Your introduction fee: {deal.depositGate.yours ? "received" : "awaited"}
              </span>
              <span style={{ ...S.gatePill, ...(deal.depositGate.buyers ? S.gateDone : {}) }}>
                Buyer&rsquo;s deposit: {deal.depositGate.buyers ? "received" : "awaited"}
              </span>
            </div>
            {deal.buyer ? (
              <div style={S.contact}>
                <div style={S.lab}>The buyer</div>
                <Fact l="Name">{deal.buyer.name}</Fact>
                <Fact l="Phone">{deal.buyer.phone}</Fact>
                <Fact l="Email">{deal.buyer.email}</Fact>
                <Fact l="Eircode">{deal.buyer.eircode}</Fact>
                <p style={S.sm}>
                  The trade-in sale is between you and the buyer; we introduced
                  it and manage the import side.
                </p>
              </div>
            ) : (
              <p style={S.sm}>
                The buyer&rsquo;s contact details appear here the moment both
                deposits are in.
              </p>
            )}
          </div>
        </div>
      )}

      {deal.status === "matched" && (
        <InspectionPanel token={token} deal={deal} onDone={() => void load()} />
      )}

      {deal.priorIssues && deal.priorIssues.length > 0 && (
        <div style={{ ...S.card, borderColor: "#f0dfae", background: "#fffdf4", marginBottom: 14 }}>
          <div style={S.pad}>
            <h2 style={S.h2}>History on this car</h2>
            {deal.priorIssues.map((p, i) => (
              <p key={i} style={S.sm}>
                A previous deal was cancelled over undisclosed:{" "}
                {p.checklistItems.map((x) => x.replace(/_/g, " ")).join(", ")}{" "}
                ({new Date(p.at).toLocaleDateString("en-IE")}). &ldquo;{p.detail}&rdquo;
              </p>
            ))}
          </div>
        </div>
      )}

      <PhotoGrid draftId={deal.photos} />

      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.pad}>
          <h2 style={S.h2}>Condition and history</h2>
          <p style={S.sub}>
            The seller answered these before dealers saw the car — a surprise on
            the day is a haggle, so it&rsquo;s all here up front.
          </p>
          <Fact l="NCT">{t.nct || "Not answered"}</Fact>
          <Fact l="Service history">{t.serviceHistory || "Not answered"}</Fact>
          <Fact l="Damage or warning lights">
            {t.damage || "Not answered"}
            {t.damageNote ? ` — “${t.damageNote}”` : ""}
          </Fact>
          <Fact l="Finance outstanding">
            {t.financeOutstanding === "yes"
              ? `Yes — ${money(t.settlementEur)} to settle (comes off the deal, doesn't stop it)`
              : t.financeOutstanding === "no"
                ? "No"
                : "Not answered"}
          </Fact>
          <Fact l="Mileage">
            {t.mileage != null
              ? `${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit === "miles" ? "miles" : "km"}`
              : "Not given"}
          </Fact>
          {t.adLink && (
            <Fact l="Owner's own ad">
              <a href={t.adLink} target="_blank" rel="noopener noreferrer" style={S.link}>
                See the ad &rarr;
              </a>
            </Fact>
          )}
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.pad}>
          <h2 style={S.h2}>Irish market evidence</h2>
          {v.bandLowEur != null && v.bandHighEur != null ? (
            <>
              <div style={S.lab}>Indicative trade-in band</div>
              <div style={S.big}>
                {money(v.bandLowEur)}&ndash;{money(v.bandHighEur)}
              </div>
              <p style={S.sm}>
                From {v.comparables} similar Irish cars ({v.segment}). Evidence,
                not an offer — every figure is indicative until the car is
                inspected. Bid what the car is worth to you.
              </p>
            </>
          ) : (
            <p style={S.body}>
              {v.note || "Not enough Irish evidence"} — there aren&rsquo;t
              enough comparable Irish cars to publish a band for this one. Bid
              on the file above.
            </p>
          )}
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.pad}>
          <h2 style={S.h2}>The deal on the table</h2>
          <div style={S.carRow}>
            <div>
              <b>{deal.wanted.title}</b>
              <div style={S.sm}>{deal.wanted.detail} &middot; landed, all in, Irish plates</div>
            </div>
            <b style={{ fontSize: 18, whiteSpace: "nowrap" }}>{money(deal.wanted.landedEur)}</b>
          </div>
          <Fact l="Buyer's target for their car">
            {deal.targetEur ? money(deal.targetEur) : "No target set — dealers just bid"}
          </Fact>
          {deal.wantFinanceQuotes && (
            <div style={S.pill}>Buyer wants finance quotes on the balance</div>
          )}
          <p style={S.sm}>
            You bid a trade-in allowance against this all-in price — take the
            deal at {money(deal.wanted.landedEur)}, or name the adjusted total
            you&rsquo;d do the whole deal at. We import the car and handle the
            UK VAT reclaim; it arrives ready to hand over.
          </p>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.pad}>
          <h2 style={S.h2}>Your bid</h2>
          {actionError && <div style={S.err}>{actionError}</div>}

          {currentBid && (
            <div style={S.myBid}>
              <div style={S.lab}>
                {currentBid.status === "accepted" ? "Your accepted bid" : "Your current bid"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {money(currentBid.allowanceEur)}{" "}
                <span style={S.muted}>
                  {currentBid.atUkciPrice
                    ? `at the shown price (${money(deal.wanted.landedEur)})`
                    : `with adjusted total ${money(currentBid.adjustedTotalEur)}`}
                </span>
              </div>
              {currentBid.conditions && (
                <div style={S.sm}>Conditions: {currentBid.conditions}</div>
              )}
              <p style={S.sm}>Indicative and subject to physical inspection of the car.</p>
              {canWithdraw && (
                <button style={S.linkBtn} onClick={() => void withdrawBid(currentBid)}>
                  Withdraw this bid
                </button>
              )}
            </div>
          )}

          {deal.status === "live" ? (
            <BidForm
              key={myOpen ? myOpen.id : "new"}
              token={token}
              dealId={deal.id}
              existing={myOpen ?? null}
              landedEur={deal.wanted.landedEur}
              onDone={() => void load()}
            />
          ) : (
            !currentBid && <p style={S.body}>Bidding is closed on this deal.</p>
          )}
        </div>
      </div>
    </main>
  );
}

// ---------- photos ----------

function PhotoGrid({ draftId }: { draftId: string }) {
  const [slots, setSlots] = useState<PhotoSlot[] | null>(null);

  useEffect(() => {
    if (!draftId) {
      setSlots([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/tradein-photo?draftId=${encodeURIComponent(draftId)}`);
        const j = (await r.json()) as {
          ok: boolean;
          slots?: PhotoSlot[];
          photos?: PhotoSlot[];
        };
        if (alive) setSlots(j.slots ?? j.photos ?? []);
      } catch {
        if (alive) setSlots([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [draftId]);

  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.pad}>
        <h2 style={S.h2}>
          Photos{slots ? ` (${slots.length})` : ""}
        </h2>
        <p style={S.sub}>
          Guided shots taken by the seller — what you&rsquo;ve already seen
          here, nobody argues about on the day.
        </p>
        {slots == null ? (
          <div style={S.sm}>Loading photos&hellip;</div>
        ) : slots.length === 0 ? (
          <div style={S.sm}>No photos uploaded yet.</div>
        ) : (
          <div style={S.photoGrid}>
            {slots.map((s) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={s.slot}
                src={`/api/tradein-photo?draftId=${encodeURIComponent(draftId)}&slot=${encodeURIComponent(s.slot)}`}
                alt={s.slot.replace(/_/g, " ")}
                title={s.slot.replace(/_/g, " ")}
                loading="lazy"
                style={S.photo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- the bid form ----------

function BidForm({
  token,
  dealId,
  existing,
  landedEur,
  onDone,
}: {
  token: string;
  dealId: string;
  existing: DealerBid | null;
  landedEur: number;
  onDone: () => void;
}) {
  const [allowance, setAllowance] = useState(existing ? String(existing.allowanceEur) : "");
  const [atPrice, setAtPrice] = useState<"" | "yes" | "no">(
    existing ? (existing.atUkciPrice ? "yes" : "no") : "",
  );
  const [adjusted, setAdjusted] = useState(
    existing && existing.adjustedTotalEur != null ? String(existing.adjustedTotalEur) : "",
  );
  const [conditions, setConditions] = useState(existing ? existing.conditions : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const allowanceEur = Number(allowance.replace(/[^\d]/g, ""));
    if (!allowanceEur) {
      setError("Enter your trade-in allowance in euro.");
      return;
    }
    if (!atPrice) {
      setError("Say whether you'll do the deal at the shown all-in price.");
      return;
    }
    let adjustedTotalEur: number | null = null;
    if (atPrice === "no") {
      adjustedTotalEur = Number(adjusted.replace(/[^\d]/g, ""));
      if (!adjustedTotalEur) {
        setError("Enter the adjusted all-in total you'd do the deal at.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/deal/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          dealId,
          allowanceEur,
          atUkciPrice: atPrice === "yes",
          adjustedTotalEur,
          conditions: conditions.trim(),
        }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (j.ok) {
        onDone();
      } else {
        setError(j.error || "The bid didn't go through — try again.");
      }
    } catch {
      setError("The bid didn't go through — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div style={existing ? S.formTop : undefined}>
      <div style={S.lab}>{existing ? "Replace your bid" : "Place a bid"}</div>
      {existing && (
        <p style={S.sm}>Placing a new bid replaces your current one.</p>
      )}

      <label style={S.field}>
        <span style={S.flab}>Trade-in allowance (&euro;)</span>
        <input
          style={S.input}
          inputMode="numeric"
          placeholder="13,500"
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
        />
      </label>

      <div style={S.q}>
        <div style={S.qlab}>At the shown price?</div>
        <div style={S.opts}>
          <Opt on={atPrice === "yes"} onClick={() => setAtPrice("yes")}>
            Yes — at {money(landedEur)}
          </Opt>
          <Opt on={atPrice === "no"} onClick={() => setAtPrice("no")}>
            No — I&rsquo;ll adjust the total
          </Opt>
        </div>
        {atPrice === "no" && (
          <div style={{ marginTop: 10 }}>
            <label style={S.field}>
              <span style={S.flab}>Adjusted all-in total (&euro;)</span>
              <input
                style={S.input}
                inputMode="numeric"
                placeholder="27,950"
                value={adjusted}
                onChange={(e) => setAdjusted(e.target.value)}
              />
            </label>
            <p style={S.sm}>
              The all-in figure you&rsquo;d do the whole deal at instead of{" "}
              {money(landedEur)}.
            </p>
          </div>
        )}
      </div>

      <label style={S.field}>
        <span style={S.flab}>Conditions (optional)</span>
        <textarea
          style={S.textarea}
          rows={3}
          placeholder="e.g. Allowance assumes both keys present and NCT as stated."
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
        />
      </label>

      {error && <div style={S.err}>{error}</div>}

      <div style={S.submitRow}>
        <button style={{ ...S.cta, ...(busy ? S.ctaBusy : {}) }} disabled={busy} onClick={() => void submit()}>
          {busy ? "Sending…" : existing ? "Replace bid" : "Place bid"}
        </button>
        <span style={S.inspect}>
          Every bid is indicative and subject to physical inspection of the car.
        </span>
      </div>
    </div>
  );
}

// ---------- at the inspection: renegotiate or cancel with a reason ----------

const CHECKLIST: [string, string][] = [
  ["accident_damage", "Accident damage"],
  ["warning_lights", "Warning lights"],
  ["mileage_discrepancy", "Mileage discrepancy"],
  ["finance_undisclosed", "Finance owing, undisclosed"],
  ["non_runner", "Not driving"],
];

function InspectionPanel({
  token,
  deal,
  onDone,
}: {
  token: string;
  deal: DealerDeal;
  onDone: () => void;
}) {
  const accepted = deal.myBids.find((b) => b.status === "accepted");
  const rn = deal.renegotiation;
  const [revised, setRevised] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) setErr(j.error || "That didn't go through — try again.");
      else onDone();
    } catch {
      setErr("Couldn't reach the server — try again.");
    }
    setBusy(false);
  }

  function toggle(k: string) {
    setItems((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
  }

  async function cancel() {
    if (!category) { setErr("Pick the reason for cancelling."); return; }
    if (category === "misdescription" && items.length === 0) {
      setErr("Tick the undisclosed item(s) — the description guarantee only covers those.");
      return;
    }
    if (detail.trim().length < 20) {
      setErr("Give a proper account — the seller and our staff read it word for word.");
      return;
    }
    const warn =
      "Cancel this deal? The reason and your account go on the record" +
      (category === "misdescription"
        ? ", and the seller has 48 hours to accept or contest your report."
        : ".");
    if (!window.confirm(warn)) return;
    await post("/api/deal/cancel", {
      token,
      dealId: deal.id,
      category,
      checklistItems: items,
      detail: detail.trim(),
    });
  }

  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.pad}>
        <h2 style={S.h2}>At the inspection</h2>
        <p style={S.sub}>
          You collect and inspect at the seller&rsquo;s address — payment before
          the car moves. If the description was accurate, the figure
          doesn&rsquo;t change at the door. Found something that wasn&rsquo;t
          disclosed? Propose a revised figure — most description issues end in
          an agreed price, not a cancellation.
        </p>
        {err && <div style={S.err}>{err}</div>}

        {rn && rn.status === "proposed" && (
          <p style={S.body}>
            You proposed {money(rn.allowanceEur)} (was {money(rn.originalAllowanceEur)})
            — waiting for the seller&rsquo;s answer.
          </p>
        )}
        {rn && rn.status === "accepted" && (
          <p style={S.body}>
            The seller accepted {money(rn.allowanceEur)} — complete the deal at
            that figure.
          </p>
        )}
        {rn && rn.status === "declined" && (
          <p style={S.body}>
            The seller declined your revised figure — the deal stands at{" "}
            {money(rn.originalAllowanceEur)}. Complete at that figure, or cancel
            below with a documented reason.
          </p>
        )}

        {(!rn || rn.status === "declined") && accepted && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 8 }}>
            <div style={S.lab}>Propose a revised figure</div>
            <label style={S.field}>
              <span style={S.flab}>
                Revised allowance (&euro;) — accepted was {money(accepted.allowanceEur)}
              </span>
              <input
                style={S.input}
                inputMode="numeric"
                value={revised}
                onChange={(e) => setRevised(e.target.value)}
              />
            </label>
            <label style={S.field}>
              <span style={S.flab}>What you found (the seller reads this word for word)</span>
              <textarea
                style={S.textarea}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              style={S.cta}
              disabled={busy}
              onClick={() => {
                const n = Number(revised.replace(/[^\d]/g, ""));
                if (!n) { setErr("Enter the revised allowance in euro."); return; }
                if (note.trim().length < 20) {
                  setErr("Say what you found — it goes to the seller word for word.");
                  return;
                }
                void post("/api/deal/renegotiate", {
                  token,
                  dealId: deal.id,
                  allowanceEur: n,
                  note: note.trim(),
                });
              }}
            >
              Propose revised figure
            </button>
          </div>
        )}

        <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 14 }}>
          <div style={S.lab}>Cancel the deal</div>
          <p style={S.sm}>
            Cancelling needs a reason and an account — both go on the record. A
            description claim needs the fault photographed with the car
            identifiable, judged against the seller&rsquo;s own pack.
          </p>
          <div style={S.opts}>
            {([
              ["misdescription", "Not as described"],
              ["changed_mind", "Changed my mind"],
              ["logistics", "Logistics"],
              ["other", "Other"],
            ] as [string, string][]).map(([k, l]) => (
              <Opt key={k} on={category === k} onClick={() => setCategory(k)}>
                {l}
              </Opt>
            ))}
          </div>
          {category === "misdescription" && (
            <div style={{ ...S.opts, marginTop: 10 }}>
              {CHECKLIST.map(([k, l]) => (
                <Opt key={k} on={items.includes(k)} onClick={() => toggle(k)}>
                  {l}
                </Opt>
              ))}
            </div>
          )}
          <label style={{ ...S.field, marginTop: 10 }}>
            <span style={S.flab}>Your account</span>
            <textarea
              style={S.textarea}
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          <button
            style={{ ...S.cta, background: "#555" }}
            disabled={busy}
            onClick={() => void cancel()}
          >
            Cancel this deal
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- small shared pieces ----------

function Fact({ l, children }: { l: string; children: ReactNode }) {
  return (
    <div style={S.factRow}>
      <span style={S.factLab}>{l}</span>
      <span style={S.factVal}>{children}</span>
    </div>
  );
}

function Opt({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ ...S.opt, ...(on ? S.optOn : {}) }}>
      {children}
    </button>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 880, margin: "0 auto", padding: "22px 16px 60px", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#1a1a1a" },
  banner: { background: "#fff8e6", border: "1px solid #f0dfae", color: "#9a6a00", fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 6, marginBottom: 18 },
  h1: { fontSize: 28, margin: "0 0 8px", letterSpacing: "-.6px" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, margin: "10px 0 6px" },
  lede: { fontSize: 14, color: "#555", margin: "0 0 18px", lineHeight: 1.55 },
  card: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fff", overflow: "hidden" },
  wonCard: { borderColor: "#bfe0c6", background: "#f4faf5", marginBottom: 14 },
  pad: { padding: "16px 20px 18px" },
  h2: { fontSize: 19, margin: "0 0 6px", letterSpacing: "-.3px" },
  sub: { fontSize: 13, color: "#666", margin: "0 0 12px", lineHeight: 1.55 },
  body: { fontSize: 14, color: "#333", margin: 0, lineHeight: 1.6 },
  lab: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 6 },
  big: { fontSize: 26, fontWeight: 700, letterSpacing: "-.5px", margin: "2px 0" },
  sm: { fontSize: 12.5, color: "#6a6a6a", lineHeight: 1.55, marginTop: 8 },
  muted: { fontSize: 13, color: "#777", fontWeight: 500 },
  err: { border: "1px solid #e8c9c9", background: "#fdf7f7", color: "#b60b0c", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, margin: "6px 0 10px" },
  link: { color: "#1a5fb4", textDecoration: "underline", fontSize: 13.5 },
  linkBtn: { background: "none", border: "none", color: "#1a5fb4", textDecoration: "underline", fontSize: 12.5, cursor: "pointer", padding: 0, marginTop: 8 },
  statusPill: { fontSize: 11.5, padding: "4px 12px", borderRadius: 999, fontWeight: 700 },
  gateRow: { display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 4px" },
  gatePill: { fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: "#fff8e6", color: "#9a6a00", fontWeight: 700, border: "1px solid #f0dfae" },
  gateDone: { background: "#eef4ee", color: "#0a7d33", border: "1px solid #bfe0c6" },
  contact: { marginTop: 12, border: "1px solid #bfe0c6", borderRadius: 8, padding: "12px 14px", background: "#fff" },
  photoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 },
  photo: { width: "100%", height: 110, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e2e2", display: "block", background: "#f0f0ee" },
  factRow: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, padding: "7px 0", borderTop: "1px solid #f2f2f2", flexWrap: "wrap" },
  factLab: { color: "#8a8a8a", fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" },
  factVal: { textAlign: "right", fontWeight: 600, minWidth: 0 },
  carRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "1px solid #eee", borderRadius: 8, padding: "14px 16px", marginBottom: 10, flexWrap: "wrap" },
  pill: { display: "inline-block", fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: "#eef4ee", color: "#0a7d33", fontWeight: 600, marginTop: 8 },
  myBid: { border: "1px solid #e2e2e2", borderRadius: 8, padding: "12px 14px", background: "#fbfbf9", marginBottom: 14 },
  formTop: { borderTop: "1px solid #eee", paddingTop: 14 },
  field: { display: "block", marginBottom: 12, maxWidth: 420 },
  flab: { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  input: { width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", fontSize: 15, fontFamily: "inherit", background: "#fff" },
  textarea: { width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", background: "#fff" },
  q: { borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4, marginBottom: 12 },
  qlab: { fontSize: 14, fontWeight: 600, marginBottom: 8 },
  opts: { display: "flex", gap: 8, flexWrap: "wrap" },
  opt: { border: "1px solid #ccc", background: "#fff", borderRadius: 999, padding: "7px 15px", fontSize: 13, cursor: "pointer" },
  optOn: { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a", fontWeight: 600 },
  submitRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 4 },
  cta: { background: "#b60b0c", color: "#fff", border: "none", borderRadius: 6, padding: "12px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  ctaBusy: { opacity: 0.7, cursor: "wait" },
  inspect: { fontSize: 12.5, color: "#9a6a00", fontWeight: 600, maxWidth: 320, lineHeight: 1.45 },
};
