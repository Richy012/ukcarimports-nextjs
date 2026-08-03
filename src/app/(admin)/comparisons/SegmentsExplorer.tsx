"use client";

import { useCallback, useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

/**
 * Make -> model -> year -> individual cars, with the UK-vs-Ireland differential
 * at every level. Irish medians come from the weekly snapshot; our prices and
 * every saving are computed live on each request, so a sold car leaves the view
 * immediately and a price change shows at once.
 *
 * Flyer = EUR 2,500+ under the Irish median. Rare Flyer = EUR 5,000+.
 */

interface Row {
  label: string;
  live_cars: number;
  sold_or_gone: number;
  irish_ads: number;
  our_avg_price: number | null;
  irish_avg_median: number | null;
  avg_saving: number | null;
  flyers: number;
  rare_flyers: number;
  evidence: "verified" | "trend" | "thin";
  direction: "uk_cheaper" | "irish_cheaper";
}

interface Car {
  car_id: string;
  car_name: string;
  version: string | null;
  plain_mileage: number | null;
  our_price: number;
  irish_median: number;
  irish_ads: number;
  saving: number;
}

interface IrishListing {
  version: string | null;
  year: number | null;
  mileage_km: number | null;
  price_eur: string | null;
  dealer_name: string | null;
  county: string | null;
}

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `€${Math.round(Number(n)).toLocaleString()}`;

const title = (s: string) =>
  s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export default function SegmentsExplorer() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | 0>(0);

  const [rows, setRows] = useState<Row[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [irish, setIrish] = useState<IrishListing[]>([]);
  const [level, setLevel] = useState("makes");
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (make) qs.set("make", make);
    if (model) qs.set("model", model);
    if (year) qs.set("year", String(year));
    fetch(`/api/staff-segments?${qs.toString()}`, { headers: staffAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const data = d?.data ?? {};
        setLevel(data.level ?? "makes");
        setRows(data.rows ?? []);
        setCars(data.cars ?? []);
        setIrish(data.irish_listings ?? []);
        if (data.snapshot_date) setSnapshot(data.snapshot_date);
      })
      .finally(() => setLoading(false));
  }, [make, model, year]);

  useEffect(load, [load]);

  const drill = (label: string) => {
    if (level === "makes") setMake(label);
    else if (level === "models") setModel(label);
    else if (level === "years") setYear(Number(label));
  };

  return (
    <>
      <div className={styles.segBreadcrumb}>
        <button type="button" onClick={() => { setMake(""); setModel(""); setYear(0); }}>
          All makes
        </button>
        {make && (
          <>
            <span>›</span>
            <button type="button" onClick={() => { setModel(""); setYear(0); }}>{title(make)}</button>
          </>
        )}
        {model && (
          <>
            <span>›</span>
            <button type="button" onClick={() => setYear(0)}>{title(model)}</button>
          </>
        )}
        {year > 0 && (<><span>›</span><strong>{year}</strong></>)}
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}

      {!loading && level !== "cars" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{level === "makes" ? "Make" : level === "models" ? "Model" : "Year"}</th>
                <th>Our cars</th>
                <th>Irish ads</th>
                <th>Evidence</th>
                <th>Our avg</th>
                <th>Irish median</th>
                <th>Trend</th>
                <th>Flyers</th>
                <th>Rare</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={styles.segRow} onClick={() => drill(r.label)}>
                  <td><strong>{title(String(r.label))}</strong></td>
                  <td>{r.live_cars.toLocaleString()}</td>
                  <td>{r.irish_ads}</td>
                  <td>
                    <span className={
                      r.evidence === "verified" ? styles.badgeVerified
                      : r.evidence === "trend" ? styles.badgeTrend : styles.badgeThin}>
                      {r.evidence}
                    </span>
                  </td>
                  <td>{eur(r.our_avg_price)}</td>
                  <td>{eur(r.irish_avg_median)}</td>
                  <td className={Number(r.avg_saving) > 0 ? styles.good : styles.bad}>
                    {Number(r.avg_saving) > 0
                      ? `UK cheaper by ${eur(r.avg_saving)}`
                      : `Irish cheaper by ${eur(Math.abs(Number(r.avg_saving)))}`}
                  </td>
                  <td>{r.flyers ? <strong>{r.flyers.toLocaleString()}</strong> : "—"}</td>
                  <td>{r.rare_flyers ? <strong>{r.rare_flyers.toLocaleString()}</strong> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && level === "cars" && (
        <div className={styles.segSplit}>
          <div>
            <h3 className={styles.segHeading}>Our cars ({cars.length})</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Car</th><th>Mileage</th><th>Our price</th><th>vs Irish median</th></tr>
                </thead>
                <tbody>
                  {cars.map((c) => (
                    <tr key={c.car_id}>
                      <td>
                        <a href={`/car/${c.car_id}`} target="_blank" rel="noreferrer">
                          {c.car_name}
                        </a>
                      </td>
                      <td>{c.plain_mileage ? `${Math.round(c.plain_mileage * 1.609).toLocaleString()} km` : "—"}</td>
                      <td>{eur(c.our_price)}</td>
                      <td className={Number(c.saving) > 0 ? styles.good : styles.bad}>
                        {Number(c.saving) > 0 ? `−${eur(c.saving)}` : `+${eur(Math.abs(Number(c.saving)))}`}
                        {Number(c.saving) >= 5000 && <span className={styles.rareFlyer}>⚡ Rare Flyer</span>}
                        {Number(c.saving) >= 2500 && Number(c.saving) < 5000 && <span className={styles.flyer}>Flyer</span>}
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
                <thead>
                  <tr><th>Listing</th><th>Mileage</th><th>Price</th><th>County</th></tr>
                </thead>
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
        Irish prices from the Carzone snapshot of {snapshot || "—"}; our prices and every
        saving computed live, so sold cars drop out and price changes show at once.
        <strong> Flyer</strong> = €2,500+ under the Irish median · <strong>Rare Flyer</strong> = €5,000+.
        <em> Verified</em> = 10+ Irish listings · <em>Trend</em> = 5–9 · <em>Thin</em> = under 5.
      </p>
    </>
  );
}
