"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { isTokenValid, authHeaders } from "@/lib/auth";
import styles from "./FilterBar.module.css";

/**
 * Email capture at the point of intent.
 *
 * /used-cars had no capture at all: 200,000 cars, and a visitor who didn't
 * find one today left no trace (owner review, 2026-08-04 — 76 members and 13
 * saved searches after years). This turns the filters someone has already
 * chosen into an alert, which is the only asset that compounds.
 *
 * Shown only once filters are actually set, so it can never offer to alert
 * on "every car in stock" (which the API rejects anyway).
 */
export default function SaveSearchPrompt({
  filters,
  matchCount,
}: {
  filters: Record<string, string>;
  matchCount: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const active = Object.entries(filters).filter(([, v]) => v);
  if (active.length === 0) return null;

  const pretty = (v: string) => v.replace(/\b\w/g, (c) => c.toUpperCase());
  const summary = active
    .map(([k, v]) =>
      k === "Make" || k === "Model" || k === "Fuel" ? pretty(v) : k === "maxPrice" ? `under €${Number(v).toLocaleString()}` : v,
    )
    .slice(0, 4)
    .join(" · ");

  async function save() {
    if (!isTokenValid()) {
      // Send them to sign-up and bring them straight back to this search.
      const back = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/used-cars";
      router.push(`/sign-up?redirect=${encodeURIComponent(back)}`);
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/save-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ params: filters }),
      });
      const data = await res.json();
      if (res.ok && data?.ResponseCode !== "0") {
        setState("saved");
      } else {
        setState("error");
        setMessage(data?.ResponseText || "Could not save that search.");
      }
    } catch {
      setState("error");
      setMessage("Could not save that search.");
    }
  }

  if (state === "saved") {
    return (
      <div className={styles.alertPrompt}>
        <BellRing size={17} strokeWidth={1.9} aria-hidden="true" />
        <p className={styles.alertPromptText}>
          <strong>Alert saved.</strong> We&rsquo;ll email you when a car matching this search arrives.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.alertPrompt}>
      <BellRing size={17} strokeWidth={1.9} aria-hidden="true" />
      <p className={styles.alertPromptText}>
        <strong>Not found it yet?</strong> We add UK stock every day. Get an email the moment the next{" "}
        {summary ? <em>{summary}</em> : "matching car"} lands.
      </p>
      <button type="button" className={styles.alertPromptBtn} onClick={save} disabled={state === "saving"}>
        {state === "saving" ? "Saving…" : "Email me new matches"}
      </button>
      {state === "error" && <span className={styles.alertPromptErr}>{message}</span>}
    </div>
  );
}
