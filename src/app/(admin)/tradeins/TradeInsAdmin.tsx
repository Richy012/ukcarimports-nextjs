"use client";

/**
 * Trade-ins — the STAFF list, inside the admin dashboard. Staging.
 *
 * Owner, 6 Sep: "it's a trade in, not yet part of a deal being offered" and
 * "I am signed in as a staff member". A submitted trade-in is a car waiting
 * for HIS number; it belongs beside Cars, Leads and Deposits, behind the same
 * staff login, not under a key URL on the dealer admin. This lists every
 * submission newest first with exactly what pricing it by hand needs:
 *
 *   the car as declared (reg, make, model, year, mileage, spec if picked)
 *   both ranges the customer was shown, and which line is the offer
 *   the floor line (incl. lots that failed to sell) — staff only
 *   the review flag when the spec sits far from its segment
 *   the answers and disclosures, the photos, the customer
 *
 * Approving a deal to dealers still happens on the deal-builder admin —
 * this page prices the trade-in, it does not run the auction.
 */

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";

const eur = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

interface Deal {
  id: string;
  status: string;
  createdAt: string;
  draftId: string;
  buyer?: { name?: string; email?: string; phone?: string; eircode?: string };
  tradeIn: {
    reg?: string; make?: string; model?: string; year?: number | null;
    mileage?: number | null; mileageUnit?: string; route?: string;
    nct?: string; serviceHistory?: string; damage?: string; damageNote?: string;
    financeOutstanding?: string; settlementEur?: number;
    disclosures?: Record<string, string>;
    vrcHolder?: string; vrcHolderName?: string;
  };
  valuation: {
    estimateEur?: number | null; comparables?: number; segment?: string;
    bandLowEur?: number | null; bandHighEur?: number | null;
    floorLowEur?: number | null; floorHighEur?: number | null;
    tradePctSold?: number; tradePctFloor?: number; tradeBasis?: string;
    tradeObservations?: number; trimApplied?: string;
    trimNeedsReview?: boolean; note?: string;
  };
  offer?: { eur?: number } | null;
}
interface Slot { slot: string; takenAt: string }

export default function TradeInsAdmin() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [err, setErr] = useState("");
  const [photos, setPhotos] = useState<Record<string, Slot[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/staff-tradeins", { headers: staffAuthHeaders(), cache: "no-store" });
        const j = await r.json();
        if (!j.ok) { setErr(j.error || "Could not load."); return; }
        const list = j.deals as Deal[];
        setDeals(list);
        const out: Record<string, Slot[]> = {};
        await Promise.all(list.map(async (d) => {
          try {
            const p = await fetch(`/api/tradein-photo?draftId=${encodeURIComponent(d.draftId)}`);
            const pj = await p.json();
            out[d.id] = (pj.slots || []).filter((s: Slot) => !/^(vlc_cert|owner_id)$/.test(s.slot));
          } catch { out[d.id] = []; }
        }));
        setPhotos(out);
      } catch { setErr("Could not load."); }
    })();
  }, []);

  return (
    <main style={S.wrap}>
      <h1 style={S.h1}>Trade-ins</h1>
      <p style={S.sub}>
        Every submission, newest first. The customer saw both ranges; the <b>offer</b> is the bottom
        of the trade range. Confirm it from the photos and answers. If it is going to dealers, approve it
        on the <a href="/deal-builder/admin">deal-builder admin</a>.
      </p>
      {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
      {deals && deals.length === 0 && <p>No trade-ins yet.</p>}
      {deals && deals.map((d) => {
        const t = d.tradeIn || {}; const v = d.valuation || {};
        const km = t.mileage != null ? `${t.mileage.toLocaleString("en-IE")} ${t.mileageUnit || "km"}` : null;
        const ph = photos[d.id] || [];
        return (
          <section key={d.id} style={S.card}>
            <div style={S.row}>
              <div>
                <div style={S.title}>
                  {t.year ? `${t.year} ` : ""}{t.make} {t.model}
                  {v.trimApplied ? <span style={S.pill}>{v.trimApplied}</span> : null}
                  {v.trimNeedsReview ? <span style={{ ...S.pill, ...S.pillWarn }}>spec far from segment — check</span> : null}
                </div>
                <div style={S.meta}>
                  {t.reg} · {km ?? <b style={{ color: "#b91c1c" }}>NO MILEAGE — engine could not run, band below is the old assumed tier</b>}
                  {" · "}{t.route === "privateproof" ? "wants to sell privately" : "wants to trade in"}
                  {" · "}{new Date(d.createdAt).toLocaleString("en-IE")} · {d.status}
                </div>
              </div>
              <div style={S.offerBox}>
                <div style={S.offerLbl}>offer (bottom of trade range)</div>
                <div style={S.offerVal}>{eur(d.offer?.eur ?? v.bandLowEur)}</div>
              </div>
            </div>

            <div style={S.grid}>
              <div style={S.box}>
                <div style={S.lbl}>Irish dealer price (segment)</div>
                <div style={S.val}>{eur(v.estimateEur)}</div>
                <div style={S.small}>{v.comparables ?? 0} Irish ads · {v.segment}</div>
              </div>
              <div style={S.box}>
                <div style={S.lbl}>Trade range shown to customer</div>
                <div style={S.val}>{eur(v.bandLowEur)} – {eur(v.bandHighEur)}</div>
                <div style={S.small}>
                  {v.tradePctSold != null
                    ? `${v.tradePctSold}% of retail · ${v.tradeObservations ?? 0} real trade sales · ${v.tradeBasis}`
                    : "assumed tier (no mileage)"}
                </div>
              </div>
              <div style={S.box}>
                <div style={S.lbl}>Floor line (incl. unsold lots) — staff only</div>
                <div style={S.val}>{v.floorLowEur != null ? `${eur(v.floorLowEur)} – ${eur(v.floorHighEur)}` : "—"}</div>
                <div style={S.small}>{v.tradePctFloor != null ? `${v.tradePctFloor}% of retail` : ""}</div>
              </div>
            </div>

            <div style={S.grid}>
              <div style={S.box}>
                <div style={S.lbl}>Answers</div>
                <div style={S.small}>
                  finance: {t.financeOutstanding || "—"}{t.settlementEur ? ` (${eur(t.settlementEur)} to settle)` : ""} ·
                  NCT: {t.nct || "—"} · history: {t.serviceHistory || "—"} · damage: {t.damage || "—"}
                  {t.damageNote ? ` — "${t.damageNote}"` : ""}
                  {t.vrcHolder ? ` · VRC held by ${t.vrcHolder}${t.vrcHolderName ? ` (${t.vrcHolderName})` : ""}` : ""}
                </div>
                {t.disclosures && (
                  <div style={{ ...S.small, marginTop: 6 }}>
                    {Object.entries(t.disclosures).map(([k, val]) => (
                      <span key={k} style={{ ...S.chip, ...(val === "yes" ? {} : S.chipNo) }}>{k.replace(/_/g, " ")}: {val}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={S.box}>
                <div style={S.lbl}>Photos ({ph.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ph.map((s) => (
                    <a key={s.slot} href={`/api/tradein-photo?draftId=${encodeURIComponent(d.draftId)}&slot=${encodeURIComponent(s.slot)}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={s.slot} title={s.slot} style={S.thumb}
                           src={`/api/tradein-photo?draftId=${encodeURIComponent(d.draftId)}&slot=${encodeURIComponent(s.slot)}`} />
                    </a>
                  ))}
                  {ph.length === 0 && <span style={S.small}>none uploaded</span>}
                </div>
              </div>
              <div style={S.box}>
                <div style={S.lbl}>Customer</div>
                <div style={S.small}>{d.buyer?.name || "—"}<br />{d.buyer?.email || ""}<br />{d.buyer?.phone || ""}</div>
              </div>
            </div>
            {v.note && <div style={{ ...S.small, marginTop: 8, color: "#64748b" }}>{v.note}</div>}
          </section>
        );
      })}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 1100, padding: "8px 0 40px" },
  h1: { fontSize: 26, margin: "0 0 6px" },
  sub: { color: "#475569", fontSize: 14, margin: "0 0 18px", lineHeight: 1.5 },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, margin: "0 0 16px", background: "#fff" },
  row: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
  title: { fontSize: 19, fontWeight: 700 },
  meta: { fontSize: 13, color: "#475569", marginTop: 4 },
  pill: { display: "inline-block", marginLeft: 8, padding: "2px 8px", borderRadius: 999, fontSize: 12, background: "#eef2ff", color: "#3730a3", verticalAlign: "middle" },
  pillWarn: { background: "#fff7ed", color: "#9a3412" },
  offerBox: { textAlign: "right", minWidth: 180 },
  offerLbl: { fontSize: 11.5, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em" },
  offerVal: { fontSize: 28, fontWeight: 800, color: "#0a7d33" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginTop: 12 },
  box: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" },
  lbl: { fontSize: 11.5, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em" },
  val: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  small: { fontSize: 12.5, color: "#475569", marginTop: 2, lineHeight: 1.5 },
  chip: { display: "inline-block", margin: "2px 4px 2px 0", padding: "1px 7px", borderRadius: 999, background: "#e2e8f0", fontSize: 11.5 },
  chipNo: { background: "#fee2e2" },
  thumb: { width: 72, height: 54, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" },
};
