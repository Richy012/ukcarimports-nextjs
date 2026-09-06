"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * The "WORKING DRAFT — staging" strip. Shows ONLY on the staging host, so the same
 * source can run on production without the strip ever appearing there (6 Sep 2026:
 * the trade-in module went live and the strips came with it).
 */
export default function DraftBanner({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(/^staging\./i.test(window.location.hostname) || window.location.hostname === "localhost");
  }, []);
  return show ? <div style={style}>{children}</div> : null;
}
