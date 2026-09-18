"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";

// Admin > Fees. The UKCI service-fee bands, keyed on the CAR PRICE IN EURO.
//
// Owner, 2026-08-24: "I should be able to update these to change the amount."
// Context: three sales that month and the fee has to cover the costs, so this
// is a survival control, not a nice-to-have.
//
// Note for whoever edits this next: the band applies to the car's price
// converted to euro, NOT the landed total. The fee is part of the landed total,
// so banding on the total would be circular.

interface Band {
  id?: number;
  min_eur: number | string;
  max_eur: number | string | null;
  fee_eur: number | string;
}

const euro = (n: number) => "€" + Math.round(n).toLocaleString();

export default function FeesClient() {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [example, setExample] = useState("35000");

  function load() {
    fetch("/api/staff-fee-bands", { headers: staffAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setBands(d?.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function update(i: number, field: keyof Band, value: string) {
    setBands((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function addRow() {
    setBands((prev) => [...prev, { min_eur: "", max_eur: "", fee_eur: "" }]);
  }

  function removeRow(i: number) {
    setBands((prev) => prev.filter((_, x) => x !== i));
  }

  function save() {
    setSaving(true);
    setMsg(null);
    fetch("/api/staff-fee-bands", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({
        bands: bands.map((b) => ({
          min_eur: b.min_eur,
          max_eur: b.max_eur === "" ? null : b.max_eur,
          fee_eur: b.fee_eur,
        })),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        setMsg(d?.ResponseText || "Saved");
        if (d?.ResponseCode == 1) load();
      })
      .catch(() => setMsg("Save failed"))
      .finally(() => setSaving(false));
  }

  // Mirrors feeForEur() on the server: first band whose "to" is at or above the
  // price. Written the same way so the preview cannot disagree with the site.
  function feeFor(priceEur: number): number | null {
    for (const b of bands) {
      const max = b.max_eur === "" || b.max_eur === null ? Infinity : Number(b.max_eur);
      if (priceEur <= max) return Number(b.fee_eur);
    }
    return bands.length ? Number(bands[bands.length - 1].fee_eur) : null;
  }

  const exampleFee = feeFor(Number(example) || 0);

  const cell: React.CSSProperties = {
    padding: "6px 8px",
    border: "1px solid #ddd",
    borderRadius: 6,
    width: 130,
    font: "inherit",
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Fees</h1>
        <span style={{ opacity: 0.65, fontSize: "0.9em" }}>
          Our service fee, by the car&rsquo;s price in euro
        </span>
      </div>

      <p style={{ maxWidth: 760, opacity: 0.8, lineHeight: 1.5 }}>
        This is the fee added to every car. It is banded on the{" "}
        <strong>car&rsquo;s price converted to euro</strong> — not the landed total, because the fee
        is part of that total. Leave the last band&rsquo;s <em>To</em> blank so every car gets a fee.
        Changes re-price the whole site on the next refresh, which runs every 5 minutes.
      </p>

      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <table style={{ borderCollapse: "separate", borderSpacing: "0 6px" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: "0.85em", opacity: 0.7 }}>
                <th style={{ paddingRight: 12 }}>From (€)</th>
                <th style={{ paddingRight: 12 }}>To (€)</th>
                <th style={{ paddingRight: 12 }}>Our fee (€)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: 12 }}>
                    <input
                      style={cell}
                      value={b.min_eur ?? ""}
                      onChange={(e) => update(i, "min_eur", e.target.value)}
                      inputMode="numeric"
                    />
                  </td>
                  <td style={{ paddingRight: 12 }}>
                    <input
                      style={cell}
                      value={b.max_eur ?? ""}
                      placeholder={i === bands.length - 1 ? "no limit" : ""}
                      onChange={(e) => update(i, "max_eur", e.target.value)}
                      inputMode="numeric"
                    />
                  </td>
                  <td style={{ paddingRight: 12 }}>
                    <input
                      style={{ ...cell, fontWeight: 600 }}
                      value={b.fee_eur ?? ""}
                      onChange={(e) => update(i, "fee_eur", e.target.value)}
                      inputMode="numeric"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#b00020",
                        cursor: "pointer",
                        font: "inherit",
                        opacity: 0.7,
                      }}
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
            <button
              type="button"
              onClick={addRow}
              style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", font: "inherit", cursor: "pointer" }}
            >
              Add band
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                border: "none",
                background: "#c8102e",
                color: "#fff",
                font: "inherit",
                fontWeight: 600,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save fees"}
            </button>
            {msg && <span style={{ fontSize: "0.9em", opacity: 0.8 }}>{msg}</span>}
          </div>

          <div style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 8, maxWidth: 520 }}>
            <strong>Check a price</strong>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
              <span>Car price €</span>
              <input
                style={cell}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                inputMode="numeric"
              />
              <span style={{ fontWeight: 700 }}>
                → fee {exampleFee === null ? "—" : euro(exampleFee)}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "0.85em", opacity: 0.7 }}>
              Uses the same rule as the site: the first band whose <em>To</em> is at or above the
              price.
            </p>
          </div>
        </>
      )}
    </>
  );
}
