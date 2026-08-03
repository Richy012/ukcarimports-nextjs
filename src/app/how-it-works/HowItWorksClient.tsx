"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  BellRing,
  HandCoins,
  ClipboardCheck,
  Truck,
  Stamp,
  CarFront,
  type LucideIcon,
} from "lucide-react";
import styles from "./page.module.css";

interface Step {
  icon: LucideIcon;
  short: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    icon: Search,
    short: "Search",
    title: "Search 200,000+ UK cars",
    body: "Every car listed is at an established garage in Great Britain, priced fully landed — transport, customs duty, VAT, VRT and our handling all included. The price you see is the price you pay.",
    cta: { label: "Browse used cars", href: "/used-cars" },
  },
  {
    icon: BellRing,
    short: "Alerts",
    title: "Save cars & searches",
    body: "Create a free account and save a car or a search. When a matching or similar car lands on the site, you get an email alert — before it's gone.",
    cta: { label: "Create an account", href: "/sign-up" },
  },
  {
    icon: HandCoins,
    short: "Deposit",
    title: "Reserve it with a deposit",
    body: "Found the one? Place a €2,000 deposit to secure the car with the garage. Your maximum exposure is €0 without an inspection — or €395 if you choose one. Pay securely online or by bank transfer.",
  },
  {
    icon: ClipboardCheck,
    short: "Inspection",
    title: "Independent inspection",
    body: "Optional but recommended: a qualified mechanic completes a full mechanical and condition inspection with photos and a history check. Not happy with the report? Walk away and your deposit is refunded minus only the €395 inspection fee. We guarantee your car arrives as described in the report.",
  },
  {
    icon: Truck,
    short: "Import",
    title: "We handle the import",
    body: "Once you approve, we invoice the balance, purchase the car, reclaim the UK VAT (which reduces the Irish VAT you pay), complete customs clearance and trailer the car to Dublin.",
  },
  {
    icon: Stamp,
    short: "VRT",
    title: "VRT & Irish registration",
    body: "We book and complete the VRT appointment on your behalf and your new Irish plates are fitted. We tell you exactly which documents are needed to register the car in your name.",
  },
  {
    icon: CarFront,
    short: "Handover",
    title: "Delivery or collection",
    body: "Free home delivery within Greater Dublin, a €100 contribution towards delivery elsewhere in Ireland, or collect the car yourself. Typical time from deposit to delivery: about two weeks.",
  },
];

const REVIEWS = [
  {
    quote: "Just under two weeks from initial contact to the car being delivered.",
    name: "Shauna W.",
  },
  {
    quote: "An Irish-plated car, that you order from your computer, within 2 weeks. The mechanic inspection is comprehensive.",
    name: "Galatia C.",
  },
  {
    quote: "Clear communication and no surprises along the way. Very upfront, honest and helpful throughout.",
    name: "Conor W.",
  },
  {
    quote: "Higher spec cars, for cheaper — you can't go wrong.",
    name: "Declan W.",
  },
];

const AUTO_ADVANCE_MS = 5000;
const R = 150;
const CENTER = 200;

function nodePosition(index: number): { x: number; y: number } {
  const angle = ((index / STEPS.length) * 360 - 90) * (Math.PI / 180);
  return { x: CENTER + R * Math.cos(angle), y: CENTER + R * Math.sin(angle) };
}

export default function HowItWorksClient() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((prev) => (prev + 1) % STEPS.length), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused]);

  // A manual selection pauses the rotation briefly so the visitor can read.
  const select = useCallback((index: number) => {
    setActive(index);
    setPaused(true);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => setPaused(false), 15000);
  }, []);

  const circumference = 2 * Math.PI * R;
  const progress = ((active + 1) / STEPS.length) * circumference;
  const step = STEPS[active];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1>How It Works</h1>
        <p>
          A clear, flexible way to import your next car from Great Britain — chosen on your screen,
          delivered on Irish plates.
        </p>
      </section>

      <section
        className={styles.wheelSection}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          if (pauseTimer.current) clearTimeout(pauseTimer.current);
          setPaused(false);
        }}
      >
        <div className={styles.wheelWrap}>
          <svg viewBox="0 0 400 400" className={styles.wheel} role="img" aria-label="The import process, step by step">
            <circle cx={CENTER} cy={CENTER} r={R} className={styles.ringTrack} />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R}
              className={styles.ringProgress}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
            {STEPS.map((s, i) => {
              const { x, y } = nodePosition(i);
              const isActive = i === active;
              const isDone = i < active;
              return (
                <g
                  key={s.short}
                  className={`${styles.node} ${isActive ? styles.nodeActive : ""} ${isDone ? styles.nodeDone : ""}`}
                  onClick={() => select(i)}
                  role="button"
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") select(i);
                  }}
                >
                  {isActive && <circle cx={x} cy={y} r={30} className={styles.pulse} />}
                  <circle cx={x} cy={y} r={24} className={styles.nodeCircle} />
                  <s.icon
                    x={x - 11}
                    y={y - 11}
                    width={22}
                    height={22}
                    strokeWidth={1.75}
                    className={styles.nodeSvgIcon}
                  />
                  <text x={x} y={y + 40} className={styles.nodeLabel}>
                    {s.short}
                  </text>
                </g>
              );
            })}
            <text x={CENTER} y={CENTER - 22} className={styles.centerStep}>
              STEP {active + 1} OF {STEPS.length}
            </text>
            <step.icon
              x={CENTER - 19}
              y={CENTER - 8}
              width={38}
              height={38}
              strokeWidth={1.5}
              className={styles.centerSvgIcon}
            />
            <text x={CENTER} y={CENTER + 52} className={styles.centerTime}>
              Deposit to handover
            </text>
            <text x={CENTER} y={CENTER + 70} className={styles.centerTimeStrong}>
              ~2 weeks
            </text>
          </svg>
        </div>

        <div className={styles.detailPanel} key={active}>
          <span className={styles.detailStepTag}>Step {active + 1}</span>
          <h2>{step.title}</h2>
          <p>{step.body}</p>
          {step.cta && (
            <Link href={step.cta.href} className={styles.detailCta}>
              {step.cta.label} &rarr;
            </Link>
          )}
          <div className={styles.detailNav}>
            <button
              type="button"
              onClick={() => select((active + STEPS.length - 1) % STEPS.length)}
              aria-label="Previous step"
            >
              &larr;
            </button>
            <div className={styles.dots}>
              {STEPS.map((s, i) => (
                <button
                  key={s.short}
                  type="button"
                  className={i === active ? styles.dotActive : styles.dot}
                  onClick={() => select(i)}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
            <button type="button" onClick={() => select((active + 1) % STEPS.length)} aria-label="Next step">
              &rarr;
            </button>
          </div>
        </div>
      </section>

      <section className={styles.whyStrip}>
        <div className={styles.whyCard}>
          <h3>100% online — no showroom costs</h3>
          <p>
            Your car stays at its UK garage until you order — no forecourt, no showroom overheads
            baked into the price. Delivered to your door anywhere in Ireland, or collected in Dublin
            by appointment.
          </p>
        </div>
        <div className={styles.whyCard}>
          <h3>Why it costs less</h3>
          <p>
            We reclaim the 20% UK VAT and customs duty where possible, reducing the base Irish Revenue
            uses to calculate duty and VAT — so you never pay VAT twice.
          </p>
        </div>
        <div className={styles.whyCard}>
          <h3>No hidden costs</h3>
          <p>
            Listed prices include transport, customs duty where applicable, VAT, VRT and our handling.
            A warranty (from €295) is the only optional extra.
          </p>
        </div>
        <div className={styles.whyCard}>
          <h3>Your maximum exposure: €0</h3>
          <p>
            Skip the inspection and your €2,000 deposit is fully refundable — exposure €0. Want the
            independent inspection? €395 is the only amount ever at stake if the report changes your
            mind.
          </p>
        </div>
      </section>

      <section className={styles.reviews}>
        <h2>What our customers say</h2>
        <p className={styles.reviewsRating}>
          <span className={styles.stars}>★★★★★</span> 4.6 from 122 Google reviews
        </p>
        <div className={styles.reviewGrid}>
          {REVIEWS.map((r) => (
            <figure key={r.name} className={styles.reviewCard}>
              <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption>— {r.name}, Google review</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Ready to find your car?</h2>
        <div className={styles.finalCtaRow}>
          <Link href="/used-cars" className={styles.ctaPrimary}>
            Browse used cars
          </Link>
          <Link href="/sign-up" className={styles.ctaSecondary}>
            Create a free account
          </Link>
        </div>
      </section>
    </main>
  );
}
