"use client";

import { useEffect, useMemo, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface Lead {
  id: number;
  lead_id: string;
  name: string;
  Email: string;
  Phone: string;
  car_id: string;
  message?: string | null;
  source?: string | null;
  twelvemonthwarrenty: string;
  vrt_proccessing: string;
  transferuktodub: string;
  homedelivry: string;
  inspection_fee: string;
  status: "pending" | "in process" | "complete";
  currdate: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  pending: "badgePending",
  "in process": "badgeProcess",
  complete: "badgeComplete",
};

function extras(lead: Lead): string[] {
  const out: string[] = [];
  if (lead.twelvemonthwarrenty && lead.twelvemonthwarrenty !== "0") out.push(`Warranty (${lead.twelvemonthwarrenty})`);
  if (lead.vrt_proccessing === "1") out.push("VRT processing");
  if (lead.transferuktodub === "1") out.push("UK-Dublin transport");
  if (lead.homedelivry === "1") out.push("Home delivery");
  if (lead.inspection_fee === "1") out.push("Inspection fee");
  return out;
}

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/staff-leads", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setLeads(data?.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function deleteLead(lead: Lead) {
    if (!window.confirm(`Delete the lead from ${lead.name}? This cannot be undone.`)) return;
    setBusyId(lead.lead_id);
    fetch(`/api/staff-delete-lead/${lead.lead_id}`, {
      method: "DELETE",
      headers: staffAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          setLeads((prev) => prev.filter((l) => l.lead_id !== lead.lead_id));
        } else {
          alert(data?.ResponseText || "Delete failed");
        }
      })
      .finally(() => setBusyId(null));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (l.name || "").toLowerCase().includes(q) ||
        (l.Email || "").toLowerCase().includes(q) ||
        (l.Phone || "").toLowerCase().includes(q) ||
        (l.car_id || "").includes(q) ||
        (l.message || "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, statusFilter]);

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Leads</h1>
        <div className={styles.filterRow}>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in process">In process</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <input
            type="text"
            placeholder="Name, email, phone or car id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className={styles.countText}>{filtered.length} of {leads.length}</span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span>Customer</span>
          <span>Car</span>
          <span>Extras requested</span>
          <span>Status</span>
          <span>Date</span>
          <span />
        </div>
        {loading && <div className={styles.emptyRow}>Loading...</div>}
        {!loading && filtered.length === 0 && <div className={styles.emptyRow}>No leads match.</div>}
        {!loading &&
          filtered.map((lead) => (
            <div key={lead.id} className={styles.tableRow}>
              <div className={styles.cellStack}>
                <span>
                  {lead.name}
                  {lead.source === "enquiry" && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "0.7em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#eef4ff",
                        color: "#2b5fd9",
                        verticalAlign: "middle",
                      }}
                    >
                      ENQUIRY
                    </span>
                  )}
                </span>
                <a
                  className={styles.sub}
                  href={`mailto:${lead.Email}?subject=${encodeURIComponent(
                    "Re: your enquiry to UK Car Imports"
                  )}&body=${encodeURIComponent(
                    `Hi ${(lead.name || "").split(" ")[0]},



---
You wrote:
${lead.message || ""}`
                  )}`}
                  style={{ color: "#2b5fd9", textDecoration: "none" }}
                >
                  {lead.Email}
                </a>
                <a
                  className={styles.sub}
                  href={`tel:${(lead.Phone || "").replace(/\s/g, "")}`}
                  style={{ color: "#2b5fd9", textDecoration: "none" }}
                >
                  {lead.Phone}
                </a>
                {lead.message && (
                  <span
                    className={styles.sub}
                    style={{ whiteSpace: "pre-wrap", marginTop: 4, opacity: 0.95 }}
                  >
                    {lead.message}
                  </span>
                )}
              </div>
              <div className={styles.cellStack}>
                <span className={styles.sub}>
                  <a
                    href={`https://www.autotrader.co.uk/car-details/${lead.car_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    See at AutoTrader
                  </a>
                </span>
                <span className={styles.sub}>
                  <a href={`https://ukcarimports.ie/car/${lead.car_id}`} target="_blank" rel="noreferrer">
                    {lead.car_id}
                  </a>
                </span>
              </div>
              <div className={styles.cellStack}>
                {extras(lead).length === 0 && <span className={styles.sub}>-</span>}
                {extras(lead).map((x) => (
                  <span key={x} className={styles.extraChip}>
                    {x}
                  </span>
                ))}
              </div>
              <span className={styles[STATUS_CLASS[lead.status] ?? "badgePending"]}>{lead.status}</span>
              <span className={styles.sub}>{lead.currdate ?? "-"}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                disabled={busyId === lead.lead_id}
                onClick={() => deleteLead(lead)}
              >
                {busyId === lead.lead_id ? "..." : "Delete"}
              </button>
            </div>
          ))}
      </div>
    </>
  );
}
