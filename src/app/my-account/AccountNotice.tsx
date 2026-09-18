"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authHeaders, isTokenValid } from "@/lib/auth";

// Shown in the members area to anyone who has joined but saved nothing.
//
// Owner, 2026-08-24: "anyone who doesn't have a search of some sort gets deleted
// automatically - tell them that", and "what are they members for if not
// searching for a car?"
//
// Measured the same day before building: 23 of 33 active members had saved
// nothing at all, and EVERY ONE of them had signed up within the previous 30
// days. So this is deliberately a prompt first and a warning second -- those
// people had joined and never been asked to do anything, which is the same gap
// that shows up as 6 leads in the site's entire history. Deleting them silently
// would have removed the evidence rather than the problem.
//
// It renders nothing at all once the member has a single saved car or search.

export default function AccountNotice() {
  const [empty, setEmpty] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isTokenValid()) return;
    Promise.all([
      fetch("/api/saved-cars", { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/saved-searches", { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([cars, searches]) => {
        const nCars = Array.isArray(cars?.data) ? cars.data.length : 0;
        const nSearches = Array.isArray(searches?.data) ? searches.data.length : 0;
        setEmpty(nCars === 0 && nSearches === 0);
      })
      .catch(() => setEmpty(null));
  }, []);

  if (empty !== true) return null;

  return (
    <div
      style={{
        border: "1px solid #f0c36d",
        background: "#fff8e6",
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 24,
      }}
    >
      <strong style={{ display: "block", fontSize: "1.05em", marginBottom: 6 }}>
        Save a car or a search to keep your account
      </strong>
      <p style={{ margin: "0 0 14px", lineHeight: 1.55 }}>
        Your account is what tells us what you&rsquo;re looking for. Save a car you like, or save a
        search, and we&rsquo;ll email you the moment a matching one lands — usually before it reaches
        the Irish market. <strong>Accounts with no saved car or search are removed after 30 days.</strong>
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/used-cars"
          style={{
            padding: "9px 16px",
            borderRadius: 6,
            background: "#c8102e",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Browse cars
        </Link>
        <Link
          href="/used-cars?bestseller=1"
          style={{
            padding: "9px 16px",
            borderRadius: 6,
            border: "1px solid #ccc",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          See the best value ones
        </Link>
      </div>
    </div>
  );
}
