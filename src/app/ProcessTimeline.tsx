"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  BadgeEuro,
  BellRing,
  HandCoins,
  ClipboardCheck,
  Truck,
  Stamp,
  CarFront,
  type LucideIcon,
} from "lucide-react";
import styles from "./page.module.css";

// The How It Works wheel, flattened. Keep step copy in sync with
// how-it-works/HowItWorksClient.tsx (same journey, horizontal rendering).
const STEPS: { icon: LucideIcon; short: string; title: string; body: string }[] = [
  { icon: Search, short: "Search", title: "Search 217,000+ UK cars", body: "Every car priced fully landed — VRT, VAT, customs and delivery included." },
  { icon: BadgeEuro, short: "Compare", title: "See the real Irish saving", body: "The Bestseller Index™ — every make and model benchmarked weekly against real Irish asking prices." },
  { icon: BellRing, short: "Alerts", title: "Save cars & searches", body: "We email you the moment a matching car lands — before it's gone." },
  { icon: HandCoins, short: "Deposit", title: "Reserve with a €2,000 deposit", body: "Pay securely online. Your maximum exposure: €0 without an inspection." },
  { icon: ClipboardCheck, short: "Inspection", title: "Independent inspection", body: "Full mechanical report with photos before you commit. Walk away? Refunded." },
  { icon: Truck, short: "Import", title: "We handle the import", body: "Purchase, UK VAT reclaim, customs clearance, transport to Dublin." },
  { icon: Stamp, short: "VRT", title: "VRT & Irish registration", body: "Appointment booked, VRT paid, Irish plates fitted." },
  { icon: CarFront, short: "Handover", title: "Delivery or collection", body: "To your door anywhere in Ireland — about two weeks all-in." },
];

export default function ProcessTimeline() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((p) => (p + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, [paused]);

  function select(i: number) {
    setActive(i);
    setPaused(true);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => setPaused(false), 12000);
  }

  const step = STEPS[active];

  return (
    <section
      className={styles.tlSection}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        if (pauseTimer.current) clearTimeout(pauseTimer.current);
        setPaused(false);
      }}
    >
      <h2 className={styles.sectionTitle}>How it works</h2>
      <p className={styles.sectionSub}>From your screen to Irish plates in about two weeks</p>

      <div className={styles.tlTrackWrap}>
        <div className={styles.tlTrack} />
        <div
          className={styles.tlProgress}
          style={{ width: `${(active / (STEPS.length - 1)) * 94}%` }}
        />
        {(() => {
          const n = STEPS.length;
          const start = STEPS.findIndex((st) => st.short === "Deposit");
          const end = STEPS.findIndex((st) => st.short === "Handover");
          const left = ((start + 0.5) / n) * 100;
          const width = ((end - start) / n) * 100;
          return (
            <div
              className={styles.tlTwoWeeks}
              style={{ left: left + "%", width: width + "%" }}
              aria-label="Deposit to handover takes about two weeks"
            >
              <span className={styles.tlTwoWeeksLabel}>2 weeks</span>
            </div>
          );
        })()}
        <div className={styles.tlSteps}>
          {STEPS.map((s, i) => {
            const isActive = i === active;
            const isDone = i < active;
            return (
              <button
                key={s.short}
                type="button"
                className={styles.tlStep}
                onClick={() => select(i)}
                aria-label={`Step ${i + 1}: ${s.title}`}
              >
                <span
                  className={`${styles.tlDot} ${isActive ? styles.tlDotActive : ""} ${isDone ? styles.tlDotDone : ""}`}
                >
                  <s.icon size={16} strokeWidth={1.75} />
                </span>
                <span className={`${styles.tlLabel} ${isActive ? styles.tlLabelActive : ""}`}>
                  {s.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.tlCaption} key={active}>
        <p className={styles.tlCaptionTitle}>{step.title}</p>
        <p className={styles.tlCaptionBody}>{step.body}</p>
      </div>

      <p className={styles.tlMore}>
        <Link href="/how-it-works">See the full journey &rarr;</Link>
      </p>
    </section>
  );
}
