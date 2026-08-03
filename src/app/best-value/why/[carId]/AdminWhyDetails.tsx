"use client";

import { useEffect, useState } from "react";
import { isAdminTokenValid, staffAuthHeaders } from "@/lib/auth";

// Staff-only: the full Irish-ad detail behind a maths page (ad text, exact
// mileage, county, dealer, link). Public visitors get nothing — the endpoint
// authenticates server-side, and this component renders null without a valid
// staff token, so no identifying advert data ever reaches a public browser.
interface FullMatch {
  irish_version?: string;
  irish_year: number;
  irish_mileage_km?: number | null;
  irish_price: number;
  irish_county?: string | null;
  irish_dealer?: string | null;
  irish_url?: string | null;
  match_score: number;
}

interface StaffWhy {
  matches: FullMatch[];
  segment_ads: {
    irish_version: string;
    irish_year: number;
    irish_mileage_km: number | null;
    irish_price: number;
    irish_county: string | null;
  }[];
}

export default function AdminWhyDetails({ carId }: { carId: string }) {
  const [data, setData] = useState<StaffWhy | null>(null);

  useEffect(() => {
    if (!isAdminTokenValid()) return;
    fetch(`/api/staff-why/${carId}`, { headers: staffAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d?.data ?? null))
      .catch(() => {});
  }, [carId]);

  if (!data) return null;

  const cell: React.CSSProperties = { padding: "4px 8px", borderBottom: "1px solid #eee", fontSize: 13 };
  return (
    <section style={{ border: "2px dashed #b60b0c", borderRadius: 8, padding: "12px 16px", margin: "18px 0" }}>
      <p style={{ fontWeight: 700, color: "#b60b0c", marginBottom: 8 }}>
        Staff only — full Irish ad detail (never shown publicly)
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Ad text", "Year", "Km", "County", "Dealer", "Asking", "Score", ""].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matches.map((m, i) => (
              <tr key={`m${i}`}>
                <td style={cell}><strong>MATCHED:</strong> {m.irish_version}</td>
                <td style={cell}>{m.irish_year}</td>
                <td style={cell}>{m.irish_mileage_km?.toLocaleString() ?? "—"}</td>
                <td style={cell}>{m.irish_county ?? "—"}</td>
                <td style={cell}>{m.irish_dealer ?? "—"}</td>
                <td style={cell}>€{Math.round(m.irish_price).toLocaleString()}</td>
                <td style={cell}>{m.match_score}</td>
                <td style={cell}>
                  {m.irish_url ? (
                    <a href={m.irish_url} target="_blank" rel="noreferrer">ad ↗</a>
                  ) : null}
                </td>
              </tr>
            ))}
            {data.segment_ads.map((a, i) => (
              <tr key={`s${i}`}>
                <td style={cell}>{a.irish_version}</td>
                <td style={cell}>{a.irish_year}</td>
                <td style={cell}>{a.irish_mileage_km?.toLocaleString() ?? "—"}</td>
                <td style={cell}>{a.irish_county ?? "—"}</td>
                <td style={cell}>—</td>
                <td style={cell}>€{Math.round(a.irish_price).toLocaleString()}</td>
                <td style={cell}>—</td>
                <td style={cell}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
