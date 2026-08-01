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
        a stream showing <strong>stalled</strong> has collected nothing in the last hour
      </p>
    </section>
  );
}
