"use client";

import { useEffect } from "react";

/**
 * A link to /faq#faq-<id> lands on a closed <details>: the browser scrolls to
 * it but the answer stays folded. Owner 17 Sep 2026: "have the link to bank
 * finance open the exact FAQ". Opens the targeted question on load and on
 * every hash change, then scrolls it into view under the header.
 */
export default function FaqHashOpener() {
  useEffect(() => {
    const openHash = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!id) return;
      const el = document.getElementById(id);
      if (!(el instanceof HTMLDetailsElement)) return;
      el.open = true;
      window.setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, []);
  return null;
}
