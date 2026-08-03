"use client";

import { useCallback, useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

/**
 * Two ways in, because "show me the segments" should not need three clicks:
 *   - All segments: every make+model+year in one searchable table.
 *   - Browse: make -> model -> year -> individual cars.
 *
 * Irish medians come from the weekly snapshot; our prices and every saving are
 * computed live per request, so a sold car leaves the view at once and a price
 * change shows immediately.
 *
 * Bestseller = EUR 2,500+ under the Irish median. #1 Bestseller = EUR 5,000+.
 */

interface Row {
  label: string;
  mk?: string;
  md?: string;
  yr?: number;
  live_cars: number;
  irish_ads: number;
  our_avg_price: number | null;
  irish_avg_median: number | null;
  avg_saving: number | null;
  flyers: number;
  rare_flyers: number;
  evidence: "verified" | "trend" | "thin";
}

interface Car {
  car_id: string;
  car_name: string;
  plain_mileage: number | null;
  our_price: number;
  irish_median: number;
  saving: number;
}

interface IrishListing {
  version: string | null;
  mileage_km: number | null;
  price_eur: string | null;
  county: string | null;
}

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `€${Math.round(Number(n)).toLocaleString()}`;
const title = (s: string) => String(s).replace(/\b[a-z]/g, (c) => c.toUpperCase());

export default function SegmentsExplorer() {
  const [mode, setMode] = useState<"flat" | "browse">("flat");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [irish, setIrish] = useState<IrishListing[]>([]);
  const [level, setLevel] = useState("flat");
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>("flyers");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (mode === "flat") {
      qs.set("flat", "1");
      if (search) qs.set("search", search);
    } else {
      if (make) qs.set("make", make);
      if (model) qs.set("model", model);
      if (year) qs.set("year", String(year));
    }
    fetch(`/api/staff-segments?${qs.toString()}`, { headers: staffAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const data = d?.data ?? {};
        setLevel(data.level ?? "flat");
        setRows(data.rows ?? []);
        setCars(data.cars ?? []);
        setIrish(data.irish_listings ?? []);
        if (data.snapshot_date) setSnapshot(data.snapshot_date);
      })
      .finally(() => setLoading(false));
  }, [mode, make, model, year, search]);

  useEffect(load, [load]);

  const openSegment = (r: Row) => {
    setMode("browse");
    setMake(r.mk ?? "");
    setModel(r.md ?? "");
    setYear(Number(r.yr ?? 0));
  };

  const drill = (label: string) => {
    if (level === "makes") setMake(label);
    else if (level === "models") setModel(label);
    else if (level === "years") setYear(Number(label));
  };

  const sortBy = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir(key === "label" ? "asc" : "desc");
    }
  };

  // Client-side: the flat list is capped at 2,000 rows, so sorting in the
  // browser is instant and avoids a round trip per click.
  const EVIDENCE_RANK: Record<string, number> = { verified: 3, trend: 2, thin: 1 };
  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    let av: number | string;
    let bv: number | string;
    if (sortKey === "label") {
      av = String(a.label);
      bv = String(b.label);
      return av.localeCompare(bv) * dir;
    }
    if (sortKey === "evidence") {
      av = EVIDENCE_RANK[a.evidence] ?? 0;
      bv = EVIDENCE_RANK[b.evidence] ?? 0;
    } else {
      av = Number((a as unknown as Record<string, number>)[sortKey] ?? 0);
      bv = Number((b as unknown as Record<string, number>)[sortKey] ?? 0);
    }
    return (Number(av) - Number(bv)) * dir;
  });

  const th = (key: string, label: string) => (
    <th className={styles.sortable} onClick={() => sortBy(key)}>
      {label}
      <span className={styles.sortArrow}>
        {sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : ""}
      </span>
    </th>
  );

  const trend = (v: number | null) =>
    Number(v) > 0
      ? <span className={styles.good}>UK cheaper by {eur(v)}</span>
      : <span className={styles.bad}>Irish cheaper by {eur(Math.abs(Number(v)))}</span>;

  const badge = (e: string) => (
    <span className={e === "verified" ? styles.badgeVerified : e === "trend" ? styles.badgeTrend : styles.badgeThin}>
      {e}
    </span>
  );

  return (
    <>
      <div className={styles.segModeRow}>
        <button type="button" className={mode === "flat" ? styles.tabActive : styles.tab}
          onClick={() => { setMode("flat"); setMake(""); setModel(""); setYear(0); }}>
          All segments
        </button>
        <button type="button" className={mode === "browse" ? styles.tabActive : styles.tab}
          onClick={() => { setMode("browse"); setMake(""); setModel(""); setYear(0); }}>
          Browse by make
        </button>
        {mode === "flat" && (
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchDraft); }} className={styles.segSearch}>
            <input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search make or model…" />
            <button type="submit">Search</button>
            {search && <button type="button" onClick={() => { setSearch(""); setSearchDraft(""); }}>Clear</button>}
          </form>
        )}
      </div>

      {mode === "browse" && (
        <div className={styles.segBreadcrumb}>
          <button type="button" onClick={() => { setMake(""); setModel(""); setYear(0); }}>All makes</button>
          {make && (<><span>›</span><button type="button" onClick={() => { setModel(""); setYear(0); }}>{title(make)}</button></>)}
          {model && (<><span>›</span><button type="button" onClick={() => setYear(0)}>{title(model)}</button></>)}
          {year > 0 && (<><span>›</span><strong>{year}</strong></>)}
        </div>
      )}

      {loading && <p className={styles.muted}>Loading…</p>}

      {!loading && level !== "cars" && (
        <>
          <p className={styles.muted}>
            {rows.length.toLocaleString()} {level === "flat" ? "segments" : level} ·
            click a column heading to sort, or any row to open it
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {th("label", level === "flat" ? "Segment" : level === "makes" ? "Make" : level === "models" ? "Model" : "Year")}
                  {th("live_cars", "Our cars")}
                  {th("irish_ads", "Irish ads")}
                  {th("evidence", "Evidence")}
                  {th("our_avg_price", "Our avg")}
                  {th("irish_avg_median", "Irish median")}
                  {th("avg_saving", "Trend")}
                  {th("flyers", "Bestsellers")}
                  {th("rare_flyers", "#1")}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.label} className={styles.segRow}
                      onClick={() => (level === "flat" ? openSegment(r) : drill(r.label))}>
                    <td><strong>{title(r.label)}</strong></td>
                    <td>{Number(r.live_cars).toLocaleString()}</td>
                    <td>{r.irish_ads}</td>
                    <td>{badge(r.evidence)}</td>
                    <td>{eur(r.our_avg_price)}</td>
                    <td>{eur(r.irish_avg_median)}</td>
                    <td>{trend(r.avg_saving)}</td>
                    <td>{r.flyers ? <strong>{Number(r.flyers).toLocaleString()}</strong> : "—"}</td>
                    <td>{r.rare_flyers ? <strong>{Number(r.rare_flyers).toLocaleString()}</strong> : "—"}</td>
                    <td className={styles.segChevron}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && level === "cars" && (
        <div className={styles.segSplit}>
          <div>
            <h3 className={styles.segHeading}>Our cars ({cars.length})</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Car</th><th>Mileage</th><th>Our price</th><th>vs Irish median</th></tr></thead>
                <tbody>
                  {cars.map((c) => (
                    <tr key={c.car_id}>
                      <td><a href={`/car/${c.car_id}`} target="_blank" rel="noreferrer">{c.car_name}</a></td>
                      <td>{c.plain_mileage ? `${Math.round(Number(c.plain_mileage) * 1.609).toLocaleString()} km` : "—"}</td>
                      <td>{eur(c.our_price)}</td>
                      <td className={Number(c.saving) > 0 ? styles.good : styles.bad}>
                        {Number(c.saving) > 0 ? `−${eur(c.saving)}` : `+${eur(Math.abs(Number(c.saving)))}`}
                        {Number(c.saving) >= 5000 && <span className={styles.rareFlyer}>⚡ #1 Bestseller</span>}
                        {Number(c.saving) >= 2500 && Number(c.saving) < 5000 && <span className={styles.flyer}>Bestseller</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className={styles.segHeading}>The Irish listings behind it ({irish.length})</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Listing</th><th>Mileage</th><th>Price</th><th>County</th></tr></thead>
                <tbody>
                  {irish.map((l, i) => (
                    <tr key={i}>
                      <td>{l.version ?? "—"}</td>
                      <td>{l.mileage_km ? `${Number(l.mileage_km).toLocaleString()} km` : "—"}</td>
                      <td>{eur(Number(l.price_eur))}</td>
                      <td>{l.county ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <p className={styles.panelFoot}>
        Irish prices from the Carzone snapshot of {snapshot || "—"}; our prices and every saving
        computed live, so sold cars drop out and price changes show at once.
        <strong> Bestseller</strong> = €2,500+ under the Irish median ·
        <strong> #1 Bestseller</strong> = €5,000+.
        <em> Verified</em> = 10+ Irish listings · <em>Trend</em> = 5–9 · <em>Thin</em> = under 5.
      </p>
    </>
  );
}
