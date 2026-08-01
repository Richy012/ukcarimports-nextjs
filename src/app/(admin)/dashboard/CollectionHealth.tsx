"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface Stream {
  key: string;
  label: string;
  collected: number;
  of: number;
  pct: number;
  last_hour: number | null;
  note: string;
}

interface Health {
  generated_at: string;
  total_cars: number;
  housekeeper_visits_last_hour: number;
  new_cars_last_hour: number;
  streams: Stream[];
}

const n = (v: number) => v.toLocaleString("en-IE");

// A count alone cannot tell "collecting" from "stopped" -- that is precisely
// how the seller-name capture stayed broken for a fortnight. So the rate is
// the headline and the total is the supporting detail.
function rateLabel(s: Stream): { text: string; tone: "ok" | "idle" | "na" } {
  if (s.last_hour === null) return { text: "resolved on demand", tone: "na" };
  if (s.last_hour > 0) return { text: `+${n(s.last_hour)} in the last hour`, tone: "ok" };
  return { text: "nothing in the last hour", tone: "idle" };
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
    // Cheap query, and the point of the panel is that it is current.
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
        <p className={styles.panelError}>Could not load collection health: {error}</p>
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
        {n(health.housekeeper_visits_last_hour)} cars re-checked and {n(health.new_cars_last_hour)} new
        arrivals in the last hour, across {n(health.total_cars)} cars.
      </p>

      <div className={styles.tableScroll}>
        <table className={styles.healthTable}>
          <thead>
            <tr>
              <th>Stream</th>
              <th>Collected</th>
              <th>Coverage</th>
              <th>Movement</th>
            </tr>
          </thead>
          <tbody>
            {health.streams.map((s) => {
              const rate = rateLabel(s);
              return (
                <tr key={s.key}>
                  <td>
                    <span className={styles.streamLabel}>{s.label}</span>
                    <span className={styles.streamNote}>{s.note}</span>
                  </td>
                  <td className={styles.num}>
                    {n(s.collected)}
                    <span className={styles.ofTotal}> of {n(s.of)}</span>
                  </td>
                  <td className={styles.num}>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${Math.min(100, s.pct)}%` }} />
                    </div>
                    <span className={styles.pct}>{s.pct}%</span>
                  </td>
                  <td>
                    <span className={`${styles.rate} ${styles[`rate_${rate.tone}`]}`}>{rate.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.panelFoot}>
        Updated {new Date(health.generated_at).toLocaleTimeString("en-IE")} · refreshes every minute
      </p>
    </section>
  );
}
