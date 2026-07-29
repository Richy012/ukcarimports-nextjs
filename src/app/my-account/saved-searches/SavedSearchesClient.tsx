"use client";

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

function buildQueryString(queryParams: string): string {
  let params: Record<string, unknown>;
  try {
    params = JSON.parse(queryParams);
  } catch {
    params = {};
  }
  return Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== null && params[k] !== undefined)
    .map((k) => {
      const v = params[k];
      return encodeURIComponent(k) + "=" + encodeURIComponent(typeof v === "object" ? JSON.stringify(v) : String(v));
    })
    .join("&");
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
        We check every 15 minutes and email you when new cars match a saved search. You can unsubscribe from
        those emails any time using the link at the bottom of one.
      </p>

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
              <span className={styles.searchIcon} aria-hidden="true">🔍</span>
              <div className={styles.searchBody}>
                <div className={styles.searchLabel}>{s.label}</div>
                <div className={styles.searchMeta}>Saved on {s.created_at}</div>
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
