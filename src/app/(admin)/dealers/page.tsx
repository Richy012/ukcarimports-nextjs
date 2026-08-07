"use client";

import { useCallback, useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";

/**
 * Dealer registry -- the direct-feed programme.
 *
 * Three separate states, never conflated:
 *   permitted - their published rules allow it
 *   ready     - we know how to read their stock (a site can be permitted but
 *               unreadable: V12 allows us, yet draws its listings with
 *               JavaScript, so plain HTML collection returns nothing)
 *   approved  - the owner has ticked it. Nothing is collected without this.
 */

type Group = {
  group_name: string;
  branches: number;
  cars: number;
  avg_landed: number | null;
  badged: number;
  own_website: string | null;
  collect: "yes" | "no" | null;
  reason: string | null;
  platform: string | null;
  stock_render: "html" | "js" | "unknown" | null;
  stock_url: string | null;
  ready: number;
  ready_note: string | null;
  approved: number;
};

const eur = (n: number | null) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

export default function DealersPage() {
  const [rows, setRows] = useState<Group[]>([]);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [view, setView] = useState<"ready" | "yes" | "no" | "">("ready");
  const [minCars, setMinCars] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ min_cars: String(minCars) });
    if (view === "yes" || view === "no") qs.set("verdict", view);
    fetch(`/api/admin-dealer-registry?${qs}`, {
      headers: staffAuthHeaders(),
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        let g: Group[] = j?.data?.groups ?? [];
        if (view === "ready") g = g.filter((x) => Number(x.ready) === 1);
        setRows(g);
        setTotals(j?.data?.totals ?? null);
      })
      .catch(() => {});
  }, [view, minCars]);

  useEffect(load, [load]);

  const approve = (group: string, on: boolean) => {
    setBusy(group);
    fetch("/api/admin-dealer-approve", {
      method: "POST",
      headers: { ...staffAuthHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ group_name: group, approved: on }),
    })
      .then(() => load())
      .finally(() => setBusy(null));
  };

  const th = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #eee",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "#666",
  };
  const td = { padding: "9px 10px", borderBottom: "1px solid #f2f2f2", fontSize: 14 };

  return (
    <main style={{ padding: "28px 24px", maxWidth: 1320, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, color: "#b60b0c", marginBottom: 4 }}>Dealers</h1>
      <p style={{ color: "#666", marginBottom: 18, fontSize: 14, maxWidth: 840 }}>
        Every dealer supplying our stock. <strong>Ready</strong> means we have
        checked their site and know how to read their vehicles.{" "}
        <strong>Nothing is collected from any garage until you tick it.</strong>{" "}
        A garage can be permitted but not ready — some sites draw their stock with
        JavaScript, which needs a different kind of collector.
      </p>

      {totals && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            [totals.grps, "dealer groups"],
            [totals.with_website, "sites found"],
            [totals.ready_branches, "ready to add"],
            [totals.approved_branches, "you have approved"],
            [totals.approved_cars, "cars approved"],
            [totals.no_branches, "declined (they refuse bots)"],
          ].map(([v, label]) => (
            <div
              key={String(label)}
              style={{
                background: "#fff",
                border: "1px solid #e3e3e3",
                borderRadius: 10,
                padding: "14px 16px",
                minWidth: 118,
              }}
            >
              <div style={{ fontSize: 21, fontWeight: 700 }}>
                {Number(v ?? 0).toLocaleString("en-IE")}
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {([
          ["ready", "Ready to add"],
          ["yes", "Permitted"],
          ["no", "Declined"],
          ["", "All"],
        ] as const).map(([f, label]) => (
          <button
            key={f || "all"}
            onClick={() => setView(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: view === f ? "2px solid #b60b0c" : "1px solid #ddd",
              background: view === f ? "#fdecec" : "#fff",
              fontWeight: view === f ? 700 : 400,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
        <label style={{ fontSize: 13, color: "#666", marginLeft: 8 }}>
          min cars:{" "}
          <select value={minCars} onChange={(e) => setMinCars(Number(e.target.value))}>
            {[1, 10, 25, 40, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 90 }}>Go?</th>
              <th style={th}>Garage</th>
              <th style={th}>Cars</th>
              <th style={th}>Website</th>
              <th style={th}>Platform</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const ready = Number(g.ready) === 1;
              const approved = Number(g.approved) === 1;
              return (
                <tr key={g.group_name} style={approved ? { background: "#f4fbf6" } : undefined}>
                  <td style={td}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={approved}
                        disabled={busy === g.group_name}
                        onChange={(e) => approve(g.group_name, e.target.checked)}
                        style={{ width: 17, height: 17, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 12, color: approved ? "#0a7d33" : "#999", fontWeight: 600 }}>
                        {approved ? "GO" : "hold"}
                      </span>
                    </label>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {g.group_name}
                    <div style={{ fontWeight: 400, fontSize: 12, color: "#888" }}>
                      {g.branches} branch{g.branches === 1 ? "" : "es"} · avg {eur(g.avg_landed)}
                      {g.badged > 0 && ` · ${g.badged} best-value`}
                    </div>
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{g.cars}</td>
                  <td style={td}>
                    {g.own_website ? (
                      <a
                        href={`https://${g.own_website}${g.stock_url ?? ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#b60b0c" }}
                      >
                        {g.own_website}
                      </a>
                    ) : (
                      <span style={{ color: "#aaa" }}>not found</span>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 13, color: "#666" }}>{g.platform ?? "—"}</td>
                  <td style={td}>
                    <span
                      style={{
                        color: g.collect === "no" ? "#b60b0c" : ready ? "#0a7d33" : "#8a6100",
                        background: g.collect === "no" ? "#fdecec" : ready ? "#e8f6ec" : "#fff6e0",
                        padding: "3px 9px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {g.collect === "no" ? "declined" : ready ? "ready" : "not ready"}
                    </span>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4, maxWidth: 460 }}>
                      {g.ready_note ?? g.reason}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>
                  Nothing here yet — the readiness check is still running.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
