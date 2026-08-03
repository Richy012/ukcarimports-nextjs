"use client";

import { useCallback, useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";
import SegmentsExplorer from "./SegmentsExplorer";

interface ComparisonRow {
  id: number;
  uk_car_id: string;
  make: string;
  model: string;
  uk_version: string;
  uk_year: number;
  uk_mileage_miles: number | null;
  uk_raw_price_gbp: string | null;
  uk_landed_price_eur: string;
  cz_id: number;
  cz_version: string;
  cz_year: number;
  cz_mileage_km: number | null;
  cz_price_eur: string;
  cz_dealer: string | null;
  cz_county: string | null;
  cz_url: string;
  match_score: string | null;
  price_delta_eur: string;
  saving_pct: string;
  direction: "uk_cheaper" | "irish_cheaper" | "similar";
  segment_avg_saving_pct: string | null;
  segment_n: number | null;
  is_flier: number;
}

interface SnapshotRow {
  id: number;
  carzone_id: number;
  make: string;
  model: string;
  version: string;
  year: number | null;
  mileage_km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  price_eur: string | null;
  dealer_name: string | null;
  county: string | null;
}

interface Stats {
  snapshot_date: string;
  total_matches: number;
  uk_cheaper: number;
  irish_cheaper: number;
  fliers: number;
  avg_saving_pct: string;
  carzone_listings: number;
}

const PAGE_SIZE = 50;

function euro(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  return "€" + Math.round(Number(v)).toLocaleString();
}

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? "-" : v.toLocaleString();
}

export default function ComparisonsClient() {
  const [tab, setTab] = useState<"matches" | "segments" | "raw">("matches");
  const [stats, setStats] = useState<Stats | null>(null);

  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [count, setCount] = useState(0);
  const [makes, setMakes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState("all");
  const [fliersOnly, setFliersOnly] = useState(false);
  const [make, setMake] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [sort, setSort] = useState("saving");
  const [page, setPage] = useState(0);

  const [rawRows, setRawRows] = useState<SnapshotRow[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [rawMakes, setRawMakes] = useState<string[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawMake, setRawMake] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const [rawDate, setRawDate] = useState("");
  const [rawDates, setRawDates] = useState<string[]>([]);
  const [rawCurrentDate, setRawCurrentDate] = useState("");
  const [rawSearchDraft, setRawSearchDraft] = useState("");
  const [rawPage, setRawPage] = useState(0);

  useEffect(() => {
    fetch("/api/staff-price-comparison-stats", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setStats(data?.data?.latest ?? null));
  }, []);

  const loadMatches = useCallback(() => {
    setLoading(true);
    fetch("/api/staff-price-comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({
        direction: direction === "all" ? undefined : direction,
        fliers_only: fliersOnly ? 1 : undefined,
        make: make || undefined,
        search: search || undefined,
        sort,
        pagenum: page,
        limit: PAGE_SIZE,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setRows(data?.data?.rows ?? []);
        setCount(data?.data?.count ?? 0);
        setMakes(data?.data?.makes ?? []);
      })
      .finally(() => setLoading(false));
  }, [direction, fliersOnly, make, search, sort, page]);

  useEffect(loadMatches, [loadMatches]);

  const loadRaw = useCallback(() => {
    setRawLoading(true);
    fetch("/api/staff-carzone-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({
        snapshot_date: rawDate || undefined,
        make: rawMake || undefined,
        search: rawSearch || undefined,
        pagenum: rawPage,
        limit: PAGE_SIZE,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setRawRows(data?.data?.rows ?? []);
        setRawCount(data?.data?.count ?? 0);
        setRawMakes(data?.data?.makes ?? []);
        setRawDates(data?.data?.snapshot_dates ?? []);
        setRawCurrentDate(data?.data?.snapshot_date ?? "");
      })
      .finally(() => setRawLoading(false));
  }, [rawMake, rawSearch, rawPage, rawDate]);

  useEffect(() => {
    if (tab === "raw") loadRaw();
  }, [tab, loadRaw]);

  const pages = Math.max(1, Math.ceil((tab === "matches" ? count : rawCount) / PAGE_SIZE));
  const curPage = tab === "matches" ? page : rawPage;
  const setCurPage = tab === "matches" ? setPage : setRawPage;

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Price comparisons</h1>
        {stats && (
          <span className={styles.countText}>
            Snapshot {stats.snapshot_date} &middot; {stats.carzone_listings.toLocaleString()} Carzone
            listings &middot; {stats.total_matches.toLocaleString()} matched
          </span>
        )}
      </div>

      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.uk_cheaper.toLocaleString()}</span>
            <span className={styles.statLabel}>UK cheaper</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.irish_cheaper.toLocaleString()}</span>
            <span className={styles.statLabel}>Ireland cheaper</span>
          </div>
          <div className={`${styles.statCard} ${styles.statCardFlier}`}>
            <span className={styles.statValue}>{stats.fliers.toLocaleString()}</span>
            <span className={styles.statLabel}>Bestsellers</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.avg_saving_pct}%</span>
            <span className={styles.statLabel}>Avg saving (all matches)</span>
          </div>
        </div>
      )}

      <div className={styles.tabRow}>
        <button
          type="button"
          className={tab === "matches" ? styles.tabActive : styles.tab}
          onClick={() => setTab("matches")}
        >
          UK vs Ireland matches
        </button>
        <button
          type="button"
          className={tab === "segments" ? styles.tabActive : styles.tab}
          onClick={() => setTab("segments")}
        >
          Segments
        </button>
        <button
          type="button"
          className={tab === "raw" ? styles.tabActive : styles.tab}
          onClick={() => setTab("raw")}
        >
          Raw Carzone data
        </button>
      </div>

      {tab === "matches" && (
        <>
          <div className={styles.filterRow}>
            <label>
              Direction
              <select
                value={direction}
                onChange={(e) => {
                  setDirection(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="uk_cheaper">UK cheaper</option>
                <option value="irish_cheaper">Ireland cheaper</option>
              </select>
            </label>
            <label className={styles.flierToggle}>
              <input
                type="checkbox"
                checked={fliersOnly}
                onChange={(e) => {
                  setFliersOnly(e.target.checked);
                  setPage(0);
                }}
              />
              &#9889; Bestsellers only
            </label>
            <label>
              Make
              <select
                value={make}
                onChange={(e) => {
                  setMake(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All</option>
                {makes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(0);
                }}
              >
                <option value="saving">Best saving %</option>
                <option value="flier_gap">Bestseller gap vs segment</option>
                <option value="delta">Biggest &euro; saving</option>
                <option value="price">Lowest UK price</option>
              </select>
            </label>
            <form
              className={styles.searchForm}
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchDraft.trim());
                setPage(0);
              }}
            >
              <input
                type="text"
                placeholder="Model, version or car id..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </form>
            <span className={styles.countText}>{count.toLocaleString()} rows</span>
          </div>

          <div className={styles.tableWrap}>
            <div className={`${styles.tableHead} ${styles.matchGrid}`}>
              <span>UK car</span>
              <span>Irish comparable</span>
              <span>UK landed</span>
              <span>Irish price</span>
              <span>Saving</span>
              <span>Segment</span>
            </div>
            {loading && <div className={styles.emptyRow}>Loading...</div>}
            {!loading && rows.length === 0 && <div className={styles.emptyRow}>No rows match these filters.</div>}
            {!loading &&
              rows.map((row) => {
                const gap =
                  row.segment_avg_saving_pct !== null
                    ? Number(row.saving_pct) - Number(row.segment_avg_saving_pct)
                    : null;
                return (
                  <div
                    key={row.id}
                    className={`${styles.tableRow} ${styles.matchGrid} ${row.is_flier ? styles.flierRow : ""}`}
                  >
                    <div className={styles.carCell}>
                      <span>
                        {row.make} {row.model} ({row.uk_year})
                        {row.is_flier ? <span className={styles.badgeFlier}>&#9889; Bestseller</span> : null}
                      </span>
                      <span className={styles.carSub}>{row.uk_version}</span>
                      <span className={styles.carSub}>
                        {num(row.uk_mileage_miles)} mi &middot;{" "}
                        <a href={`https://ukcarimports.ie/car/${row.uk_car_id}`} target="_blank" rel="noreferrer">
                          View on UKCI
                        </a>
                      </span>
                    </div>
                    <div className={styles.carCell}>
                      <span className={styles.carSub}>{row.cz_version}</span>
                      <span className={styles.carSub}>
                        {row.cz_year} &middot; {num(row.cz_mileage_km)} km
                        {row.cz_dealer ? ` · ${row.cz_dealer}` : ""}
                      </span>
                      <span className={styles.carSub}>
                        score {row.match_score ?? "-"} &middot;{" "}
                        <a href={row.cz_url} target="_blank" rel="noreferrer">
                          Carzone
                        </a>
                      </span>
                    </div>
                    <span>{euro(row.uk_landed_price_eur)}</span>
                    <span>{euro(row.cz_price_eur)}</span>
                    <span
                      className={
                        row.direction === "uk_cheaper" ? styles.savingPos : styles.savingNeg
                      }
                    >
                      {Number(row.saving_pct) > 0 ? "+" : ""}
                      {row.saving_pct}%
                      <span className={styles.carSub}>
                        {row.direction === "uk_cheaper"
                          ? `${euro(Math.abs(Number(row.price_delta_eur)))} less`
                          : `${euro(Math.abs(Number(row.price_delta_eur)))} more`}
                      </span>
                    </span>
                    <span className={styles.carSub}>
                      avg {row.segment_avg_saving_pct ?? "-"}% (n={row.segment_n ?? "-"})
                      {gap !== null && row.is_flier ? (
                        <span className={styles.flierGap}>+{gap.toFixed(1)} pp vs segment</span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {tab === "segments" && <SegmentsExplorer />}

      {tab === "raw" && (
        <>
          <div className={styles.tabs}>
            {rawDates.map((d) => (
              <button
                key={d}
                type="button"
                className={rawCurrentDate === d ? styles.tabActive : styles.tab}
                onClick={() => {
                  setRawDate(d);
                  setRawPage(0);
                }}
              >
                Week of {d}
              </button>
            ))}
          </div>
          <div className={styles.filterRow}>
            <label>
              Make
              <select
                value={rawMake}
                onChange={(e) => {
                  setRawMake(e.target.value);
                  setRawPage(0);
                }}
              >
                <option value="">All</option>
                {rawMakes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <form
              className={styles.searchForm}
              onSubmit={(e) => {
                e.preventDefault();
                setRawSearch(rawSearchDraft.trim());
                setRawPage(0);
              }}
            >
              <input
                type="text"
                placeholder="Model, version or dealer..."
                value={rawSearchDraft}
                onChange={(e) => setRawSearchDraft(e.target.value)}
              />
            </form>
            <span className={styles.countText}>{rawCount.toLocaleString()} listings</span>
          </div>

          <div className={styles.tableWrap}>
            <div className={`${styles.tableHead} ${styles.rawGrid}`}>
              <span>Vehicle</span>
              <span>Year</span>
              <span>Mileage</span>
              <span>Fuel / gearbox</span>
              <span>Price</span>
              <span>Dealer</span>
            </div>
            {rawLoading && <div className={styles.emptyRow}>Loading...</div>}
            {!rawLoading && rawRows.length === 0 && (
              <div className={styles.emptyRow}>No listings match these filters.</div>
            )}
            {!rawLoading &&
              rawRows.map((row) => (
                <div key={row.id} className={`${styles.tableRow} ${styles.rawGrid}`}>
                  <div className={styles.carCell}>
                    <span>
                      {row.make} {row.model}
                    </span>
                    <span className={styles.carSub}>{row.version}</span>
                  </div>
                  <span>{row.year ?? "-"}</span>
                  <span>{num(row.mileage_km)} km</span>
                  <span className={styles.carSub}>
                    {row.fuel_type ?? "-"} / {row.transmission ?? "-"}
                  </span>
                  <span>{euro(row.price_eur)}</span>
                  <span className={styles.carSub}>
                    {row.dealer_name ?? "-"}
                    {row.county ? `, ${row.county}` : ""}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {tab !== "segments" && (
      <div className={styles.pagerRow}>
        <button type="button" disabled={curPage <= 0} onClick={() => setCurPage(curPage - 1)}>
          &larr; Prev
        </button>
        <span>
          Page {curPage + 1} of {pages}
        </span>
        <button type="button" disabled={curPage >= pages - 1} onClick={() => setCurPage(curPage + 1)}>
          Next &rarr;
        </button>
      </div>
      )}
    </>
  );
}
