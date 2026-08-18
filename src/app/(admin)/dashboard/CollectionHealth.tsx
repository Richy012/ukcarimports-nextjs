"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface Stream {
  key: string;
  label: string;
  built: boolean;
  done: number;
  applicable: number;
  remaining: number;
  pct: number;
  per_hour: number | null;
  eta_hours: number | null;
  note: string;
}

interface AuditBox {
  box: string; taken_at: string; window_hours: number;
  searches_started?: number; searches_completed?: number; searches_truncated?: number;
  page_loads: number; distinct_cars: number; duplication: number | null;
  wasted_loads: number; overflow: number; giveups: number;
  lock_failures: number; errors: number;
  named: number; genuine_private: number; name_missed: number; stale: boolean;
}

interface Fix {
  title: string; target: string; proposed_on: string;
  applied_at: string | null; status: string; evidence: string | null;
}

interface Audit {
  boxes: AuditBox[];
  fixes?: Fix[];
  fleet?: { arriving_per_hour: number; removed_per_hour: number; arrived_6h: number; removed_6h: number };
}

interface Health {
  live_now?: { arrivals_1h: number; deleted_1h: number; deleted_last_batch?: number; rechecked_1h: number };
  today?: {
    arrivals_24h: number; arrivals_prev_24h: number;
    deleted_24h: number; deleted_prev_24h: number;
  };
  backlog?: { stale_72h: number; never_rechecked: number };
  generated_at: string;
  total_cars: number;
  comparable_cars?: number;
  dealer_cars: number;
  housekeeper_visits_last_hour: number;
  new_cars_last_hour: number;
  streams: Stream[];
  audit?: Audit;
  v14?: {
    rollout?: { box: string; status: string; since: string | null }[];
    stale_72h?: number;
    photo_sharp_arrivals?: number;
    photo_backlog?: number;
    arrivals_1h?: number;
    arrivals_24h?: number;
    arrivals_7d_avg?: number;
    dead_deleted_1h?: number;
    sterling_cuts_24h: number;
    sterling_raises_24h: number;
    drops_displayed: number;
    drops_total: number;
    biggest_drop_eur: number;
    avg_drop_eur: number;
    dead_deleted_24h: number;
    promo_signatures: number;
    promo_cars_cleaned: number;
    promo_images_removed: number;
    fresh_visited_cars: number;
  };
}

const n = (v: number) => v.toLocaleString("en-IE");

function eta(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

// The status is the whole point: a stream sitting still is a broken stream,
// and that is invisible if you only ever look at a total.
function status(s: Stream): { text: string; tone: "done" | "running" | "stalled" | "todo" } {
  if (!s.built) return { text: "not built", tone: "todo" };
  if (s.remaining === 0) return { text: "complete", tone: "done" };
  if (s.per_hour && s.per_hour > 0) return { text: `+${n(s.per_hour)}/hr`, tone: "running" };
  return { text: "stalled", tone: "stalled" };
}

// Hostnames alone are unreadable when every conversation about these machines
// uses the last octet of the IP. Show both, plus what the box is actually for.
const BOX_ID: Record<string, { ip: string; role: string }> = {
  "ATRADER-3":  { ip: ".27",  role: "discovery" },
  "ATRADER-2":  { ip: ".26",  role: "discovery" },
  "ATSCRAPER1": { ip: ".201", role: "discovery" },
  "SERVER-4":   { ip: ".101", role: "radar + backfill" },
};

// AutoTrader's own count for our exact filter set, less N.Ireland-only adverts.
// Measured off the live site by the owner, 2026-08-09: 178,273 - 9,690.
// Re-measure this occasionally; it is a fixed number, not a feed.
const ADDRESSABLE = 168583;
const ADDRESSABLE_ON = "9 Aug 2026";
// Both halves of this ratio must be built the same way. The market figure was
// read off AutoTrader with price from GBP9,500, year 2016 on, under 100,000 miles,
// so the numerator has to carry the same filter -- not our whole stock, which
// includes 28,600 cars below that price and would overstate coverage by 17 pts.
const COVERAGE_BASIS = "GBP9,500+, 2016 on, under 100k miles";

export default function CollectionHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/collection-health", { headers: staffAuthHeaders(), cache: "no-store" })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data) => {
          if (!cancelled) {
            setHealth(data?.data ?? null);
            setError(null);
          }
        })
        .catch((e) => !cancelled && setError(e.message));
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>Data collection</h2>
        <p className={styles.panelError}>Could not load: {error}</p>
      </section>
    );
  }

  if (!health) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>Data collection</h2>
        <p className={styles.panelMeta}>
        Live figures &mdash; the last hour, and today against yesterday.
      </p>
      </section>
    );
  }

  // Direction matters more than the raw figure: 900 deletions means one
  // thing after 40 yesterday and another after 1,400.
  const delta = (now: number, prev: number) => {
    if (!prev) return null;
    const pct = Math.round(((now - prev) / prev) * 100);
    if (Math.abs(pct) < 5) return <span style={{ color: "#777" }}> · level on yesterday</span>;
    return (
      <span style={{ color: pct > 0 ? "#0a7d33" : "#b60b0c", fontWeight: 600 }}>
        {" "}· {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}% on yesterday
      </span>
    );
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelHeading}>Data collection</h2>
      <p className={styles.panelMeta}>
        {n(health.total_cars)} cars live, {n(health.dealer_cars)} from dealers ·{" "}
        {n(health.housekeeper_visits_last_hour)} re-checked and {n(health.new_cars_last_hour)} new per hour
        (averaged over 6 hours)
      </p>

      {/* Right now. A number on its own says nothing, so today is shown
          against yesterday and the backlog carries its direction. */}
      {health.live_now && (
        <div className={styles.engineTiles}>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Arriving</span>
            <span className={styles.engineValue}>{n(health.live_now.arrivals_1h)}<span style={{ fontSize: "0.5em", fontWeight: 400 }}> /hour</span></span>
            <span className={styles.engineSub}>6-hour average, same window as removals</span>
            <span className={styles.engineSub}>
              {n(health.today?.arrivals_24h ?? 0)} today
              {health.today ? delta(health.today.arrivals_24h, health.today.arrivals_prev_24h) : null}
            </span>
          </div>

          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Sold cars removed</span>
            <span className={styles.engineValue}>{n(health.live_now.deleted_1h)}<span style={{ fontSize: "0.5em", fontWeight: 400 }}> /hour</span></span>
            <span className={styles.engineSub}>
              {n(health.today?.deleted_24h ?? 0)} today
              {health.today ? delta(health.today.deleted_24h, health.today.deleted_prev_24h) : null}
              {health.live_now?.deleted_last_batch ? (
                <> &middot; removed in batches, last was {n(health.live_now.deleted_last_batch)}</>
              ) : null}
            </span>
          </div>

          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Live stock</span>
            <span className={styles.engineValue}>{n(health.total_cars)}</span>
            <span className={styles.engineSub}>{n(health.dealer_cars)} from named dealers</span>
          </div>

          {/* The outcome metric. Everything else in this panel measures waste;
              this measures whether we are actually finding the market. */}
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Market coverage</span>
            <span className={styles.engineValue}>
              {Math.round((100 * (health.comparable_cars ?? 0)) / ADDRESSABLE)}
              <span style={{ fontSize: "0.5em", fontWeight: 400 }}>%</span>
            </span>
            <span className={styles.engineSub}>
              {n(health.comparable_cars ?? 0)} of {n(ADDRESSABLE)} on the same basis
              {" "}({COVERAGE_BASIS})
              {" "}&middot; {n(Math.max(0, ADDRESSABLE - (health.comparable_cars ?? 0)))} still to find
              {" "}&middot; market measured {ADDRESSABLE_ON}
            </span>
          </div>

          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Price drops on site</span>
            <span className={styles.engineValue}>{n(health.v14?.drops_displayed ?? 0)}</span>
            <span className={styles.engineSub}>
              average &euro;{n(health.v14?.avg_drop_eur ?? 0)} &middot; biggest &euro;{n(health.v14?.biggest_drop_eur ?? 0)} &middot; {n(health.v14?.sterling_cuts_24h ?? 0)} dealer cuts in 24h
            </span>
          </div>
        </div>
      )}

      <div className={styles.tableScroll}>
        <table className={styles.healthTable}>
          <thead>
            <tr>
              <th>Stream</th>
              <th>Done</th>
              <th>Remaining</th>
              <th>Progress</th>
              <th>Rate</th>
              <th>Time to finish</th>
            </tr>
          </thead>
          <tbody>
            {health.streams.map((s) => {
              const st = status(s);
              return (
                <tr key={s.key} className={s.built ? undefined : styles.rowMuted}>
                  <td>
                    <span className={styles.streamLabel}>{s.label}</span>
                    <span className={styles.streamNote}>{s.note}</span>
                  </td>
                  <td className={styles.num}>
                    {n(s.done)}
                    <span className={styles.ofTotal}> of {n(s.applicable)}</span>
                  </td>
                  <td className={styles.num}>{s.remaining > 0 ? n(s.remaining) : "—"}</td>
                  <td className={styles.num}>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${Math.min(100, s.pct)}%` }}
                      />
                    </div>
                    <span className={styles.pct}>{s.pct}%</span>
                  </td>
                  <td>
                    <span className={`${styles.rate} ${styles[`rate_${st.tone}`]}`}>{st.text}</span>
                  </td>
                  <td className={styles.num}>{s.built ? eta(s.eta_hours) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {health.audit && health.audit.boxes.length > 0 && (
        <>
          <h3 style={{ margin: "30px 0 4px", fontSize: "0.95rem", fontWeight: 700 }}>
            Scraper efficiency audit
          </h3>
          <p className={styles.panelMeta}>
            Every box reports its own last 6 hours, hourly. Arrivals and removals are measured here, not
            reported. <strong>Nothing counts as fixed until every figure reaches its target.</strong>
          </p>

          {health.audit.fleet && (
            <div className={styles.engineTiles}>
              <div className={styles.engineTile}>
                <div className={styles.engineLabel}>Arriving</div>
                <div className={styles.engineValue}>{n(health.audit.fleet.arriving_per_hour)}/hr</div>
                <div className={styles.engineSub}>
                  {n(health.audit.fleet.arrived_6h)} in 6h · target: as high as the schedule allows
                </div>
              </div>
              <div className={styles.engineTile}>
                <div className={styles.engineLabel}>Sold cars removed</div>
                <div className={styles.engineValue}>{n(health.audit.fleet.removed_per_hour)}/hr</div>
                <div className={styles.engineSub}>
                  {n(health.audit.fleet.removed_6h)} in 6h · target: keeps pace with ads disappearing
                </div>
              </div>
            </div>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.healthTable}>
              <thead>
                <tr>
                  <th>BOX</th>
                  <th>PAGE LOADS</th>
                  <th>DISTINCT</th>
                  <th>DUPLICATION</th>
                  <th>WASTED</th>
                  <th>CELLS READ TO THE END</th>
                  <th>LOCK FAILS</th>
                  <th>ERRORS</th>
                  <th>NAMED / PRIVATE / MISSED</th>
                </tr>
              </thead>
              <tbody>
                {health.audit.boxes.map((b) => {
                  const bad = { color: "#b60b0c", fontWeight: 700 };
                  const ok = { color: "#0a7d33", fontWeight: 600 };
                  const dupBad = b.duplication !== null && b.duplication >= 1.05;
                  return (
                    <tr key={b.box}>
                      <td>
                        <strong>{b.box}</strong>
                        {BOX_ID[b.box] && (
                          <span style={{ color: "#6b6b6b", fontWeight: 400 }}>
                            {" "}{BOX_ID[b.box].ip} · {BOX_ID[b.box].role}
                          </span>
                        )}
                        {b.stale && <span style={bad}> · no report in 2h</span>}
                      </td>
                      <td className={styles.num}>{n(b.page_loads)}</td>
                      <td className={styles.num}>{n(b.distinct_cars)}</td>
                      <td className={styles.num} style={dupBad ? bad : ok}>
                        {b.duplication === null ? "—" : b.duplication.toFixed(2) + "×"}
                      </td>
                      <td className={styles.num} style={b.wasted_loads > 0 ? bad : ok}>{n(b.wasted_loads)}</td>
                      {/* the coverage test: the 552-cell grid is a proven
                          partition of the filter space, so cut short = 0 means
                          the entire cohort was seen in this window */}
                      <td className={styles.num}>
                        {(b.searches_started ?? 0) === 0 ? "-" : (
                          <span style={(b.searches_truncated ?? 0) === 0 ? ok : bad}>
                            {n(b.searches_completed ?? 0)} of {n(b.searches_started ?? 0)}
                            {(b.searches_truncated ?? 0) > 0
                              ? " - " + n(b.searches_truncated ?? 0) + " cut short"
                              : " - complete"}
                          </span>
                        )}
                      </td>
                      <td className={styles.num} style={b.lock_failures > 0 ? bad : ok}>{n(b.lock_failures)}</td>
                      <td className={styles.num} style={b.errors > 0 ? bad : undefined}>{n(b.errors)}</td>
                      <td className={styles.num}>
                        {n(b.named)} / <span style={b.genuine_private === 0 ? bad : ok}>{n(b.genuine_private)}</span> /{" "}
                        <span style={b.name_missed > 0 ? bad : ok}>{n(b.name_missed)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.panelMeta}>
            Targets: duplication 1.00×, wasted 0, gave-up 0, lock fails 0, missed 0. A seller column reading
            <strong> 0 private</strong> is a fault, not a clean sheet — real private ads exist, so zero means
            they are being labelled with whatever text is nearby.
          </p>

          {health.audit.fixes && health.audit.fixes.length > 0 && (
            <details style={{ marginTop: 18 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>
                Fixes tried, and whether they worked ({health.audit.fixes.length})
              </summary>
              <table className={styles.healthTable} style={{ marginTop: 10 }}>
                <tbody>
                  {health.audit.fixes.map((f) => {
                    const mark =
                      f.status === "worked" ? "✅" :
                      f.status === "helped" ? "🟠" :
                      f.status === "failed" ? "❌" :
                      f.status === "testing" ? "⏳" :
                      f.status === "superseded" ? "—" : "•";
                    return (
                      <tr key={f.title}>
                        <td style={{ width: 30, fontSize: "1.05rem" }}>{mark}</td>
                        <td>
                          <strong>{f.title}</strong>
                          <div className={styles.streamNote}>
                            {f.target} · {f.status}
                            {f.applied_at ? ` · applied ${new Date(f.applied_at).toLocaleString("en-IE")}` : " · not applied yet"}
                            {f.evidence ? ` — ${f.evidence}` : ""}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className={styles.panelMeta}>
                ✅ solved it · 🟠 helped but did not solve it · ❌ failed · ⏳ applied, awaiting the next audit ·
                • proposed, not yet applied
              </p>
            </details>
          )}
        </>
      )}

      <p className={styles.panelFoot}>
        Updated {new Date(health.generated_at).toLocaleTimeString("en-IE")} · refreshes every minute ·
        rates are measured growth against a stored snapshot ~6 hours back, so they cannot be fooled
        by quiet hours · a stream showing <strong>stalled</strong> has collected nothing in the last hour
      </p>
    </section>
  );
}
