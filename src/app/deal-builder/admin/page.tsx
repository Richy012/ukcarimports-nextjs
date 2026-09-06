"use client";

import DraftBanner from "@/app/components/DraftBanner";

/**
 * Deal Builder — STAFF CONSOLE. Staging only.
 *
 * Everything the serializers hide from dealers and buyers is visible here on
 * purpose: staff see full buyer identity and full dealer identity at every
 * status. Access is the ?key= query param checked by /api/dealbuilder-admin.
 *
 * Rules this page follows:
 *  - It only ever renders the action buttons that are LEGAL for a deal's
 *    current status (the state machine in lib/dealstore.ts is the authority;
 *    the API 400s on anything illegal anyway — the buttons just don't offer it).
 *  - Deposits are marked HERE, by staff, one side at a time. When both are in,
 *    the API flips the deal to "matched" and reveals identities by itself —
 *    this page never does any revealing of its own.
 *  - Every POST is followed by a full refetch, so what is on screen is always
 *    what is in the store.
 *  - Single column, no media queries needed, dense on purpose — this is a
 *    working surface, not a marketing page.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { useSearchParams } from "next/navigation";
import type {
  Bid,
  Deal,
  Dealer,
  DealStatus,
  Notification,
} from "../../../lib/dealstore";

// ---------- shapes the admin API returns ----------

type StaffBid = Bid & { dealer: Dealer | null };
type StaffDeal = Deal & { bids: StaffBid[]; vrcOnFile?: boolean; idOnFile?: boolean };

interface AdminConfig {
  mailMode: "log" | "staff-only" | "live";
  bandTiers: { fast: [number, number]; ordinary: [number, number]; slow: [number, number] };
  bidWindowHours: number;
  dealerFeeEur: number;
  buyerGuaranteeEur: number;
  dealerCreditEur: number;
}

interface AdminData {
  deals: StaffDeal[];
  dealers: Dealer[];
  notifications: Notification[];
  config: AdminConfig;
}

// ---------- little helpers ----------

const eur = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("en-IE", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })
  );
};

/**
 * Trading names legitimately differ from registered names ("Murphy Motors"
 * vs "MURPHY MOTOR SALES LIMITED"), so never auto-reject — but when the two
 * share not a single meaningful word, say so out loud. Legal suffixes are
 * ignored for the comparison.
 */
function namesShareNothing(trading: string, registered: string): boolean {
  const toks = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !["limited", "ltd", "dac", "ulc", "plc", "the", "and", "teoranta"].includes(w)),
    );
  const a = toks(trading);
  const b = toks(registered);
  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (b.has(w)) return false;
  return true;
}

const STATUS_ORDER: DealStatus[] = [
  "submitted",
  "live",
  "accepted",
  "matched",
  "paused_car",
  "expired",
  "collapsed_dealer",
  "collapsed_buyer",
  "completed",
  "declined",
  "withdrawn",
];

const STATUS_LABEL: Record<DealStatus, string> = {
  submitted: "Submitted — awaiting approval",
  live: "Live — open for bids",
  accepted: "Accepted — deposit gate open",
  matched: "Matched — identities revealed",
  paused_car: "Paused — car unavailable",
  expired: "Expired",
  collapsed_dealer: "Collapsed — dealer walked",
  collapsed_buyer: "Collapsed — buyer walked",
  completed: "Completed",
  declined: "Declined",
  withdrawn: "Withdrawn by buyer",
};

const STATUS_PILL: Record<DealStatus, CSSProperties> = {
  submitted: { background: "#fff8e6", color: "#9a6a00" },
  live: { background: "#eef4ee", color: "#0a7d33" },
  accepted: { background: "#e8f0fb", color: "#1a5fb4" },
  matched: { background: "#f3ecfa", color: "#6b2fb3" },
  paused_car: { background: "#f0f0ee", color: "#666" },
  expired: { background: "#f0f0ee", color: "#666" },
  collapsed_dealer: { background: "#fdf0f0", color: "#b60b0c" },
  collapsed_buyer: { background: "#fdf0f0", color: "#b60b0c" },
  completed: { background: "#1a1a1a", color: "#fff" },
  declined: { background: "#f0f0ee", color: "#666" },
  withdrawn: { background: "#f0f0ee", color: "#666" },
};

const MAIL_MODES: { mode: AdminConfig["mailMode"]; label: string; note: string }[] = [
  {
    mode: "log",
    label: "Log only",
    note: "Notification rows only — no email leaves the box at all.",
  },
  {
    mode: "staff-only",
    label: "Staff-only",
    note: "Every email goes to info@ukcarimports.ie with the intended recipient named in the subject — nobody outside the business gets staging mail.",
  },
  {
    mode: "live",
    label: "Live",
    note: "Emails go to their real recipients — flip only when dealers are real and Richard says so.",
  },
];

// ---------- page ----------

export default function AdminPage() {
  return (
    <Suspense fallback={<main style={S.page}>Loading…</main>}>
      <AdminConsole />
    </Suspense>
  );
}

function AdminConsole() {
  const sp = useSearchParams();
  const key = sp.get("key") ?? "";

  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!key) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(
        `/api/dealbuilder-admin?key=${encodeURIComponent(key)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as { ok: boolean; error?: string } & Partial<AdminData>;
      if (!j.ok || !j.config) {
        setErr(j.error || "admin request refused — check the key");
        setData(null);
      } else {
        setData({
          deals: j.deals ?? [],
          dealers: j.dealers ?? [],
          notifications: j.notifications ?? [],
          config: j.config,
        });
      }
    } catch {
      setErr("could not reach /api/dealbuilder-admin");
    }
    setLoading(false);
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/dealbuilder-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, action, ...extra }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) setErr(`${action}: ${j.error || "failed"}`);
    } catch {
      setErr(`${action}: request failed`);
    }
    await load();
    setBusy(false);
  }

  // ----- per-deal action handlers (prompts live here, not in the API) -----

  function approveDeal(deal: StaffDeal) {
    const marginNote = (notes[deal.id] ?? deal.marginNote).trim();
    if (!deal.vrcOnFile || !deal.idOnFile) {
      if (
        !window.confirm(
          "Seller documents missing (VRC and/or photo ID) — the ID-matches-VRC check is the point of approval. Approve to dealers anyway?",
        )
      )
        return;
      void act("approve_deal", { dealId: deal.id, marginNote, allowMissingVrc: true });
      return;
    }
    void act("approve_deal", { dealId: deal.id, marginNote });
  }

  // THE OFFER, made by a person (owner, 5 Sep). The model's suggestion is on
  // the card as a starting point; the figure typed here is what the customer
  // gets, by the email template in lib/dealnotify.ts and on their status page.
  function makeOffer(deal: StaffDeal) {
    const start = deal.offer?.eur ?? deal.suggestion?.eur ?? deal.valuation.bandLowEur ?? "";
    const raw = window.prompt(
      `Your offer for the ${[deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ")} in euro` +
        (deal.suggestion ? ` (model suggestion ${eur(deal.suggestion.eur)}, range ${eur(deal.suggestion.lowEur)}–${eur(deal.suggestion.highEur)})` : "") +
        ":",
      String(start),
    );
    if (raw === null) return;
    const amount = Math.round(Number(String(raw).replace(/[^0-9.]/g, "")));
    if (!Number.isFinite(amount) || amount < 100) {
      setErr("make_offer: enter the offer in euro");
      return;
    }
    const note = window.prompt("One line for the customer's email (optional) — why this figure, or anything they should know:", deal.offer?.note ?? "");
    if (note === null) return;
    if (!window.confirm(`Send ${eur(amount)} to ${deal.buyer.name} (${deal.buyer.email})? It goes by email and onto their status page.`)) return;
    void act("make_offer", { dealId: deal.id, eur: amount, note: note.trim() });
  }

  function declineDeal(deal: StaffDeal) {
    const reason = window.prompt(
      "Reason for declining — the buyer will be told this:",
    );
    if (reason === null || !reason.trim()) return;
    void act("decline_deal", { dealId: deal.id, reason: reason.trim() });
  }

  function collapseDeal(deal: StaffDeal, side: "dealer" | "buyer") {
    const note = window.prompt(
      side === "dealer"
        ? "Dealer walked — note for the record (dealer deposit forfeit rule applies):"
        : "Buyer walked — note for the record:",
    );
    if (note === null) return;
    void act("collapse", { dealId: deal.id, side, note: note.trim() });
  }

  function completeDeal(deal: StaffDeal) {
    if (
      !window.confirm(
        "Mark completed? Handover confirmed, both parties notified. The €900 fee was taken at acceptance; the VAT-reclaim engagement is offered separately.",
      )
    )
      return;
    void act("complete", { dealId: deal.id });
  }

  function banDealer(dealer: Dealer) {
    if (
      !window.confirm(
        `Ban ${dealer.name}? Their open bids are withdrawn and they lose portal access.`,
      )
    )
      return;
    void act("ban_dealer", { dealerId: dealer.id });
  }

  function rotateToken(dealer: Dealer) {
    if (
      !window.confirm(
        `Rotate the token for ${dealer.name}? Their old portal link stops working immediately.`,
      )
    )
      return;
    void act("rotate_dealer_token", { dealerId: dealer.id });
  }

  async function copyPortalLink(dealer: Dealer) {
    const url = `${window.location.origin}/deal-builder?token=${dealer.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(dealer.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      window.prompt("Copy the portal link:", url);
    }
  }

  // ----- gates -----

  if (!key) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staff console, staging only</DraftBanner>
        <h1 style={S.h1}>Deal Builder — staff console</h1>
        <p style={S.sm}>
          No key. Open this page as /deal-builder/admin?key=&lt;admin key&gt;
          (it lives in data/dealbuilder.json on the staging box).
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staff console, staging only</DraftBanner>
        <p style={S.sm}>Loading…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={S.page}>
        <DraftBanner style={S.banner}>WORKING DRAFT — staff console, staging only</DraftBanner>
        <h1 style={S.h1}>Deal Builder — staff console</h1>
        <div style={S.err}>{err || "No data."}</div>
        <button style={S.btn} disabled={busy} onClick={() => void load()}>
          Try again
        </button>
      </main>
    );
  }

  const groups = STATUS_ORDER.map((status) => ({
    status,
    deals: data.deals.filter((d) => d.status === status),
  })).filter((g) => g.deals.length > 0);

  const pendingDealers = data.dealers.filter((d) => !d.approved);
  const approvedDealers = data.dealers.filter((d) => d.approved);
  const activeMode = MAIL_MODES.find((m) => m.mode === data.config.mailMode);

  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staff console, staging only</DraftBanner>

      <div style={S.headRow}>
        <h1 style={S.h1}>Deal Builder — staff console</h1>
        <button style={S.btnGhost} disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <div style={S.configLine}>
        {data.deals.length} deal{data.deals.length === 1 ? "" : "s"} ·{" "}
        {data.dealers.length} dealer{data.dealers.length === 1 ? "" : "s"} · bid
        window {data.config.bidWindowHours}h · bands: fast{" "}
        {Math.round(data.config.bandTiers.fast[0] * 100)}–
        {Math.round(data.config.bandTiers.fast[1] * 100)}%, ordinary{" "}
        {Math.round(data.config.bandTiers.ordinary[0] * 100)}–
        {Math.round(data.config.bandTiers.ordinary[1] * 100)}% of retail
      </div>

      {err && <div style={S.err}>{err}</div>}

      {/* ================= mail mode ================= */}
      <section style={S.section}>
        <h2 style={S.h2}>Mail mode</h2>
        <div style={S.mailRow}>
          {MAIL_MODES.map((m) => (
            <button
              key={m.mode}
              disabled={busy || m.mode === data.config.mailMode}
              onClick={() => void act("set_mail_mode", { mode: m.mode })}
              style={{
                ...S.opt,
                ...(m.mode === data.config.mailMode ? S.optOn : {}),
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p style={S.sm}>{activeMode?.note}</p>
      </section>

      {/* ================= deals board ================= */}
      <section style={S.section}>
        <h2 style={S.h2}>Deals</h2>
        {groups.length === 0 && <p style={S.sm}>No deals yet.</p>}
        {groups.map((g) => (
          <div key={g.status}>
            <div style={S.groupHead}>
              <span style={{ ...S.pill, ...STATUS_PILL[g.status] }}>
                {STATUS_LABEL[g.status]}
              </span>
              <span style={S.groupCount}>{g.deals.length}</span>
            </div>
            {g.deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                busy={busy}
                note={notes[deal.id] ?? deal.marginNote}
                onNote={(v) => setNotes((n) => ({ ...n, [deal.id]: v }))}
                onApprove={() => approveDeal(deal)}
                onDecline={() => declineDeal(deal)}
                onMakeOffer={() => makeOffer(deal)}
                onPause={() => void act("pause_car", { dealId: deal.id })}
                onResume={() => void act("resume", { dealId: deal.id })}
                onExpire={() => void act("expire", { dealId: deal.id })}
                onRelist={() => void act("relist", { dealId: deal.id })}
                onMarkDeposit={(side) =>
                  void act("mark_deposit", { dealId: deal.id, side })
                }
                onComplete={() => completeDeal(deal)}
                onCollapse={(side) => collapseDeal(deal, side)}
                onResolveClaim={(resolution) =>
                  void act("resolve_cancellation", { dealId: deal.id, resolution })
                }
                adminKey={key}
              />
            ))}
          </div>
        ))}
      </section>

      {/* ================= dealers ================= */}
      <section style={S.section}>
        <h2 style={S.h2}>Dealers</h2>

        <div style={S.subHead}>
          Pending verification ({pendingDealers.length}) — silent checks first:
          Carzone stock, CRO record, VIES VAT
        </div>
        {pendingDealers.length === 0 && <p style={S.sm}>Nobody waiting.</p>}
        {pendingDealers.map((d) => (
          <div key={d.id} style={S.dealerRow}>
            <div style={S.dealerInfo}>
              <b>{d.name}</b>
              {d.banned && <span style={S.bannedPill}>BANNED</span>}
              <div style={S.smTight}>
                VAT {d.vat || "—"} · {d.email} · {d.county || "—"} · registered{" "}
                {when(d.createdAt)}
              </div>
              {d.takesTradeIns && (
                <div style={S.smTight}>Takes trade-ins: {d.takesTradeIns}</div>
              )}
              {d.vies && (
                <div
                  style={{
                    ...S.smTight,
                    fontWeight: 600,
                    color:
                      d.vies.valid === true
                        ? "#0a7d33"
                        : d.vies.valid === false
                          ? "#b60b0c"
                          : "#9a6a00",
                  }}
                >
                  {d.vies.valid === true
                    ? `VIES ✓ ${d.vies.name}${d.vies.address ? " — " + d.vies.address : ""}`
                    : d.vies.valid === false
                      ? "VIES: number does NOT validate"
                      : "VIES unavailable at registration — check manually"}
                  {d.vies.valid === true && namesShareNothing(d.name, d.vies.name) && (
                    <span style={{ color: "#9a6a00" }}>
                      {" "}— shares nothing with the trading name typed; ask why before approving
                    </span>
                  )}
                </div>
              )}
              {d.notes && <div style={S.smTight}>Notes: {d.notes}</div>}
            </div>
            <div style={S.dealerBtns}>
              {!d.banned && (
                <button
                  style={S.btn}
                  disabled={busy}
                  onClick={() => void act("approve_dealer", { dealerId: d.id })}
                >
                  Approve
                </button>
              )}
              {!d.banned && (
                <button
                  style={S.btnDanger}
                  disabled={busy}
                  onClick={() => banDealer(d)}
                >
                  Ban
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ ...S.subHead, marginTop: 18 }}>
          Approved ({approvedDealers.length})
        </div>
        {approvedDealers.length === 0 && <p style={S.sm}>None approved yet.</p>}
        {approvedDealers.map((d) => (
          <div key={d.id} style={S.dealerRow}>
            <div style={S.dealerInfo}>
              <b>{d.name}</b>
              {d.banned && <span style={S.bannedPill}>BANNED</span>}
              <div style={S.smTight}>
                VAT {d.vat || "—"} · {d.email} · {d.county || "—"} · approved{" "}
                {d.approvedAt ? when(d.approvedAt) : "—"}
                {d.creditEur ? <> · credit <b>{eur(d.creditEur)}</b></> : null}
              </div>
              {d.takesTradeIns && (
                <div style={S.smTight}>Takes trade-ins: {d.takesTradeIns}</div>
              )}
              {d.vies && (
                <div
                  style={{
                    ...S.smTight,
                    fontWeight: 600,
                    color:
                      d.vies.valid === true
                        ? "#0a7d33"
                        : d.vies.valid === false
                          ? "#b60b0c"
                          : "#9a6a00",
                  }}
                >
                  {d.vies.valid === true
                    ? `VIES ✓ ${d.vies.name}${d.vies.address ? " — " + d.vies.address : ""}`
                    : d.vies.valid === false
                      ? "VIES: number does NOT validate"
                      : "VIES unavailable at registration — check manually"}
                  {d.vies.valid === true && namesShareNothing(d.name, d.vies.name) && (
                    <span style={{ color: "#9a6a00" }}>
                      {" "}— shares nothing with the trading name typed; ask why before approving
                    </span>
                  )}
                </div>
              )}
              {d.notes && <div style={S.smTight}>Notes: {d.notes}</div>}
            </div>
            <div style={S.dealerBtns}>
              {!d.banned && (
                <button
                  style={S.btnGhost}
                  disabled={busy}
                  onClick={() => void copyPortalLink(d)}
                >
                  {copiedId === d.id ? "Copied ✓" : "Copy portal link"}
                </button>
              )}
              <button
                style={S.btnGhost}
                disabled={busy}
                onClick={() => rotateToken(d)}
              >
                Rotate token
              </button>
              {!d.banned && (
                <button
                  style={S.btnDanger}
                  disabled={busy}
                  onClick={() => banDealer(d)}
                >
                  Ban
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* ================= notifications ================= */}
      <section style={S.section}>
        <h2 style={S.h2}>Notifications (latest {data.notifications.length})</h2>
        {data.notifications.length === 0 && <p style={S.sm}>None yet.</p>}
        {data.notifications.map((n) => (
          <div key={n.id} style={S.ntfRow} title={n.body}>
            <div style={S.ntfTop}>
              <span style={S.ntfTime}>{when(n.at)}</span>
              <span style={{ ...S.audPill, ...AUD_PILL[n.audience] }}>
                {n.audience}
              </span>
              <span style={S.ntfKind}>{n.kind}</span>
              <span style={S.ntfSubject}>{n.subject}</span>
            </div>
            <div style={S.smTight}>
              for {n.intendedFor || "—"} ·{" "}
              {n.emailedTo ? `emailed to ${n.emailedTo}` : "not emailed (row only)"}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

// ---------- one deal card ----------

function DealCard({
  deal,
  busy,
  note,
  onNote,
  onApprove,
  onDecline,
  onMakeOffer,
  onPause,
  onResume,
  onExpire,
  onRelist,
  onMarkDeposit,
  onComplete,
  onCollapse,
  onResolveClaim,
  adminKey,
}: {
  deal: StaffDeal;
  busy: boolean;
  note: string;
  onNote: (v: string) => void;
  onApprove: () => void;
  onDecline: () => void;
  onMakeOffer: () => void;
  onPause: () => void;
  onResume: () => void;
  onExpire: () => void;
  onRelist: () => void;
  onMarkDeposit: (side: "buyer" | "dealer") => void;
  onComplete: () => void;
  onCollapse: (side: "dealer" | "buyer") => void;
  onResolveClaim: (resolution: "guarantee_applied" | "no_fault" | "dismissed") => void;
  adminKey: string;
}) {
  const t = deal.tradeIn;
  const v = deal.valuation;
  const s = deal.status;
  const winCredit =
    deal.bids.find((b) => b.id === deal.acceptedBidId)?.dealer?.creditEur ?? 0;

  const tradeTitle =
    [t.year ?? "", t.make, t.model].filter(Boolean).join(" ") || "(no car details)";
  const band =
    v.bandLowEur != null && v.bandHighEur != null
      ? `${eur(v.bandLowEur)}–${eur(v.bandHighEur)}`
      : "—";

  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <span>
          <b>{deal.id}</b>{" "}
          <span style={{ ...S.pill, ...STATUS_PILL[s] }}>{s}</span>
        </span>
        <span style={S.muted}>
          created {when(deal.createdAt)} · updated {when(deal.updatedAt)}
        </span>
      </div>

      {/* buyer — full identity, staff only */}
      <div style={S.line}>
        <span style={S.lab}>Buyer</span>
        <span>
          <b>{deal.buyer.name || "—"}</b> · {deal.buyer.email || "—"} ·{" "}
          {deal.buyer.phone || "—"} · {deal.buyer.eircode || "—"}
        </span>
      </div>

      {/* the signed sale declaration */}
      <div style={S.line}>
        <span style={S.lab}>Declaration</span>
        <span>
          {deal.declaration ? (
            <>
              {deal.declaration.kind === "owner"
                ? "Owns the car"
                : "Authorised by the registered owner"}{" "}
              — signed &ldquo;<b>{deal.declaration.signedName}</b>&rdquo;{" "}
              {when(deal.declaration.signedAt)}
              {deal.declaration.ip ? ` · ${deal.declaration.ip}` : ""}
            </>
          ) : (
            <span style={{ color: "#b60b0c", fontWeight: 700 }}>NOT SIGNED (pre-declaration deal)</span>
          )}
        </span>
      </div>

      {/* trade-in */}
      <div style={S.line}>
        <span style={S.lab}>Trade-in</span>
        <span>
          <b>
            {tradeTitle} ({t.reg || "no reg"})
          </b>{" "}
          ·{" "}
          {t.mileage != null
            ? `${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit}`
            : "mileage —"}{" "}
          · NCT {t.nct || "—"} · history {t.serviceHistory || "—"} · damage{" "}
          {t.damage || "—"}
          {t.damageNote ? ` (“${t.damageNote}”)` : ""} · finance{" "}
          {t.financeOutstanding === "yes"
            ? `outstanding, settle ${eur(t.settlementEur)}`
            : t.financeOutstanding === "no"
              ? "clear"
              : "—"}{" "}
          · lookup {t.lookupSource}
          {t.vrcHolder && t.vrcHolder !== "me" && (
            <>
              {" "}· VRC in {t.vrcHolder === "spouse" ? "spouse/partner" : "another"}{" "}
              name: <b>{t.vrcHolderName || "—"}</b>
              {t.ownerConsent ? " (consent confirmed)" : " (NO CONSENT TICKED)"}
            </>
          )}
          {t.adLink && (
            <>
              {" "}
              ·{" "}
              <a href={t.adLink} target="_blank" rel="noreferrer" style={S.link}>
                own ad
              </a>
            </>
          )}{" "}
          ·{" "}
          <a
            href={`/api/tradein-photo?draftId=${encodeURIComponent(deal.draftId)}`}
            target="_blank"
            rel="noreferrer"
            style={S.link}
          >
            photos ({deal.draftId})
          </a>{" "}
          ·{" "}
          <a
            href={`/api/tradein-photo?draftId=${encodeURIComponent(deal.draftId)}&slot=vlc_cert&key=${encodeURIComponent(adminKey)}`}
            target="_blank"
            rel="noreferrer"
            style={S.link}
          >
            VRC (staff only)
          </a>{" "}
          ·{" "}
          <a
            href={`/api/tradein-photo?draftId=${encodeURIComponent(deal.draftId)}&slot=owner_id&key=${encodeURIComponent(adminKey)}`}
            target="_blank"
            rel="noreferrer"
            style={S.link}
          >
            Owner ID (staff only)
          </a>{" "}
          ·{" "}
          {deal.vrcOnFile ? (
            <span style={{ color: "#0a7d33", fontWeight: 700 }}>VRC on file</span>
          ) : (
            <span style={{ color: "#b60b0c", fontWeight: 700 }}>VRC MISSING</span>
          )}{" "}
          ·{" "}
          {deal.idOnFile ? (
            <span style={{ color: "#0a7d33", fontWeight: 700 }}>
              ID on file — confirm the ID and VRC name match before approving
            </span>
          ) : (
            <span style={{ color: "#b60b0c", fontWeight: 700 }}>ID MISSING</span>
          )}
        </span>
      </div>

      {/* wanted car — the all-in price is the only price that exists */}
      <div style={S.line}>
        <span style={S.lab}>Wanted</span>
        <span>
          <b>{deal.wanted.title || "—"}</b>
          {deal.wanted.detail ? ` · ${deal.wanted.detail}` : ""} · all-in{" "}
          <b>{eur(deal.wanted.landedEur)}</b>
          {deal.wanted.carId ? ` · car ${deal.wanted.carId}` : ""}
          {deal.wantFinanceQuotes ? " · wants finance quotes" : ""}
        </span>
      </div>

      {/* valuation + target */}
      <div style={S.line}>
        <span style={S.lab}>Valuation</span>
        <span>
          estimate <b>{eur(v.estimateEur)}</b> · band {band} · {v.comparables}{" "}
          comparable{v.comparables === 1 ? "" : "s"} ({v.segment || "no segment"})
          {v.note ? ` · ${v.note}` : ""} · buyer target:{" "}
          {deal.targetEur ? <b>{eur(deal.targetEur)}</b> : "none — dealers just bid"}
        </span>
      </div>

      {/* the customer saw these ranges; the model's placing is STAFF-ONLY */}
      {(deal.ranges || deal.suggestion || deal.offer) && (
        <div style={S.line}>
          <span style={S.lab}>Offer</span>
          <span>
            {deal.ranges?.trade ? `shown: trade ${eur(deal.ranges.trade.lowEur)}–${eur(deal.ranges.trade.highEur)}` : ""}
            {deal.ranges?.private ? `, private ${eur(deal.ranges.private.lowEur)}–${eur(deal.ranges.private.highEur)}` : ""}
            {deal.suggestion
              ? ` · model suggests ${eur(deal.suggestion.eur)}${
                  deal.suggestion.deductions.length
                    ? ` (${deal.suggestion.deductions.map((d) => `${d.label} ${d.eur < 0 ? "+" : "−"}${eur(Math.abs(d.eur))}`).join(", ")})`
                    : " (perfect-car answers)"
                } — not shown to the customer`
              : ""}
            {deal.offer ? (
              <>
                {" "}· <b>OFFERED {eur(deal.offer.eur)}</b> {when(deal.offer.madeAt)}
                {deal.offer.note ? ` — “${deal.offer.note}”` : ""}
              </>
            ) : deal.tradeIn.route === "tradein" ? " · no offer made yet" : ""}
          </span>
        </div>
      )}

      {/* bids with full dealer names */}
      <div style={S.line}>
        <span style={S.lab}>Bids</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          {deal.bids.length === 0 && <span style={S.muted}>none yet</span>}
          {deal.bids.map((b) => (
            <span
              key={b.id}
              style={{
                ...S.bidLine,
                ...(deal.acceptedBidId === b.id ? S.bidAccepted : {}),
              }}
            >
              <b>{b.dealer ? b.dealer.name : "unknown dealer"}</b>
              {b.dealer?.county ? ` (${b.dealer.county})` : ""} —{" "}
              <b>{eur(b.allowanceEur)}</b>{" "}
              {b.atUkciPrice
                ? "at the shown all-in price"
                : `at adjusted total ${eur(b.adjustedTotalEur)}`}
              {b.conditions ? ` · “${b.conditions}”` : ""} · {b.status}
              {deal.acceptedBidId === b.id ? " · ACCEPTED" : ""} ·{" "}
              {when(b.placedAt)}
            </span>
          ))}
          {deal.bids.length > 0 && (
            <span style={S.inspect}>
              All bid figures are indicative — subject to physical inspection.
            </span>
          )}
        </span>
      </div>

      {/* deposit gate */}
      {(s === "accepted" || s === "matched") && (
        <div style={S.line}>
          <span style={S.lab}>Deposits</span>
          <span>
            buyer {deal.buyerDepositPaid ? "✓ paid" : "— not marked"} · dealer
            fee {deal.dealerDepositPaid ? "✓ taken" : "— not marked"}
            {winCredit > 0 && <> · dealer holds {eur(winCredit)} credit toward this fee</>}
            {s === "accepted" &&
              " · when both are marked the deal goes to matched and identities are revealed automatically"}
          </span>
        </div>
      )}

      {/* renegotiation at inspection */}
      {deal.renegotiation && (
        <div style={S.line}>
          <span style={S.lab}>Adjustment</span>
          <span>
            {eur(deal.renegotiation.originalAllowanceEur)} &rarr;{" "}
            <b>{eur(deal.renegotiation.allowanceEur)}</b> ·{" "}
            {deal.renegotiation.status} · &ldquo;{deal.renegotiation.note}&rdquo;
          </span>
        </div>
      )}

      {/* cancellations / description-guarantee claims */}
      {(deal.cancellations ?? []).length > 0 && (
        <div style={S.line}>
          <span style={S.lab}>Cancelled</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            {(deal.cancellations ?? []).map((c, i) => (
              <span key={i} style={S.bidLine}>
                {when(c.at)} · by {c.by} · <b>{c.category}</b>
                {c.checklistItems.length
                  ? ` (${c.checklistItems.map((x) => x.replace(/_/g, " ")).join(", ")})`
                  : ""}
                {" — "}&ldquo;{c.detail}&rdquo;
                {c.category === "misdescription" && (
                  <>
                    {" "}· buyer: {c.buyerResponse || "no answer yet (48h)"} ·
                    resolution: <b>{c.resolution || "OPEN"}</b>
                    {c.vrmWatchUntil
                      ? ` · reg watched to ${c.vrmWatchUntil.slice(0, 10)}`
                      : ""}
                  </>
                )}
              </span>
            ))}
            {(deal.cancellations ?? []).some(
              (c) => c.category === "misdescription" && !c.resolution,
            ) && (
              <span style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  style={S.btn}
                  disabled={busy}
                  onClick={() => onResolveClaim("guarantee_applied")}
                >
                  Uphold — refund dealer next day (&euro;500 through + &euro;400 credit)
                </button>
                <button
                  style={S.btnGhost}
                  disabled={busy}
                  onClick={() => onResolveClaim("no_fault")}
                >
                  No fault — no penalty, relist
                </button>
                <button
                  style={S.btnDanger}
                  disabled={busy}
                  onClick={() => onResolveClaim("dismissed")}
                >
                  Dismiss claim
                </button>
              </span>
            )}
          </span>
        </div>
      )}

      {/* margin note — editable pre-approval, applied by approve_deal */}
      {s === "submitted" ? (
        <div style={S.line}>
          <span style={S.lab}>Margin note</span>
          <input
            style={S.noteInput}
            value={note}
            placeholder="per-deal margin note, saved on approval — never a fixed rule"
            onChange={(e) => onNote(e.target.value)}
          />
        </div>
      ) : (
        deal.marginNote && (
          <div style={S.line}>
            <span style={S.lab}>Margin note</span>
            <span>{deal.marginNote}</span>
          </div>
        )
      )}

      {deal.staffNote && (
        <div style={S.line}>
          <span style={S.lab}>Staff note</span>
          <span>{deal.staffNote}</span>
        </div>
      )}

      {/* recent history */}
      {deal.history.length > 0 && (
        <div style={S.line}>
          <span style={S.lab}>History</span>
          <span style={S.muted}>
            {deal.history
              .slice(-3)
              .map((h) => `${when(h.at)} ${h.event}${h.detail ? ` (${h.detail})` : ""}`)
              .join(" · ")}
          </span>
        </div>
      )}

      {/* ONLY the actions legal for this status */}
      <div style={S.actions}>
        {deal.tradeIn.route === "tradein" && (s === "submitted" || s === "live" || s === "paused_car") && (
          <button style={S.btn} disabled={busy} onClick={onMakeOffer}>
            {deal.offer ? "Re-make offer…" : "Make offer…"}
          </button>
        )}
        {s === "submitted" && (
          <>
            <button style={S.btn} disabled={busy} onClick={onApprove}>
              Approve → live
            </button>
            <button style={S.btnDanger} disabled={busy} onClick={onDecline}>
              Decline…
            </button>
          </>
        )}
        {s === "live" && (
          <>
            <button style={S.btnGhost} disabled={busy} onClick={onPause}>
              Pause — car gone
            </button>
            <button style={S.btnGhost} disabled={busy} onClick={onExpire}>
              Expire
            </button>
            <button style={S.btnDanger} disabled={busy} onClick={onDecline}>
              Decline…
            </button>
          </>
        )}
        {s === "paused_car" && (
          <>
            <button style={S.btn} disabled={busy} onClick={onResume}>
              Resume → live
            </button>
            <button style={S.btnGhost} disabled={busy} onClick={onExpire}>
              Expire
            </button>
          </>
        )}
        {s === "accepted" && (
          <>
            {!deal.buyerDepositPaid && (
              <button
                style={S.btn}
                disabled={busy}
                onClick={() => onMarkDeposit("buyer")}
              >
                Mark buyer deposit
              </button>
            )}
            {!deal.dealerDepositPaid && (
              <button
                style={S.btn}
                disabled={busy}
                onClick={() => onMarkDeposit("dealer")}
              >
                Mark dealer deposit
              </button>
            )}
            <button
              style={S.btnDanger}
              disabled={busy}
              onClick={() => onCollapse("dealer")}
            >
              Collapse — dealer walked…
            </button>
            <button
              style={S.btnDanger}
              disabled={busy}
              onClick={() => onCollapse("buyer")}
            >
              Collapse — buyer walked…
            </button>
          </>
        )}
        {s === "matched" && (
          <>
            <button style={S.btn} disabled={busy} onClick={onComplete}>
              Complete — handover done
            </button>
            <button
              style={S.btnDanger}
              disabled={busy}
              onClick={() => onCollapse("dealer")}
            >
              Collapse — dealer walked…
            </button>
            <button
              style={S.btnDanger}
              disabled={busy}
              onClick={() => onCollapse("buyer")}
            >
              Collapse — buyer walked…
            </button>
          </>
        )}
        {(s === "expired" || s === "collapsed_dealer") && (
          <button style={S.btn} disabled={busy} onClick={onRelist}>
            Relist → live
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- styles ----------

const AUD_PILL: Record<Notification["audience"], CSSProperties> = {
  staff: { background: "#1a1a1a", color: "#fff" },
  dealer: { background: "#e8f0fb", color: "#1a5fb4" },
  buyer: { background: "#eef4ee", color: "#0a7d33" },
};

const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "22px 16px 60px",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "#1a1a1a",
  },
  banner: {
    background: "#fff8e6",
    border: "1px solid #f0dfae",
    color: "#9a6a00",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    padding: "7px 12px",
    borderRadius: 6,
    marginBottom: 18,
  },
  headRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  h1: { fontSize: 26, margin: "0 0 4px", letterSpacing: "-.5px" },
  h2: {
    fontSize: 16,
    margin: "0 0 10px",
    letterSpacing: "-.2px",
    borderBottom: "1px solid #e6e6e6",
    paddingBottom: 6,
  },
  configLine: { fontSize: 12, color: "#777", margin: "2px 0 14px" },
  section: { marginTop: 26 },
  subHead: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: ".05em",
    textTransform: "uppercase",
    color: "#666",
    margin: "0 0 8px",
  },
  err: {
    border: "1px solid #e8c9c9",
    background: "#fdf7f7",
    color: "#b60b0c",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    margin: "10px 0",
    fontWeight: 600,
  },
  sm: { fontSize: 12.5, color: "#6a6a6a", lineHeight: 1.55, marginTop: 6 },
  smTight: { fontSize: 12, color: "#6a6a6a", lineHeight: 1.5, marginTop: 2 },
  muted: { fontSize: 11.5, color: "#888" },
  link: { color: "#1a5fb4", textDecoration: "underline" },

  groupHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "16px 0 8px",
  },
  groupCount: { fontSize: 12, fontWeight: 700, color: "#888" },
  pill: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".04em",
    padding: "2px 9px",
    borderRadius: 999,
    textTransform: "uppercase",
  },

  card: {
    border: "1px solid #dcdcdc",
    borderRadius: 8,
    background: "#fff",
    padding: "10px 14px 12px",
    marginBottom: 10,
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
    borderBottom: "1px solid #f0f0f0",
    paddingBottom: 6,
    marginBottom: 6,
    fontSize: 13,
  },
  line: {
    display: "flex",
    gap: 10,
    fontSize: 12.5,
    lineHeight: 1.55,
    padding: "3px 0",
    alignItems: "baseline",
  },
  lab: {
    flex: "0 0 78px",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    color: "#8a8a8a",
  },
  bidLine: {
    display: "block",
    padding: "2px 0",
    borderBottom: "1px solid #f4f4f4",
  },
  bidAccepted: { background: "#f4faf5" },
  inspect: {
    display: "block",
    fontSize: 11.5,
    color: "#9a6a00",
    marginTop: 3,
  },
  noteInput: {
    flex: 1,
    minWidth: 0,
    border: "1px solid #ccc",
    borderRadius: 5,
    padding: "6px 9px",
    fontSize: 12.5,
    fontFamily: "inherit",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
    borderTop: "1px solid #f0f0f0",
    paddingTop: 9,
  },

  btn: {
    background: "#b60b0c",
    color: "#fff",
    border: "1px solid #b60b0c",
    borderRadius: 6,
    padding: "6px 13px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnGhost: {
    background: "#fff",
    color: "#1a1a1a",
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: "6px 13px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDanger: {
    background: "#fff",
    color: "#b60b0c",
    border: "1px solid #e0b4b4",
    borderRadius: 6,
    padding: "6px 13px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  opt: {
    border: "1px solid #ccc",
    background: "#fff",
    borderRadius: 999,
    padding: "6px 15px",
    fontSize: 12.5,
    cursor: "pointer",
  },
  optOn: {
    background: "#1a1a1a",
    color: "#fff",
    borderColor: "#1a1a1a",
    fontWeight: 700,
    cursor: "default",
  },
  mailRow: { display: "flex", gap: 8, flexWrap: "wrap" },

  dealerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    border: "1px solid #e6e6e6",
    borderRadius: 8,
    background: "#fff",
    padding: "9px 13px",
    marginBottom: 8,
    fontSize: 13,
  },
  dealerInfo: { minWidth: 0, flex: "1 1 300px" },
  dealerBtns: { display: "flex", gap: 7, flexWrap: "wrap" },
  bannedPill: {
    display: "inline-block",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".05em",
    padding: "1px 8px",
    borderRadius: 999,
    background: "#fdf0f0",
    color: "#b60b0c",
    marginLeft: 8,
  },

  ntfRow: {
    borderBottom: "1px solid #f0f0f0",
    padding: "6px 0",
    fontSize: 12.5,
  },
  ntfTop: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  ntfTime: { fontSize: 11.5, color: "#888", flex: "0 0 auto" },
  audPill: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".05em",
    padding: "1px 8px",
    borderRadius: 999,
    textTransform: "uppercase",
  },
  ntfKind: { fontSize: 11.5, fontWeight: 700, color: "#555" },
  ntfSubject: { fontWeight: 600 },
};
