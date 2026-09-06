"use client";

import { useState } from "react";
import { AD_LINE } from "@/lib/aboveBoard";

/** The advert line in a quote box with a one-click copy. Used on the buyer page's seller strip. */
export default function CopyLine() {
  const [done, setDone] = useState(false);
  return (
    <div>
      <div style={Q}>&ldquo;{AD_LINE}&rdquo;</div>
      <button
        type="button"
        style={B}
        onClick={() => { void navigator.clipboard?.writeText(AD_LINE); setDone(true); }}
      >
        {done ? "Copied" : "Copy the line"}
      </button>
    </div>
  );
}

const Q: React.CSSProperties = { fontSize: 14, color: "#111", fontStyle: "italic", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "10px 12px", lineHeight: 1.5 };
const B: React.CSSProperties = { marginTop: 8, padding: "7px 14px", border: "1px solid #b60b0c", background: "#fff", color: "#b60b0c", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" };
