"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { isTokenValid, authHeaders } from "@/lib/auth";
import { titleCaseMake } from "@/lib/warrantyGuide";
import { savedSearchParams, usedCarsQuery, type SearchValue } from "@/lib/savedSearch";
import { clearPendingAlert, readPendingAlert, rememberPendingAlert } from "@/lib/memberReturn";
import SignInSlideOver from "../components/SignInSlideOver";
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

// Website review 3 Oct 2026 #52: makes arrive lower-case ("bmw") and
// capitalising each word printed "Bmw". titleCaseMake is the site's make
// display (BMW, MG, BYD, DS, SEAT, MINI, Mercedes-Benz). Models follow
// displayModel() in import/ImportLanding.tsx, a server module this client
// component cannot import.
function words(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function modelLabel(make: string, model: string): string {
  const m = model.trim();
  const mk = make.toLowerCase();
  if (mk === "bmw" && /^i[x0-9][a-z0-9]*$/i.test(m)) return "i" + m.slice(1).toUpperCase();
  if (mk === "hyundai" && /^i\d+$/i.test(m)) return m.toLowerCase();
  if (/[\s-]/.test(m)) {
    if (/^[a-z]{1,3}-[a-z]{1,3}$/i.test(m)) return m.toUpperCase();
    return words(m).replace(/\b([A-Za-z]{1,3})(?=\d|-\d)/g, (c) => c.toUpperCase());
  }
  if (/^[a-z]+$/.test(m)) return m.length <= 3 ? m.toUpperCase() : words(m);
  if (/^[a-z]{1,2}\d+[a-z]*$/.test(m)) return m.toUpperCase();
  return m;
}

const euro = (v: string) => `€${Number(v).toLocaleString("en-IE")}`;
const km = (v: string) => `${Number(v).toLocaleString("en-IE")} km`;

// One short phrase per filter, in the order a buyer would say them.
function describe(f: Record<string, SearchValue>): string[] {
  const s = (k: string) => (typeof f[k] === "string" ? (f[k] as string).trim() : "");
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]).map((c) => c.trim()).filter(Boolean) : []);
  const parts: string[] = [];
  const name = [s("Make") ? titleCaseMake(s("Make")) : "", s("Model") ? modelLabel(s("Make"), s("Model")) : ""]
    .filter(Boolean)
    .join(" ");
  if (name) parts.push(name);
  // Website review 3 Oct 2026 #26: version and feature chips are part of the
  // search the buyer is looking at, so the prompt names them too.
  for (const c of [...list("versionChips"), ...list("searchChips")]) {
    parts.push(c.startsWith("-") ? `no ${c.slice(1)}` : c);
  }
  if (s("Fuel")) parts.push(words(s("Fuel")));
  if (s("body_style")) parts.push(s("body_style"));
  if (s("transmission_type")) parts.push(s("transmission_type"));
  const eMin = s("minEnginesize");
  const eMax = s("maxEnginesize");
  if (eMin && eMax) parts.push(eMin === eMax ? `${eMin} L` : `${eMin}–${eMax} L`);
  else if (eMin) parts.push(`${eMin} L or more`);
  else if (eMax) parts.push(`up to ${eMax} L`);
  if (s("seats")) parts.push(/^\d+$/.test(s("seats")) ? `${s("seats")} seats` : s("seats"));
  if (s("color")) parts.push(s("color"));
  const yMin = s("minYear");
  const yMax = s("maxYear");
  if (yMin && yMax) parts.push(yMin === yMax ? yMin : `${yMin}–${yMax}`);
  else if (yMin) parts.push(`${yMin} or newer`);
  else if (yMax) parts.push(`${yMax} or older`);
  if (s("minPrice")) parts.push(`from ${euro(s("minPrice"))}`);
  if (s("maxPrice")) parts.push(`under ${euro(s("maxPrice"))}`);
  if (s("minMileage")) parts.push(`over ${km(s("minMileage"))}`);
  if (s("maxMileage")) parts.push(`under ${km(s("maxMileage"))}`);
  if (s("belowCheapest")) parts.push("cheaper than every Irish listing");
  else if (s("minSaving")) parts.push(`${euro(s("minSaving"))}+ under Ireland`);
  else if (s("bestsellerSeries")) parts.push("Bestsellers");
  return parts;
}

export default function SaveSearchPrompt({
  filters,
  matchCount,
}: {
  filters: Record<string, SearchValue>;
  matchCount: number;
}) {
  const [signInOpen, setSignInOpen] = useState(false);

  const parts = describe(filters);
  const params = savedSearchParams(filters);
  const qp = parts.length > 0 ? JSON.stringify(params) : "";

  // Now that saving works, the outcome is tied to the search it was for: change
  // a filter after "Alert saved." and the prompt offers the new search.
  const [status, setStatus] = useState<{ qp: string; state: "saving" | "saved" | "error"; message: string } | null>(null);
  const state = status && status.qp === qp ? status.state : "idle";
  const message = status?.message ?? "";
  const label = parts.join(" · ").slice(0, 200);
  const query = usedCarsQuery(params);
  const url = query ? `/used-cars?${query}` : "/used-cars";

  async function save(alert: { qp: string; label: string }) {
    setStatus({ qp: alert.qp, state: "saving", message: "" });
    try {
      const res = await fetch("/api/save-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        // Website review 3 Oct 2026 #6: the API reads query_params as JSON
        // text (CarsNewTwoController::saveSearch). This used to send
        // {params: {...}}, so every save was refused with "query_params must
        // be a JSON-encoded object" and no member could hold a saved search.
        body: JSON.stringify({ query_params: alert.qp, label: alert.label }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && String(data?.ResponseCode) === "1") {
        clearPendingAlert();
        setStatus({ qp: alert.qp, state: "saved", message: "" });
      } else {
        // A refusal (ResponseCode 0) will not change on a retry, so stop carrying it.
        if (String(data?.ResponseCode) === "0") clearPendingAlert();
        setStatus({ qp: alert.qp, state: "error", message: data?.ResponseText || "Could not save that search." });
      }
    } catch {
      setStatus({ qp: alert.qp, state: "error", message: "Could not save that search." });
    }
  }

  // Website review 3 Oct 2026 #25: an alert asked for while signed out is
  // saved once the member is back on the same search, signed in -- after
  // signing up and confirming, SignInForm returns them here.
  const pendingTried = useRef(false);
  useEffect(() => {
    if (pendingTried.current || !qp) return;
    const pending = readPendingAlert();
    if (!pending || pending.qp !== qp || !isTokenValid()) return;
    // A tick later, so the save's own state updates happen outside the effect body.
    const timer = setTimeout(() => {
      pendingTried.current = true;
      void save(pending);
    }, 0);
    return () => clearTimeout(timer);
  }, [qp]);

  if (parts.length === 0) return null;

  const summary = parts.length > 5 ? `${parts.slice(0, 5).join(" · ")} + ${parts.length - 5} more` : parts.join(" · ");

  function handleClick() {
    if (!isTokenValid()) {
      // Website review 3 Oct 2026 #25: this used to send the visitor to
      // /sign-up with a ?redirect= nothing read, losing the search. Sign in
      // right here, as Save car does, and remember the alert in case they
      // go on to create an account (closing the panel forgets it).
      rememberPendingAlert({ qp, label, url });
      setSignInOpen(true);
      return;
    }
    void save({ qp, label });
  }

  function handleSignedIn() {
    setSignInOpen(false);
    void save({ qp, label });
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
    <>
      <div className={styles.alertPrompt}>
        <BellRing size={17} strokeWidth={1.9} aria-hidden="true" />
        <p className={styles.alertPromptText}>
          <strong>Not found it yet?</strong> We add UK stock every day. Get an email the moment the next{" "}
          <em>{summary}</em> lands.
        </p>
        <button type="button" className={styles.alertPromptBtn} onClick={handleClick} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Email me new matches"}
        </button>
        {state === "error" && <span className={styles.alertPromptErr}>{message}</span>}
      </div>
      <SignInSlideOver
        open={signInOpen}
        onClose={() => {
          clearPendingAlert();
          setSignInOpen(false);
        }}
        onSuccess={handleSignedIn}
        title="Sign in to get email alerts"
        subtext={"We’ll email you the moment a car matching this search arrives."}
        submitLabel="Sign in and save alert"
        returnTo={url}
      />
    </>
  );
}
