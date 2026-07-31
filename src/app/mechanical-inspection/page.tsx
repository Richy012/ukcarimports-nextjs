import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Camera,
  ClipboardCheck,
  Cpu,
  FileText,
  Phone,
  Route,
  Wrench,
} from "lucide-react";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Independent Mechanical & Condition Inspection",
  description:
    "Before you commit to importing a car, an independent mechanic inspects it in person: 150+ checks inside and out, a road test, diagnostic scan where supported, photographs of any marks or damage, and a phone call to talk it through.",
};

// Section content mirrors what the inspecting mechanic actually records.
// Supplier is deliberately never named (owner direction 2026-07-31).
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Interior compartment",
    items: [
      "Door locking, boot/tailgate lock",
      "Door seals, hinges and trim panels",
      "Dash panel and interior sills",
      "Seat upholstery and seat mechanisms",
      "Steering wheel adjustment, mirrors",
      "Headlining, visors, carpets",
      "Sunroof, parcel shelf, luggage area",
      "Tool kit and spare equipment",
    ],
  },
  {
    title: "Electrical & controls",
    items: [
      "Headlights, side and running lights",
      "Indicators, hazards, stop lights",
      "Reverse, fog and auxiliary lights",
      "Panel and instrument lighting",
      "Switches, controls and horn",
      "Windows, sunroof operation",
      "Wipers, washers, headlamp washers",
      "Infotainment and driver displays",
    ],
  },
  {
    title: "Engine compartment",
    items: [
      "Oil, coolant and fluid levels",
      "Leaks from engine, gearbox, cooling",
      "Belts, hoses and pipework",
      "Battery condition and charging",
      "Fuel pump and pipe condition",
      "Exhaust and emissions equipment",
      "EV/hybrid: high-voltage system checks",
      "Signs of previous repair or neglect",
    ],
  },
  {
    title: "Wheels & tyres",
    items: [
      "All four tyres: tread, age, condition",
      "Uneven or abnormal wear patterns",
      "Wheel rims, trims and alloy condition",
      "Spare wheel or inflation kit",
      "Locking wheel nut key present",
    ],
  },
  {
    title: "Bodywork & exterior",
    items: [
      "Panel condition and alignment",
      "Body damage, dents and scratches",
      "Evidence of past repairs",
      "Corrosion and paintwork imperfections",
      "Glass and windscreen condition",
      "Bumpers, number plates, mud flaps",
      "Door locks and fuel filler operation",
    ],
  },
  {
    title: "Suspension, brakes & steering",
    items: [
      "Brake pads and discs (visual)",
      "Brake pipes and hoses where visible",
      "Road springs and shock absorbers",
      "Air suspension operation where fitted",
      "Bushes, arms, mountings and fixings",
      "Anti-roll bars and location rods",
      "Steering joints, rack and power steering",
      "Wheel hubs and bearings",
    ],
  },
  {
    title: "Road test",
    items: [
      "Cold start and idle behaviour",
      "Engine performance under load",
      "Gear selection and clutch/transmission",
      "Braking, pulling and ABS operation",
      "Steering, tracking and alignment feel",
      "Suspension noise over real roads",
      "Warning lights during driving",
    ],
  },
];

const PROMISES: { icon: typeof Camera; title: string; body: string }[] = [
  {
    icon: Camera,
    title: "Every mark recorded, inside and out",
    body:
      "Scratches, dents, kerbed alloys, scuffs on the interior sills, wear on the seats — the mechanic notes and photographs them. You see the car's real condition before you commit, not a dealer's description of it.",
  },
  {
    icon: Cpu,
    title: "Plugged into the car's ECU",
    body:
      "Where the vehicle supports it, the mechanic connects diagnostic equipment and reads stored fault codes — including faults that aren't currently showing a dashboard light.",
  },
  {
    icon: FileText,
    title: "Documents checked on request",
    body:
      "Service history, invoices, previous MOT paperwork, handbooks and keys — if you want them verified, the mechanic asks for them at the inspection and reports what is and isn't there.",
  },
  {
    icon: Phone,
    title: "A phone call, not just a form",
    body:
      "The mechanic rings to talk the car through in plain English. You can take that call yourself, or we take it and report back — whichever suits you.",
  },
];

export default function MechanicalInspectionPage() {
  return (
    <main className={`${styles.page} wm-light`}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Before you commit</p>
        <h1 className={styles.h1}>
          An independent mechanic inspects the car <em>in person</em>
        </h1>
        <p className={styles.lede}>
          You are buying a car you haven&apos;t stood beside. So before any money beyond
          the refundable deposit changes hands, a qualified independent mechanic goes to
          the vehicle, inspects it thoroughly, drives it, and reports back to you with
          photographs. They work for you, not for the seller and not for us.
        </p>

        <div className={styles.promiseGrid}>
          {PROMISES.map((p) => (
            <div key={p.title} className={styles.promise}>
              <p.icon size={22} strokeWidth={1.75} className={styles.promiseIcon} aria-hidden="true" />
              <h2>{p.title}</h2>
              <p>{p.body}</p>
            </div>
          ))}
        </div>

        <div className={styles.costBox}>
          <ClipboardCheck size={20} strokeWidth={1.75} aria-hidden="true" />
          <div>
            <strong>€395, and only if you choose it.</strong> The inspection is optional and is
            not included in the price you see on our listings — because the Irish forecourt
            price you&apos;re comparing against doesn&apos;t include a mechanic either. If you
            take the inspection and then decide against the car, your deposit is refunded minus
            the €395. Skip the inspection and your maximum exposure is nil.
          </div>
        </div>

        <h2 className={styles.h2}>What gets checked</h2>
        <p className={styles.sub}>
          Over 150 individual checks, each rated and commented on by the mechanic. Anything
          less than good comes with an explanation.
        </p>

        <div className={styles.sectionGrid}>
          {SECTIONS.map((s) => (
            <section key={s.title} className={styles.section}>
              <h3>
                <Wrench size={15} strokeWidth={1.75} aria-hidden="true" /> {s.title}
              </h3>
              <ul>
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <h2 className={styles.h2}>How the report reads</h2>
        <p className={styles.sub}>
          Every item is rated Poor / Fair / Good / Excellent with the mechanic&apos;s own note
          beside it. An illustrative extract:
        </p>

        <div className={styles.sampleWrap}>
          <table className={styles.sample}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Rating</th>
                <th>Mechanic&apos;s note</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Door trim panels</td><td className={styles.good}>Excellent</td><td>Like new condition</td></tr>
              <tr><td>Interior sills</td><td className={styles.fair}>Good</td><td>Minor marks/scuffs, driver&apos;s side</td></tr>
              <tr><td>Front tyres</td><td className={styles.fair}>Good</td><td>5mm tread, very slight scrubbing — alignment worth checking</td></tr>
              <tr><td>Brake discs (visual)</td><td className={styles.good}>Excellent</td><td>Even wear, no lipping</td></tr>
              <tr><td>Paintwork</td><td className={styles.fair}>Good</td><td>Small stone chips to bonnet leading edge, photographed</td></tr>
              <tr><td>Diagnostic scan</td><td className={styles.good}>Excellent</td><td>No stored fault codes</td></tr>
              <tr><td>Road test</td><td className={styles.good}>Excellent</td><td>Drives well, no unusual noises, brakes pull true</td></tr>
            </tbody>
          </table>
          <p className={styles.sampleNote}>
            Sample entries shown for illustration. Your report covers your car, in the
            mechanic&apos;s own words.
          </p>
        </div>

        <div className={styles.footerCta}>
          <Route size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            The inspection is step five of eight. <Link href="/how-it-works">See the full journey</Link>{" "}
            or <Link href="/used-cars">browse cars</Link>.
          </span>
        </div>

        <p className={styles.disclaimer}>
          <BadgeCheck size={14} strokeWidth={1.75} aria-hidden="true" /> The inspection is an
          independent professional evaluation of the vehicle at the time of inspection. It is
          not a warranty, and it is not a recommendation for or against purchase — it is the
          information you need to make that decision yourself.
        </p>
      </div>
    </main>
  );
}
