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

interface Health {
  generated_at: string;
  total_cars: number;
  dealer_cars: number;
  housekeeper_visits_last_hour: number;
  new_cars_last_hour: number;
  streams: Stream[];
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
        <p className={styles.panelMeta}>Loading…</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelHeading}>Data collection</h2>
      <p className={styles.panelMeta}>
        {n(health.total_cars)} cars live, {n(health.dealer_cars)} from dealers ·{" "}
        {n(health.housekeeper_visits_last_hour)} re-checked and {n(health.new_cars_last_hour)} new in the
        last hour
      </p>

      {health.v14 && (
        <div className={styles.engineTiles}>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>New cars found</span>
            <span className={styles.engineValue}>{n(health.v14.arrivals_1h ?? 0)} last hour</span>
            <span className={styles.engineSub}>
              {n(health.v14.arrivals_24h ?? 0)} in 24h &middot; {n(health.v14.arrivals_7d_avg ?? 0)}/day 7-day avg
              &middot; discovery owns the first hour of each 6h cycle
            </span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Dealer repricing (24h)</span>
            <span className={styles.engineValue}>{n(health.v14.sterling_cuts_24h)} cuts</span>
            <span className={styles.engineSub}>{n(health.v14.sterling_raises_24h)} raises &middot; sterling, change-only</span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Price drops on site</span>
            <span className={styles.engineValue}>{n(health.v14.drops_displayed)}</span>
            <span className={styles.engineSub}>
              of {n(health.v14.drops_total)} banked (&ge;&euro;100) &middot; biggest &euro;{n(health.v14.biggest_drop_eur)}
            </span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Dead ads deleted (24h)</span>
            <span className={styles.engineValue}>{n(health.v14.dead_deleted_24h)} <span style={{ fontSize: "0.6em", fontWeight: 400 }}>({n(health.v14.dead_deleted_1h ?? 0)} last hour)</span></span>
            <span className={styles.engineSub}>
              fleet-wide log (only v14 boxes can delete) &middot; {n(health.v14.stale_72h ?? 0)} live cars stale &gt;72h awaiting re-check
            </span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Marketing-image firewall</span>
            <span className={styles.engineValue}>{n(health.v14.promo_signatures)} signatures</span>
            <span className={styles.engineSub}>
              purge: {n(health.v14.promo_cars_cleaned)} cars / {n(health.v14.promo_images_removed)} images removed
            </span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Photo fix (800px)</span>
            <span className={styles.engineValue}>{n(health.v14.photo_sharp_arrivals ?? 0)} sharp</span>
            <span className={styles.engineSub}>
              arrivals since v14 &middot; &asymp;{n(health.v14.photo_backlog ?? 0)} older galleries await the re-capture sweep (starts after S4 joins v14)
            </span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>v14 rollout</span>
            <span className={styles.engineValue}>
              {(health.v14.rollout ?? []).filter((r) => r.status === "v14").length} / {(health.v14.rollout ?? []).length} boxes
            </span>
            <span className={styles.engineSub}>
              {(health.v14.rollout ?? [])
                .map((r) => r.status === "v14" ? r.box + " ✓ " + (r.since ?? "") : r.box + ": " + r.status)
                .join(" · ")}
            </span>
          </div>
          <div className={styles.engineTile}>
            <span className={styles.engineLabel}>Freshness loop</span>
            <span className={styles.engineValue}>{n(health.v14.fresh_visited_cars)}</span>
            <span className={styles.engineSub}>cars carrying visit bookkeeping (gallery count remembered)</span>
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

      <p className={styles.panelFoot}>
        Updated {new Date(health.generated_at).toLocaleTimeString("en-IE")} · refreshes every minute ·
        rates are measured growth against a stored snapshot ~6 hours back, so they cannot be fooled
        by quiet hours · a stream showing <strong>stalled</strong> has collected nothing in the last hour
      </p>
    </section>
  );
}
