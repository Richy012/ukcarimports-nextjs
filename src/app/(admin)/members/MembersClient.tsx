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
