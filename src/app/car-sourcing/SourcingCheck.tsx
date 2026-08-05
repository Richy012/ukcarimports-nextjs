"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, CircleCheck, TriangleAlert, BellRing } from "lucide-react";
import styles from "./page.module.css";

type Result = {
  status: "blocked" | "in_stock" | "sourceable" | "invalid";
  seller: string | null;
  reason: string | null;
  make: string | null;
  model: string | null;
  matches: { car_id: string; car_name: string; price: number | null; mileage: string }[];
  estimate: { low: number; high: number; sample: number } | null;
};

function EstimateNote({ e, make, model }: { e: Result["estimate"]; make: string | null; model: string | null }) {
  if (!e) return null;
  const eur = (n: number) => "\u20ac" + n.toLocaleString("en-IE");
  return (
    <p className={styles.checkEstimate}>
      <strong>Rough guide:</strong> {make} {model} cars on our site currently land between{" "}
      {eur(e.low)} and {eur(e.high)} all in \u2014 VRT, VAT, customs, transport and Irish plates
      included, based on {e.sample} we have in stock.{" "}
      <span className={styles.checkCaveat}>
        This is an estimate only, not a quote: year, trim and mileage move the real figure
        considerably. We price your exact car properly once we source it.
      </span>
    </p>
  );
}

/**
 * Check-before-you-pay. A customer pastes the advert they found; we tell them
 * whether we already have it (free), whether that seller refuses Irish or
 * trade buyers (so sourcing would be wasted money), or that sourcing is the
 * right route. Owner brief 2026-08-04, after an evening spent answering
 * exactly this by hand for one customer.
 */
export default function SourcingCheck() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sourcing-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      setResult(await res.json());
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.checkBox}>
      <h2 className={styles.checkHeading}>
        <Search size={17} strokeWidth={2} aria-hidden="true" /> Check the car first — it&rsquo;s free
      </h2>
      <p className={styles.checkLead}>
        Paste the advert you found. We&rsquo;ll tell you whether we already have that car, or whether
        that seller can sell to an Irish buyer at all — before you pay anything.
      </p>

      <div className={styles.checkRow}>
        <input
          type="url"
          className={styles.checkInput}
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              check();
            }
          }}
          aria-label="Advert link"
        />
        <button type="button" className={styles.checkBtn} onClick={check} disabled={loading}>
          {loading ? "Checking…" : "Check this car"}
        </button>
      </div>

      {result?.status === "blocked" && (
        <div className={`${styles.checkResult} ${styles.checkBad}`}>
          <p>
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />{" "}
            <strong>{result.seller} can&rsquo;t sell you this car.</strong>
          </p>
          <p>{result.reason}</p>
          <p>
            <EstimateNote e={result.estimate} make={result.make} model={result.model} />
            Don&rsquo;t pay the sourcing fee for this one. If you tell us the model, budget and
            mileage you&rsquo;re after we&rsquo;ll find you the same car from a seller who can
            deliver — or set up a free alert below.
          </p>
        </div>
      )}

      {result?.status === "in_stock" && (
        <div className={`${styles.checkResult} ${styles.checkGood}`}>
          <p>
            <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />{" "}
            <strong>Good news — we already have cars like this in stock.</strong> No sourcing fee
            needed; every price below is the full landed cost on Irish plates.
          </p>
          <ul className={styles.checkList}>
            {result.matches.map((m) => (
              <li key={m.car_id}>
                <Link href={`/car/${m.car_id}`}>{m.car_name}</Link>
                {m.price ? <span> — €{Math.round(m.price).toLocaleString("en-IE")}</span> : null}
              </li>
            ))}
          </ul>
          <EstimateNote e={result.estimate} make={result.make} model={result.model} />
          <p>
            Not the exact one?{" "}
            <Link href={`/used-cars${result.make ? `?Make=${encodeURIComponent(result.make)}` : ""}`}>
              See all of them
            </Link>
            , or use the sourcing service below and we&rsquo;ll chase your specific car.
          </p>
        </div>
      )}

      {result?.status === "sourceable" && (
        <div className={styles.checkResult}>
          <p>
            <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />{" "}
            <strong>No obvious blocker on that seller.</strong> We don&rsquo;t have that exact car in
            stock, so the €50 sourcing service below is the right route — we&rsquo;ll price it fully
            landed, VRT and all, and come back to you.
          </p>
          <EstimateNote e={result.estimate} make={result.make} model={result.model} />
          <p className={styles.checkNote}>
            <BellRing size={15} strokeWidth={2} aria-hidden="true" /> Not in a rush?{" "}
            <Link href="/sign-up">Set up a free alert</Link> and we&rsquo;ll email you when a
            matching car lands — we add UK stock every day.
          </p>
        </div>
      )}

      {result?.status === "invalid" && (
        <div className={styles.checkResult}>
          <p>That doesn&rsquo;t look like a web address — paste the full link to the advert.</p>
        </div>
      )}
    </div>
  );
}
