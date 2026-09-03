"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";

interface SavedSearch {
  id: number;
  label: string;
  created_at: string;
  query_params: string;
}

// The listing page reads three of the API's parameter names under other names.
const URL_KEYS: Record<string, string> = { bestsellerSeries: "bestseller", minSaving: "min_saving", belowCheapest: "below_cheapest" };

function parseParams(queryParams: string): Record<string, unknown> {
  try {
    const p = JSON.parse(queryParams);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function buildQueryString(queryParams: string): string {
  const params = parseParams(queryParams);
  return Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== null && params[k] !== undefined)
    .map((k) => {
      const v = params[k];
      return encodeURIComponent(URL_KEYS[k] ?? k) + "=" + encodeURIComponent(typeof v === "object" ? JSON.stringify(v) : String(v));
    })
    .join("&");
}

// Bestseller ladder (owner 2026-09-03): "only email me when the car is at
// least this much under the Irish market". Stored on the search itself as
// the same minSaving / belowCheapest the listing filters use, so the alert
// pipeline (which replays the saved params) needs no change.
const LADDER_OPTIONS = [
  { value: "", label: "any price" },
  { value: "750", label: "\u20ac750+ under Ireland" },
  { value: "1000", label: "\u20ac1,000+ under Ireland" },
  { value: "1500", label: "\u20ac1,500+ under Ireland" },
  { value: "2000", label: "\u20ac2,000+ under Ireland" },
  { value: "2500", label: "\u20ac2,500+ under Ireland (Bestseller)" },
  { value: "5000", label: "\u20ac5,000+ under Ireland (#1 Bestseller)" },
  { value: "cheapest", label: "cheaper than every Irish listing" },
];

function ladderValue(params: Record<string, unknown>): string {
  if (params.belowCheapest) return "cheapest";
  const v = String(params.minSaving ?? "").replace(/\D/g, "");
  return v;
}

function withLadder(params: Record<string, unknown>, value: string): Record<string, unknown> {
  const p = { ...params };
  delete p.minSaving;
  delete p.belowCheapest;
  delete p.bestsellerSeries;
  if (value === "cheapest") {
    p.belowCheapest = "1";
    p.bestsellerSeries = "1";
  } else if (value) {
    p.minSaving = value;
    p.bestsellerSeries = "1";
  }
  return p;
}

export default function SavedSearchesClient() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTokenValid()) {
      window.location.href = "/sign-in";
      return;
    }

    fetch(`/api/saved-searches`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setSearches(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [ladderError, setLadderError] = useState("");

  async function changeLadder(s: SavedSearch, value: string) {
    const next = withLadder(parseParams(s.query_params), value);
    const nextJson = JSON.stringify(next);
    const previous = s.query_params;
    setLadderError("");
    setSavingId(s.id);
    // Optimistic: the select reflects the choice at once, reverted on failure.
    setSearches((prev) => prev.map((x) => (x.id === s.id ? { ...x, query_params: nextJson } : x)));
    try {
      const res = await fetch(`/api/saved-searches/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ query_params: nextJson, label: s.label }),
      });
      const data = await res.json();
      if (!res.ok || String(data?.ResponseCode) === "0") {
        setSearches((prev) => prev.map((x) => (x.id === s.id ? { ...x, query_params: previous } : x)));
        setLadderError(data?.ResponseText || "Could not update that search.");
      }
    } catch {
      setSearches((prev) => prev.map((x) => (x.id === s.id ? { ...x, query_params: previous } : x)));
      setLadderError("Could not update that search.");
    } finally {
      setSavingId(null);
    }
  }

  function deleteSearch(id: number) {
    fetch(`/api/saved-searches/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ResponseCode === "1" || data.ResponseCode === 1) {
          setSearches((prev) => prev.filter((s) => s.id !== id));
        }
      })
      .catch(() => {});
  }

  return (
    <>
      <h1 className={styles.heading}>My Saved Searches</h1>
      <p className={styles.intro}>
        We check every 15 minutes and email you when new cars match a saved search (never between 10pm and
        7am). Set a minimum saving on any search to hear only about cars priced that much under the Irish
        market. You can unsubscribe from those emails any time using the link at the bottom of one.
      </p>

      {ladderError ? <p className={styles.ladderError} role="alert">{ladderError}</p> : null}

      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : searches.length === 0 ? (
        <p className={styles.empty}>
          You haven&apos;t saved any searches yet. Filter our <Link href="/used-cars">used cars</Link> the way
          you like, then save the search to get emailed when new matches appear.
        </p>
      ) : (
        <div className={styles.searchList}>
          {searches.map((s) => (
            <div className={styles.searchCard} key={s.id}>
              <span className={styles.searchIcon} aria-hidden="true"><Search size={16} strokeWidth={1.75} /></span>
              <div className={styles.searchBody}>
                <div className={styles.searchLabel}>{s.label}</div>
                <div className={styles.searchMeta}>Saved on {s.created_at}</div>
                <label className={styles.ladderRow}>
                  Only email me when a match is{" "}
                  <select
                    className={styles.ladderSelect}
                    value={ladderValue(parseParams(s.query_params))}
                    disabled={savingId === s.id}
                    onChange={(e) => changeLadder(s, e.target.value)}
                    aria-label={`Minimum saving vs the Irish market for ${s.label}`}
                  >
                    {LADDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.searchActions}>
                <Link href={`/used-cars?${buildQueryString(s.query_params)}`} className={styles.actionBtn}>
                  View results
                </Link>
                <button type="button" className={styles.deleteBtn} onClick={() => deleteSearch(s.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
