"use client";

import { useEffect } from "react";

/**
 * Reports an arrival from one of our social adverts, once per page load.
 *
 * Runs after mount and ignores every failure: measurement must never cost a
 * visitor their page. Sends nothing unless a utm_campaign is present, so
 * ordinary traffic is untouched.
 */
export default function SocialClickBeacon() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const campaign = p.get("utm_campaign");
      if (!campaign) return;

      const m = window.location.pathname.match(/^\/car\/(\d+)/);
      fetch("/api/social-click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaign,
          source: p.get("utm_source"),
          carId: m ? m[1] : null,
          path: window.location.pathname,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never let tracking break a page */
    }
  }, []);

  return null;
}
