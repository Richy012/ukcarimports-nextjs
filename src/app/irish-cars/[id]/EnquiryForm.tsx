"use client";

import { useState } from "react";

/** Enquiry on an Irish (Above Board Cars) car. Goes to us, never straight to the seller. */
export default function EnquiryForm({ id, title }: { id: string; title: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setState("sending");
    try {
      const r = await fetch("/api/irish-cars", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, email, phone, message }),
      });
      const j = await r.json();
      setState(j?.ok ? "sent" : "error");
    } catch { setState("error"); }
  }

  if (state === "sent") {
    return <p style={{ color: "#0a7d33", fontSize: 14 }}>Thanks &mdash; we have your enquiry about the {title} and will come back to you shortly.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <input style={I} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={I} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input style={I} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <textarea style={{ ...I, minHeight: 90 }} placeholder="Anything you want to ask about the car" value={message} onChange={(e) => setMessage(e.target.value)} />
      <button type="button" disabled={state === "sending"} onClick={send}
              style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#b60b0c", color: "#fff", fontWeight: 700 }}>
        {state === "sending" ? "Sending…" : "Send my enquiry"}
      </button>
      {state === "error" && <div style={{ color: "#b91c1c", fontSize: 13 }}>Please give your name and a valid email.</div>}
      <div style={{ fontSize: 12.5, color: "#64748b" }}>We pass your enquiry to the owner and arrange the viewing and inspection. Your details are not published.</div>
    </div>
  );
}

const I: React.CSSProperties = { padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontFamily: "inherit" };
