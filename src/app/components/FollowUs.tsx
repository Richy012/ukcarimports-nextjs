"use client";

/**
 * Follow prompt — Facebook only, deliberately.
 *
 * Owner review 2026-08-09: 83 followers on Facebook, 1 on Instagram. With
 * numbers that small you concentrate rather than spread, and four icons in a
 * row converts worse than one clear ask because people choose nothing.
 * Facebook is where Irish car buyers in their 30s-60s actually are; LinkedIn
 * gets its own ask on the dealer pages, not here.
 *
 * The ask is not "follow us" — that is ignorable. It is the offer that the
 * 6pm post now makes real: see the best arrival of the day before it is
 * listed here.
 *
 * Dismissible, remembered, and it never competes with SaveSearchPrompt: an
 * email alert is worth more than a follow, so on /used-cars this only appears
 * when no filters are set.
 */

import { useEffect, useState } from "react";

const KEY = "ukci_follow_dismissed_v1";
const FB = "https://www.facebook.com/ukcarimports";

export function FollowStrip({ suppressed = false }: { suppressed?: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    // only once they have actually looked at something
    const onScroll = () => {
      if (window.scrollY > 900) {
        setShow(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show || suppressed) return null;

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div style={wrap} role="complementary" aria-label="Follow us on Facebook">
      <div style={inner}>
        <span style={text}>
          <strong>The best car of the day goes up at 6pm</strong> — on Facebook,
          before it&rsquo;s listed here.
        </span>
        <a
          href={FB + "?utm_source=site&utm_medium=strip&utm_campaign=follow"}
          target="_blank"
          rel="noopener noreferrer"
          style={cta}
          onClick={dismiss}
        >
          Follow on Facebook
        </a>
        <button onClick={dismiss} style={close} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}

/** One quiet line, for a car page. No box, no icons. */
export function FollowLine({ daysListed }: { daysListed?: number }) {
  return (
    <p style={line}>
      {typeof daysListed === "number" && daysListed >= 0 && (
        <>This landed {daysListed === 0 ? "today" : daysListed === 1 ? "yesterday" : `${daysListed} days ago`}. </>
      )}
      Cars like it don&rsquo;t hang about —{" "}
      <a
        href={FB + "?utm_source=site&utm_medium=carpage&utm_campaign=follow"}
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
      >
        see tomorrow&rsquo;s best arrival on Facebook
      </a>{" "}
      before it reaches the site.
    </p>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 60,
  background: "#111214",
  color: "#fff",
  borderTop: "3px solid #b60b0c",
  boxShadow: "0 -6px 24px rgba(0,0,0,.25)",
};
const inner: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};
const text: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.45, flex: 1, minWidth: 220 };
const cta: React.CSSProperties = {
  background: "#b60b0c",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  padding: "10px 18px",
  borderRadius: 6,
  whiteSpace: "nowrap",
};
const close: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9a9a9d",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
  padding: "0 4px",
};
const line: React.CSSProperties = { fontSize: 13.5, color: "#5c5c5c", margin: "10px 0 0", lineHeight: 1.6 };
const linkStyle: React.CSSProperties = { color: "#b60b0c", fontWeight: 600 };
