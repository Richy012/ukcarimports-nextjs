"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

/**
 * Every machine in the estate and what runs on it.
 *
 * Hand-maintained: these are facts about infrastructure, not live telemetry, so
 * they change only when we change something. Verified box by box on 2 Aug 2026
 * (hostname, cores, RAM, disk, running services) rather than copied forward.
 *
 * Kept on the dashboard because "which box does that?" was costing time on
 * every incident, and because the answer was previously only in one person's
 * head and a memory file.
 */

interface Rates {
  backfill_per_hour?: number;
  new_capture_per_hour?: number;
  new_cars_last_hour?: number;
  housekeeper_visits_last_hour?: number;
}

interface Box {
  rateKey?: "backfill" | "newCapture" | "fleet";
  name: string;
  ip: string;
  host: string;
  spec: string;
  runs: string[];
  state: "live" | "idle" | "stopped";
  note?: string;
}

const WHUK: Box[] = [
  {
    rateKey: "newCapture",
    name: "S1",
    ip: "109.75.161.27",
    host: "ATRADER-3",
    spec: "Windows Server 2022",
    state: "live",
    runs: [
      "AutoTrader scraper, 5 threads",
      "v14 since Aug 5 13:24 — dead-ad deletion, w800 photos, promo firewall, freshness loop",
    ],
    note: "Launcher task \\AT, every 6h",
  },
  {
    rateKey: "fleet",
    name: "S2",
    ip: "109.75.164.201",
    host: "ATSCRAPER1",
    spec: "Windows Server 2022",
    state: "live",
    runs: ["AutoTrader scraper, 5 threads", "v14 since Aug 5 20:29 — dead-ad deletion, w800 photos, promo firewall, freshness loop"],
    note: "Launcher task \\AutoTrader. Runs a second, unrelated java process",
  },
  {
    rateKey: "fleet",
    name: "S3",
    ip: "109.75.161.26",
    host: "ATRADER-2",
    spec: "Windows Server 2022",
    state: "live",
    runs: ["AutoTrader scraper, 5 threads", "v14 since Aug 5 21:46 — dead-ad deletion, w800 photos, promo firewall, freshness loop"],
    note: "Historically the box that silently idled with no launcher task",
  },
  {
    rateKey: "backfill",
    name: "S4",
    ip: "194.76.26.101",
    host: "SERVER-4",
    spec: "4 cores · 10 GB RAM · Windows",
    state: "live",
    runs: [
      "Desktop\\Backfill — backfill-only node, 5 threads, own Redis db 3, v14 since Aug 5 23:01",
      "Desktop\\Cleaner — the original housekeeper, STOPPED, task disabled (Selim's)",
    ],
    note: "Two separate installs, deliberately isolated so Selim can work without affecting the backfill",
  },
];

const LINODE: Box[] = [
  {
    name: "Production",
    ip: "139.162.203.124",
    host: "website-automerchant",
    spec: "8 cores · 31 GB RAM · 629 GB disk, 66% used",
    state: "live",
    runs: [
      "ukcarimports.ie — Apache, PHP 7.4-FPM",
      "MySQL: automerc_automerchant (the one database everything writes to)",
      "Lumen API + the Laravel scheduler (pricing, VRT sync, alerts, delisting sweep)",
      "Next.js rebuild at /var/www/nextjs-ukcarimports (staging.ukcarimports.ie, PM2)",
    ],
  },
  {
    name: "Shadow / build box",
    ip: "178.79.134.181",
    host: "website-automerchant",
    spec: "4 cores · 7 GB RAM · 77 GB disk, 31% used",
    state: "idle",
    runs: [
      "/opt/scraper-staging — the shadow scraper, currently parked",
      "/root/fix_work + /root/scraper-source — where every jar is patched and compiled",
      "Its own local MySQL, seeded with a copy of production car identities",
      "denial_alert.py on a 2-minute cron",
    ],
    note: "Off unless testing code. Realistically 2-3 scraper threads — one thread already costs ~3 GB",
  },
  {
    name: "Carzone pipeline",
    ip: "172.232.55.8",
    host: "website-automerchant",
    spec: "4 cores · 7 GB RAM",
    state: "live",
    runs: [
      "carzone-weekly-pipeline.timer — Mondays 03:04 UTC, 8 stages",
      "Writes carzone_snapshot, price_comparisons and irish_class_medians into the production database",
    ],
    note: "Duplicate cron schedule has been removed. Last run FAILED (exit 120) and was resumed by hand",
  },
];

function Group({ title, boxes, sub, rates }: { title: string; boxes: Box[]; sub: string; rates: Rates | null }) {
  return (
    <>
      <tr>
        <td colSpan={3} className={styles.registerGroup}>
          {title} — {sub}
        </td>
      </tr>
      {boxes.map((b) => (
        <tr key={b.ip}>
          <td className={styles.streamLabel}>
            {b.name}
            <div className={styles.registerCadence}>{b.ip}</div>
            <div className={styles.streamNote}>
              {b.host} · {b.spec}
            </div>
          </td>
          <td>
            <span
              className={`${styles.pill} ${
                b.state === "live" ? styles.pillSeen : b.state === "idle" ? styles.pillPart : styles.pillBlind
              }`}
            >
              {b.state === "live" ? "Running" : b.state === "idle" ? "Parked" : "Stopped"}
            </span>
            {b.rateKey && rates && (
              <div className={styles.streamNote} style={{ marginTop: 6 }}>
                {b.rateKey === "backfill" && (
                  <><strong>{(rates.backfill_per_hour ?? 0).toLocaleString()}</strong>/hr backfilled</>
                )}
                {b.rateKey === "newCapture" && (
                  <><strong>{(rates.new_capture_per_hour ?? 0).toLocaleString()}</strong>/hr captured at insert</>
                )}
                {b.rateKey === "fleet" && (
                  <><strong>{(rates.new_cars_last_hour ?? 0).toLocaleString()}</strong>/hr new cars, fleet-wide</>
                )}
              </div>
            )}
          </td>
          <td className={styles.streamNote}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {b.runs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {b.note && <div style={{ marginTop: 6, opacity: 0.85 }}>{b.note}</div>}
          </td>
        </tr>
      ))}
    </>
  );
}

export default function Servers() {
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/collection-health", { headers: staffAuthHeaders() })
        .then((r) => r.json())
        .then((d) => setRates(d?.data ?? null))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelHeading}>Servers</h2>
      <p className={styles.panelMeta}>
        Seven machines. Four Windows boxes at WHUK doing the scraping, three Linodes doing everything
        else. Verified box by box on 2 August 2026.
      </p>

      <div className={styles.tableScroll}>
        <table className={styles.healthTable}>
          <thead>
            <tr>
              <th>Box</th>
              <th>State</th>
              <th>What runs on it</th>
            </tr>
          </thead>
          <tbody>
            <Group title="WHUK" sub="AutoTrader scraping" boxes={WHUK} rates={rates} />
            <Group title="Linode" sub="site, database, pipelines" boxes={LINODE} rates={rates} />
          </tbody>
        </table>
      </div>

      <p className={styles.panelMeta}>
        Rates refresh every minute. Nothing records WHICH box wrote a row, so these are split by
        kind of work &mdash; backfill is S4's only job, capture-at-insert is the live scrapers' &mdash;
        rather than measured per machine. Only the production Linode holds data. Everything else is compute — a scraper box can be
        rebuilt from scratch without losing anything.
      </p>
    </section>
  );
}
