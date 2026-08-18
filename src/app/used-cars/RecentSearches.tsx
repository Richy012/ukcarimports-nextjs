"use client";

// "Recent searches" chips — AutoTrader-style memory without login. Written by
// applyFilters into localStorage (last 6, deduped by query string); rendered
// only after mount so SSR HTML is identical for everyone. The row keeps a
// RESERVED fixed height whether empty or full, so appearing chips can never
// shift the layout (the CLS lesson from the external audit).
import Link from "next/link";
import { useEffect, useState } from "react";

export type RecentSearch = { label: string; qs: string; t: number };

export const RECENT_KEY = "ucRecentSearches";

export function rememberSearch(label: string, qs: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    let list: RecentSearch[] = raw ? JSON.parse(raw) : [];
    list = list.filter((x) => x.qs !== qs);
    list.unshift({ label: label || "All cars", qs, t: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* private mode: fine */
  }
}

export default function RecentSearches() {
  const [items, setItems] = useState<RecentSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // A bare <div> has the generic role, which forbids aria-label (Lighthouse
  // aria-prohibited-attr). role="region" makes it a named landmark instead.
  return (
    <div
      role="region"
      aria-label="Recent searches"
      style={{
        minHeight: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "nowrap",
        overflowX: "auto",
        padding: "4px 0",
      }}
    >
      {items.length > 0 && (
        <>
          <span style={{ fontSize: "0.78rem", color: "#777", flex: "0 0 auto" }}>
            Recent searches:
          </span>
          {items.map((x) => (
            <Link
              key={x.qs || "all"}
              href={x.qs ? `/used-cars?${x.qs}` : "/used-cars"}
              style={{
                flex: "0 0 auto",
                fontSize: "0.78rem",
                padding: "4px 10px",
                borderRadius: 14,
                border: "1px solid #ddd",
                background: "#fafafa",
                color: "#333",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {x.label}
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
