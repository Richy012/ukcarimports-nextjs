"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface Member {
  user_id: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  user_status: string;
  alerts_opted_in: number;
  marketing_opted_in: number;
  signup_date: string | null;
  saved_cars_count: number;
  saved_searches_count: number;
}

export default function MembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  // Permanently deletes every inactive MEMBER account and all their data
  // (saved cars, saved searches, alert history, queued emails). Admin accounts
  // are never touched — the backend scopes to user_role='user' and there are
  // live admin accounts sitting at user_status='inactive'.
  // Two steps on purpose: a dry run first so the confirm box shows a real
  // number, then the irreversible call.
  function purgeInactive() {
    setPurging(true);
    fetch("/api/staff-purge-members", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((preview) => {
        const n = Number(preview?.count ?? 0);
        if (!n) {
          alert("No inactive members to clear.");
          return null;
        }
        if (
          !window.confirm(
            `Permanently delete ${n} inactive member${n === 1 ? "" : "s"} and ALL their information?\n\n` +
              `This removes their account, saved cars, saved searches, alert history and any queued emails.\n\n` +
              `This CANNOT be undone. Admin accounts are not affected.`
          )
        )
          return null;
        return fetch("/api/staff-purge-members", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
          body: JSON.stringify({ confirm: "1" }),
        }).then((res) => res.json());
      })
      .then((data) => {
        if (!data) return;
        if (data?.ResponseCode == 1) {
          alert(data?.ResponseText || "Done");
          load();
        } else {
          alert(data?.ResponseText || "Purge failed");
        }
      })
      .finally(() => setPurging(false));
  }

  function load() {
    fetch("/api/staff-members", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setMembers(data?.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function removeMember(member: Member) {
    if (
      !window.confirm(
        `Remove ${member.email}? Their account is deactivated and anonymised (same as the old admin) — this cannot be undone.`
      )
    )
      return;
    setBusyEmail(member.email);
    fetch("/api/staff-remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({ email: member.email }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          load();
        } else {
          alert(data?.ResponseText || "Remove failed");
        }
      })
      .finally(() => setBusyEmail(null));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.email || "").toLowerCase().includes(q) ||
        `${m.firstname ?? ""} ${m.lastname ?? ""}`.toLowerCase().includes(q)
    );
  }, [members, search]);

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Members</h1>
        <div className={styles.filterRow}>
          <input
            type="text"
            placeholder="Name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className={styles.countText}>
            {filtered.length} of {members.length}
          </span>
          <button
            type="button"
            onClick={purgeInactive}
            disabled={purging}
            title="Permanently delete all inactive members and every trace of their data. Admin accounts are never affected."
            style={{
              marginLeft: 12,
              padding: "6px 12px",
              border: "1px solid #b00020",
              borderRadius: 6,
              background: "#fff",
              color: "#b00020",
              font: "inherit",
              fontSize: "0.85em",
              cursor: purging ? "default" : "pointer",
              opacity: purging ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {purging ? "Clearing..." : "Clear inactive members"}
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span>Member</span>
          <span>Status</span>
          <span>Saved cars</span>
          <span>Saved searches</span>
          <span>Alerts</span>
          <span>Signed up</span>
          <span />
        </div>
        {loading && <div className={styles.emptyRow}>Loading...</div>}
        {!loading && filtered.length === 0 && <div className={styles.emptyRow}>No members match.</div>}
        {!loading &&
          filtered.map((m) => (
            <div key={m.user_id} className={styles.tableRow}>
              <div className={styles.cellStack}>
                <Link href={`/members/${m.user_id}`} className={styles.memberLink}>
                  {`${m.firstname ?? ""} ${m.lastname ?? ""}`.trim() || m.email}
                </Link>
                <span className={styles.sub}>{m.email}</span>
              </div>
              <span className={m.user_status === "active" ? styles.badgeActive : styles.badgeInactive}>
                {m.user_status}
              </span>
              <span>{m.saved_cars_count}</span>
              <span>{m.saved_searches_count}</span>
              <span className={styles.sub}>{m.alerts_opted_in ? "opted in" : "opted out"}</span>
              <span className={styles.sub}>{m.signup_date ?? "-"}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                disabled={busyEmail === m.email || m.user_status !== "active"}
                onClick={() => removeMember(m)}
              >
                {busyEmail === m.email ? "..." : "Remove"}
              </button>
            </div>
          ))}
      </div>
    </>
  );
}
