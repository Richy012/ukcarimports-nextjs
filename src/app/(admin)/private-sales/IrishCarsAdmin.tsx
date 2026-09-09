"use client";

/**
 * Irish cars — the Above Board Cars listings, inside the staff admin.
 *
 * Owner, 9 Sep 2026: he found a private-sale car advertised on the homepage
 * with no photos, and nothing in admin that registered it existed. This is
 * that screen. It answers one question per car, at a glance:
 *
 *   IS IT ON THE SITE, AND IF NOT, WHY NOT?
 *
 * Three separate things have to be true before the public sees a car, so all
 * three are shown separately rather than as one opaque "status":
 *   1. the deal is at a live stage (staff approval — the auction status)
 *   2. the listing is COMPLETE (>= 4 photos, year, make, model, mileage, price)
 *   3. staff have not pulled it off the site by hand
 *
 * "Pull off site" is deliberately not a status change: the deal keeps running,
 * the advert stops.
 */

import { useCallback, useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";

const eur = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

interface Listing {
  id: string;
  draftId: string;
  dealStatus: string;
  createdAt: string;
  title: string;
  mileage: number | null;
  mileageUnit: string;
  priceEur: number | null;
  area: string;
  nct: string;
  serviceHistory: string;
  damage: string;
  photos: string[];
  photoCount: number;
  complete: boolean;
  missing: string[];
  statusLive: boolean;
  hidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  advertised: boolean;
  seller: { name: string; email: string; phone: string; eircode: string };
}

export default function IrishCarsAdmin() {
  const [list, setList] = useState<Listing[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/staff-irish-cars", { headers: staffAuthHeaders(), cache: "no-store" });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error || "Could not load.");
        return;
      }
      setErr("");
      setList(j.listings as Listing[]);
    } catch {
      setErr("Could not load.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setHidden(id: string, hidden: boolean) {
    const reason = hidden ? window.prompt("Why is it coming off the site? (staff note, optional)") ?? "" : "";
    setBusy(id);
    try {
      const r = await fetch("/api/staff-irish-cars", {
        method: "POST",
        headers: { ...staffAuthHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ id, hidden, reason }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || "That did not work.");
      else setList(j.listings as Listing[]);
    } catch {
      setErr("That did not work.");
    } finally {
      setBusy("");
    }
  }

  const live = list?.filter((l) => l.advertised).length ?? 0;

  return (
    <main style={S.wrap}>
      <h1 style={S.h1}>Irish cars</h1>
      <p style={S.sub}>
        Every Above Board Cars private sale we hold. A car reaches the homepage and{" "}
        <a href="/irish-cars">the public list</a> only when all three are green: the deal is at a live
        stage, the listing is complete (at least 4 photos plus year, make, model, mileage and price),
        and nobody has pulled it off the site. Pulling a car off does <b>not</b> stop the deal.
      </p>
      <p style={S.count}>
        {list === null ? "Loading…" : `${live} on the site · ${list.length} in total`}
      </p>
      {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
      {list && list.length === 0 && <p>No private sales yet.</p>}

      {list?.map((l) => (
        <section key={l.id} style={{ ...S.card, ...(l.advertised ? S.cardLive : {}) }}>
          <div style={S.row}>
            <div>
              <div style={S.title}>
                {l.title || "(no car details)"}
                <span style={{ ...S.pill, ...(l.advertised ? S.pillGood : S.pillBad) }}>
                  {l.advertised ? "ON THE SITE" : "NOT ON THE SITE"}
                </span>
              </div>
              <div style={S.meta}>
                {l.mileage != null ? `${l.mileage.toLocaleString("en-IE")} ${l.mileageUnit}` : "no mileage"}
                {l.area ? ` · ${l.area}` : ""} · {new Date(l.createdAt).toLocaleString("en-IE")} · deal {l.dealStatus}
              </div>
            </div>
            <div style={S.priceBox}>
              <div style={S.lbl}>asking price</div>
              <div style={S.priceVal}>{eur(l.priceEur)}</div>
            </div>
          </div>

          <div style={S.checks}>
            <span style={{ ...S.check, ...(l.statusLive ? S.ok : S.no) }}>
              {l.statusLive ? "✓" : "✕"} deal live ({l.dealStatus})
            </span>
            <span style={{ ...S.check, ...(l.complete ? S.ok : S.no) }}>
              {l.complete ? "✓" : "✕"} complete
              {l.missing.length ? `: missing ${l.missing.join(", ")}` : ""}
            </span>
            <span style={{ ...S.check, ...(l.hidden ? S.no : S.ok) }}>
              {l.hidden ? `✕ pulled by staff${l.hiddenReason ? ` — ${l.hiddenReason}` : ""}` : "✓ not pulled"}
            </span>
          </div>

          <div style={S.grid}>
            <div style={S.box}>
              <div style={S.lbl}>Photos ({l.photoCount})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {l.photos.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" style={S.thumb} src={src} />
                  </a>
                ))}
                {l.photoCount === 0 && <span style={S.small}>none uploaded</span>}
              </div>
            </div>
            <div style={S.box}>
              <div style={S.lbl}>Answers</div>
              <div style={S.small}>
                NCT: {l.nct || "—"} · history: {l.serviceHistory || "—"} · damage: {l.damage || "—"}
              </div>
            </div>
            <div style={S.box}>
              <div style={S.lbl}>Seller (never public)</div>
              <div style={S.small}>
                {l.seller.name || "—"}
                <br />
                {l.seller.email}
                <br />
                {l.seller.phone}
              </div>
            </div>
          </div>

          <div style={S.actions}>
            {l.hidden ? (
              <button type="button" style={S.btnPrimary} disabled={busy === l.id} onClick={() => setHidden(l.id, false)}>
                {busy === l.id ? "Working…" : "Put back on the site"}
              </button>
            ) : (
              <button type="button" style={S.btnDanger} disabled={busy === l.id} onClick={() => setHidden(l.id, true)}>
                {busy === l.id ? "Working…" : "Pull off the site"}
              </button>
            )}
            {l.advertised && (
              <a style={S.btnGhost} href={`/irish-cars/${l.id}`} target="_blank" rel="noreferrer">
                View the public page
              </a>
            )}
            <a style={S.btnGhost} href="/tradeins">
              The submission
            </a>
          </div>
        </section>
      ))}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 1100, padding: "8px 0 40px" },
  h1: { fontSize: 26, margin: "0 0 6px" },
  sub: { color: "#475569", fontSize: 14, margin: "0 0 10px", lineHeight: 1.5 },
  count: { fontSize: 13, color: "#0f172a", fontWeight: 700, margin: "0 0 16px" },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, margin: "0 0 16px", background: "#fff" },
  cardLive: { borderColor: "#86efac", boxShadow: "inset 3px 0 0 #16a34a" },
  row: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
  title: { fontSize: 19, fontWeight: 700 },
  meta: { fontSize: 13, color: "#475569", marginTop: 4 },
  pill: { display: "inline-block", marginLeft: 10, padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, verticalAlign: "middle", letterSpacing: ".03em" },
  pillGood: { background: "#dcfce7", color: "#166534" },
  pillBad: { background: "#fee2e2", color: "#991b1b" },
  priceBox: { textAlign: "right", minWidth: 140 },
  priceVal: { fontSize: 24, fontWeight: 800 },
  checks: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  check: { fontSize: 12.5, padding: "4px 10px", borderRadius: 8, fontWeight: 600 },
  ok: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
  no: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 12 },
  box: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" },
  lbl: { fontSize: 11.5, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em" },
  small: { fontSize: 12.5, color: "#475569", marginTop: 2, lineHeight: 1.5 },
  thumb: { width: 72, height: 54, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" },
  actions: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" },
  btnPrimary: { background: "#16a34a", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  btnDanger: { background: "#b60b0c", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  btnGhost: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 14px", fontWeight: 600, color: "#0f172a", textDecoration: "none", fontSize: 14 },
};
