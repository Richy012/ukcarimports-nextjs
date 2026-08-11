"use client";

// Upgrades the static "Back to all cars" link into "Back to your search
// results" when this tab arrived from the listing (ucScrollReturn stash is
// present). history.back() keeps the browser's page cache, so the listing's
// deep-scroll restore does the rest. Server HTML stays identical for every
// visitor — the car page is edge-cached, so per-user state must never render
// on the server.
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BackToResults({ className }: { className?: string }) {
  const [hasReturn, setHasReturn] = useState(false);

  useEffect(() => {
    // A referrer check fails here: the site navigates client-side, so
    // document.referrer is whatever loaded the FIRST page of the session
    // (empty when the address was typed). The honest signal is the stash the
    // listing writes on tile click — same tab, and recent.
    try {
      const raw = sessionStorage.getItem("ucScrollReturn");
      if (!raw) return;
      const stash = JSON.parse(raw) as { t?: number };
      const fresh = typeof stash.t === "number" && Date.now() - stash.t < 30 * 60 * 1000;
      if (fresh && history.length > 1) setHasReturn(true);
    } catch {
      /* storage blocked: keep the plain link */
    }
  }, []);

  if (hasReturn) {
    return (
      <a
        href="/used-cars"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          history.back();
        }}
      >
        &larr; Back to your search results
      </a>
    );
  }
  return (
    <Link href="/used-cars" className={className}>
      &larr; Back to all cars
    </Link>
  );
}
