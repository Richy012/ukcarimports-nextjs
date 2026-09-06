"use client";

import DraftBanner from "@/app/components/DraftBanner";
import DealBuilderFlow from "./DealBuilderFlow";

/**
 * Deal Builder — dealer portal, staging.
 *
 * /deal-builder            the pitch + registration (no token in the URL)
 * /deal-builder?token=T    the dealer's live board (magic-link auth)
 *
 * Everything on the board comes from GET /api/dealer, whose serializer
 * (dealForDealer in lib/dealstore) is the identity gate: buyer name, email,
 * phone and full eircode are NEVER in the payload until a deal is matched,
 * so this page cannot leak them. Do not add fields the serializer does not
 * emit, and never fetch a deal any other way.
 *
 * The only price of the import car anywhere is wanted.landedEur — all-in.
 * Every bid figure carries "indicative, subject to inspection" (owner rule).
 *
 * Layout is deliberately single-column so no media query is needed; the
 * only grids are auto-fit/auto-fill, which collapse on their own.
 */

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
}

interface PortalDealer {
  name: string;
  county: string;
  approved: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  live: "Open for bids",
  accepted: "Bid accepted — deposit stage",
  matched: "Matched — contact revealed",
  completed: "Completed",
};

const STATUS_ORDER: Record<string, number> = { live: 0, accepted: 1, matched: 2, completed: 3 };

const STATUS_STYLE: Record<string, CSSProperties> = {
  live: { background: "#eef4ee", color: "#0a7d33" },
  accepted: { background: "#fff8e6", color: "#9a6a00" },
  matched: { background: "#e8f0fb", color: "#1a5fb4" },
  completed: { background: "#f0f0ee", color: "#555" },
};

const COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry",
  "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth",
  "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary",
  "Waterford", "Westmeath", "Wexford", "Wicklow",
];

// ---------- page ----------

export default function DealBuilderPage() {
  return (
    <Suspense
      fallback={
        <main style={S.page}>
          <div style={S.sm}>Loading&hellip;</div>
        </main>
      }
    >
      <DealBuilderInner />
    </Suspense>
  );
}

function DealBuilderInner() {
  const token = useSearchParams().get("token");
  if (!token) return <RegisterView />;
  return <PortalView token={token} />;
}

// ---------- the pitch + registration (no token) ----------

function RegisterView() {
  const [name, setName] = useState("");
  const [vat, setVat] = useState("");
  const [email, setEmail] = useState("");
  const [county, setCounty] = useState("");
  const [takes, setTakes] = useState<"" | "yes" | "sometimes" | "no">("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<"" | "approved" | "pending">("");
  const [error, setError] = useState("");

  async function register() {
    if (!name.trim() || !vat.trim() || !email.trim() || !county) {
      setError("All four fields are needed.");
      return;
    }
    if (!takes) {
      setError("Tell us whether you take trade-ins — it is the one thing we ask.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/dealer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vat: vat.trim(),
          email: email.trim(),
          name: name.trim(),
          county,
          takesTradeIns: takes,
        }),
      });
      const j = (await r.json()) as { ok: boolean; approved?: boolean; error?: string };
      if (j.ok) setSent(j.approved ? "approved" : "pending");
      else setError(j.error || "That didn't go through — try again.");
    } catch {
      setError("That didn't go through — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <main style={S.page}>
      <style>{`
        @keyframes dbStepGlow {
          0%, 24%, 100% { border-color: #e2e2e2; background: #fff; box-shadow: none; }
          4%, 16% { border-color: #b60b0c; background: #fdf7f7; box-shadow: 0 2px 10px rgba(182,11,12,.12); }
        }
        .dbStep { animation: dbStepGlow 15s infinite; }
      `}</style>

      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
      <h1 style={S.h1}>Sell a car you never bought</h1>
      <p style={S.lede}>
        Someone buying a UK import through us has a car to get rid of. We put its full file
        in front of you &mdash; photos, condition, history, what it makes on the Irish market
        &mdash; and the whole panel bids what they would give for it. <b>Best bid wins both cars</b>
        &mdash; the import to sell on and the trade-in to retail &mdash; without you funding a car
        or leaving the yard.
      </p>

      {/* VIRTUAL STOCK — owner, 6 Sep: reinforce the concept and its benefits at the top */}
      <div style={{ ...S.card, marginBottom: 18 }}>
        <div style={S.pad}>
          <div style={S.lab}>Virtual stock &mdash; why it works for you</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 6 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Never a loss on a virtual car</div>
              <div style={S.sm}>The import is sold to a buyer who has already paid a deposit before you ever commit to it. There is no car on your books to go wrong.</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>None of your working capital</div>
              <div style={S.sm}>No stock funded, no sourcing trip, no money sitting on a forecourt waiting for a buyer. The buyer is already there.</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Every deal goes to the panel</div>
              <div style={S.sm}>Each deal &mdash; the import sale and the trade-in together &mdash; is put to every dealer on the panel. You bid what it is worth to you; the best bid wins. You are never the only price and never obliged to bid.</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Or buy it in and sell it on finance</div>
              <div style={S.sm}>If you prefer, buy the import into stock and sell it to the client on your own finance &mdash; and take that margin as well. A finance-house buyer comes to you for exactly that reason.</div>
            </div>
          </div>
          <p style={{ ...S.sm, marginTop: 10 }}>Watch how a deal runs, below.</p>
        </div>
      </div>

      {/* the process and the money, as a moving picture (DealBuilderFlow.tsx) */}
      <DealBuilderFlow />

      <p style={{ ...S.sm, marginBottom: 18 }}>
        Nothing binds you sight-unseen &mdash; every bid is indicative until you inspect. Descriptions
        are money-backed by a &euro;500 guarantee: find something undisclosed and you propose a
        revised figure through the platform. Most description issues end in an agreed price.
      </p>

      {/* registration LAST — sell first, ask after */}
      <div style={S.card}>
        <div style={S.pad}>
          <h2 style={S.h2}>Get on the panel</h2>
          {sent === "approved" ? (
            <div style={{ border: "1px solid #bfe0c6", background: "#f4faf5", color: "#0a7d33", borderRadius: 8, padding: "14px 16px", fontSize: 14.5, fontWeight: 600, lineHeight: 1.55 }}>
              Your VAT checked out — you&rsquo;re approved. Your access link is
              on its way to {email.trim()}. It&rsquo;s your login; no password.
            </div>
          ) : sent === "pending" ? (
            <p style={S.sub}>
              Registration received. We&rsquo;ll finish a quick verification and
              email your access link &mdash; usually the same day.
            </p>
          ) : (
            <>
              <p style={S.sub}>
                Your VAT number is checked against the EU register as you
                register &mdash; if it validates and matches your name, your
                access link is emailed immediately.
              </p>
              <Field label="Trading name" placeholder="Murphy Motors" value={name} onChange={setName} />
              <Field label="VAT number" placeholder="IE1234567X" value={vat} onChange={setVat} />
              <Field label="Business email" placeholder="you@yourgarage.ie" value={email} onChange={setEmail} />
              <label style={S.field}>
                <span style={S.flab}>County</span>
                <select style={S.input} value={county} onChange={(e) => setCounty(e.target.value)}>
                  <option value="">Choose&hellip;</option>
                  {COUNTIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div style={{ marginBottom: 14 }}>
                <span style={S.flab}>Do you take trade-ins today?</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {([["yes", "Yes, regularly"], ["sometimes", "Sometimes"], ["no", "No"]] as ["yes" | "sometimes" | "no", string][]).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTakes(k)}
                      style={{
                        border: "1px solid " + (takes === k ? "#1a1a1a" : "#ccc"),
                        background: takes === k ? "#1a1a1a" : "#fff",
                        color: takes === k ? "#fff" : "#1a1a1a",
                        borderRadius: 999,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: takes === k ? 700 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {error && <div style={S.err}>{error}</div>}
              <button style={{ ...S.cta, ...(busy ? S.ctaBusy : {}) }} disabled={busy} onClick={register}>
                {busy ? "Checking your VAT…" : "Register — instant access if your VAT checks out"}
              </button>
              <p style={S.sm}>
                No password, no portal login to remember: your email carries a
                private link straight to your deals.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ExRow({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: strong ? 15.5 : 13.5, padding: "5px 12px 5px 0", fontWeight: strong ? 800 : 400 }}>
      <span style={{ color: strong ? "#0a7d33" : "#666" }}>{l}</span>
      <span style={{ whiteSpace: "nowrap", color: strong ? "#0a7d33" : "#1a1a1a", fontWeight: strong ? 800 : 600 }}>{v}</span>
    </div>
  );
}

// ---------- the board (?token=) ----------

function PortalView({ token }: { token: string }) {
  const [dealer, setDealer] = useState<PortalDealer | null>(null);
  const [deals, setDeals] = useState<DealerDeal[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/dealer?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await r.json()) as {
        ok: boolean;
        error?: string;
        dealer?: PortalDealer;
        deals?: DealerDeal[];
      };
      if (!r.ok || !j.ok || !j.dealer) {
        setError("That access link isn't recognised. Use the link from your approval email, or register below.");
      } else {
        setDealer(j.dealer);
        setDeals(j.deals ?? []);
        setError("");
      }
    } catch {
      setError("Couldn't load your deals — try again in a moment.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <div style={S.sm}>Loading your deals&hellip;</div>
      </main>
    );
  }

  if (error || !dealer) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <h1 style={S.h1}>Deal Builder</h1>
        <div style={S.err}>{error || "Something went wrong."}</div>
        <p style={S.sm}>
          <Link href="/deal-builder" style={S.link}>Register as a dealer &rarr;</Link>
        </p>
      </main>
    );
  }

  if (!dealer.approved) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
        <h1 style={S.h1}>Verification in progress</h1>
        <div style={S.card}>
          <div style={S.pad}>
            <p style={S.body}>
              Thanks, {dealer.name} — we&rsquo;re finishing a quick
              verification, usually the same day. There is nothing for you to
              send. Once it&rsquo;s done, this same link shows your live deals
              and you&rsquo;ll get an email each time a new one goes up.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const sorted = [...deals].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      (a.createdAt < b.createdAt ? 1 : -1),
  );

  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>
      <div style={S.headRow}>
        <h1 style={{ ...S.h1, margin: 0 }}>Your deals</h1>
        <span style={S.who}>
          {dealer.name} &middot; {dealer.county}{" "}
          <button style={S.linkBtn} onClick={() => { setLoading(true); void load(); }}>Refresh</button>
        </span>
      </div>
      <p style={S.lede}>
        Each deal is a committed import buyer with a trade-in attached. Open a
        deal to see the full file and bid. Every bid is indicative and subject
        to physical inspection.
      </p>

      {sorted.length === 0 ? (
        <div style={S.card}>
          <div style={S.pad}>
            <p style={S.body}>
              No deals on the board right now. You&rsquo;ll get an email the
              moment one goes live.
            </p>
          </div>
        </div>
      ) : (
        sorted.map((d) => <DealCard key={d.id} d={d} token={token} />)
      )}
    </main>
  );
}

function DealCard({ d, token }: { d: DealerDeal; token: string }) {
  const t = d.tradeIn;
  const title = [t.year ?? "", t.make, t.model].filter(Boolean).join(" ");
  const myBid =
    d.myBids.find((b) => b.status === "accepted") ??
    d.myBids.find((b) => b.status === "open");
  const v = d.valuation;
  const band =
    v.bandLowEur != null && v.bandHighEur != null
      ? `${money(v.bandLowEur)}–${money(v.bandHighEur)} (${v.comparables} Irish comparables)`
      : v.note || "Not enough Irish evidence";

  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={S.cardHead}>
        <b style={{ fontSize: 15.5 }}>{title || "Trade-in"}</b>
        <span style={{ ...S.statusPill, ...(STATUS_STYLE[d.status] ?? {}) }}>
          {STATUS_LABEL[d.status] ?? d.status}
        </span>
      </div>
      <div style={S.pad}>
        <div style={S.facts}>
          <span style={S.fact}>
            {t.mileage != null
              ? `${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit === "miles" ? "miles" : "km"}`
              : "Mileage not given"}
          </span>
          <span style={S.fact}>NCT: {t.nct || "—"}</span>
          {t.financeOutstanding === "yes" && <span style={{ ...S.fact, ...S.factWarn }}>Finance outstanding</span>}
          <span style={S.fact}>
            <PhotoCount draftId={d.photos} />
          </span>
          <span style={S.fact}>Area: {d.eircodeArea || "—"}</span>
          <span style={S.fact}>
            {d.bidCount === 1 ? "1 open bid" : `${d.bidCount} open bids`}
          </span>
        </div>

        <div style={S.cardRow}>
          <span style={S.cardRowLab}>Irish market evidence</span>
          <span>{band}</span>
        </div>
        <div style={S.cardRow}>
          <span style={S.cardRowLab}>They&rsquo;re buying</span>
          <span>
            {d.wanted.title} — <b>{money(d.wanted.landedEur)}</b> all-in
          </span>
        </div>
        {myBid && (
          <div style={S.cardRow}>
            <span style={S.cardRowLab}>Your bid</span>
            <span>
              <b>{money(myBid.allowanceEur)}</b>{" "}
              {myBid.atUkciPrice
                ? "at the shown price"
                : `with adjusted total ${money(myBid.adjustedTotalEur)}`}{" "}
              <span style={S.muted}>&middot; indicative, subject to inspection</span>
            </span>
          </div>
        )}

        <Link
          href={`/deal-builder/deal/${d.id}?token=${encodeURIComponent(token)}`}
          style={S.openLink}
        >
          Open the full file and bid &rarr;
        </Link>
      </div>
    </div>
  );
}

function PhotoCount({ draftId }: { draftId: string }) {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    if (!draftId) {
      setN(0);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/tradein-photo?draftId=${encodeURIComponent(draftId)}`);
        const j = (await r.json()) as {
          ok: boolean;
          slots?: unknown[];
          photos?: unknown[];
        };
        if (alive) setN((j.slots ?? j.photos ?? []).length);
      } catch {
        if (alive) setN(0);
      }
    })();
    return () => {
      alive = false;
    };
  }, [draftId]);

  if (n == null) return <>&hellip; photos</>;
  return <>{n === 1 ? "1 photo" : `${n} photos`}</>;
}

// ---------- small shared pieces ----------

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={S.field}>
      <span style={S.flab}>{label}</span>
      <input
        style={S.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 880, margin: "0 auto", padding: "22px 16px 60px", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#1a1a1a" },
  banner: { background: "#fff8e6", border: "1px solid #f0dfae", color: "#9a6a00", fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 6, marginBottom: 18 },
  h1: { fontSize: 30, margin: "0 0 8px", letterSpacing: "-.6px" },
  lede: { fontSize: 15.5, color: "#555", margin: "0 0 22px", maxWidth: 640, lineHeight: 1.55 },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  who: { fontSize: 13, color: "#666" },
  pitchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 },
  card: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fff", overflow: "hidden" },
  cardHead: { padding: "12px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, background: "#fbfbf9" },
  pad: { padding: "16px 20px 18px" },
  h2: { fontSize: 20, margin: "0 0 6px", letterSpacing: "-.3px" },
  sub: { fontSize: 13.5, color: "#666", margin: "0 0 16px", lineHeight: 1.55 },
  body: { fontSize: 14, color: "#333", margin: 0, lineHeight: 1.6 },
  ol: { margin: "4px 0 0", paddingLeft: 18, fontSize: 13.5, color: "#444", lineHeight: 1.7 },
  lab: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 7 },
  field: { display: "block", marginBottom: 12 },
  flab: { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  input: { width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", fontSize: 15, fontFamily: "inherit", background: "#fff" },
  cta: { background: "#b60b0c", color: "#fff", border: "none", borderRadius: 6, padding: "12px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", marginTop: 6 },
  ctaBusy: { opacity: 0.7, cursor: "wait" },
  sm: { fontSize: 12.5, color: "#6a6a6a", lineHeight: 1.55, marginTop: 8 },
  muted: { fontSize: 11.5, color: "#777" },
  err: { border: "1px solid #e8c9c9", background: "#fdf7f7", color: "#b60b0c", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, margin: "6px 0 10px" },
  statusPill: { fontSize: 11.5, padding: "3px 10px", borderRadius: 999, fontWeight: 700 },
  facts: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  fact: { fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "#f0f0ee", color: "#555", fontWeight: 600 },
  factWarn: { background: "#fff8e6", color: "#9a6a00" },
  cardRow: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, padding: "6px 0", borderTop: "1px solid #f2f2f2", flexWrap: "wrap" },
  cardRowLab: { color: "#8a8a8a", fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" },
  openLink: { display: "inline-block", marginTop: 12, fontSize: 13.5, fontWeight: 700, color: "#b60b0c", textDecoration: "underline" },
  link: { color: "#1a5fb4", textDecoration: "underline" },
  linkBtn: { background: "none", border: "none", color: "#1a5fb4", textDecoration: "underline", fontSize: 12.5, cursor: "pointer", padding: 0, marginLeft: 8 },
};
