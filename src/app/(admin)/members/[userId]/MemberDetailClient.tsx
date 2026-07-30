"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "../page.module.css";

interface MemberInfo {
  user_id: string;
  firstname: string | null;
  lastname: string | null;
  email: string;
}

interface Notification {
  id: number;
  car_id: string;
  saved_car_id: number | null;
  saved_search_id: number | null;
  alert_type: string;
  feedback: string | null;
  sent_at: string;
  client_deleted: boolean;
  make_name: string | null;
  model_name: string | null;
  car_year: string | null;
  computed_final_price_v2: string | null;
  availability: "available" | "pricing_pending" | "sold";
}

const AVAILABILITY: Record<string, { label: string; cls: string }> = {
  available: { label: "Available", cls: "badgeAvailable" },
  pricing_pending: { label: "Pricing pending", cls: "badgePendingVrt" },
  sold: { label: "Sold / removed", cls: "badgeSold" },
};

export default function MemberDetailClient({ userId }: { userId: string }) {
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/staff-member-notifications/${userId}`, { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          setMember(data.data?.member ?? null);
          setNotifications(data.data?.notifications ?? []);
        } else {
          setError(data?.ResponseText || "Failed to load member");
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const name = member ? `${member.firstname ?? ""} ${member.lastname ?? ""}`.trim() : "";

  return (
    <>
      <Link href="/members" className={styles.backLink}>
        &larr; All members
      </Link>
      <h1 className={styles.heading}>{loading ? "Member" : name || member?.email || "Member"}</h1>

      {error && <p>{error}</p>}

      {member && (
        <div className={styles.memberCard}>
          <div>
            <span className={styles.sub}>Email</span>
            {member.email}
          </div>
          <div>
            <span className={styles.sub}>User ID</span>
            {member.user_id}
          </div>
          <div>
            <span className={styles.sub}>Notifications</span>
            {notifications.length}
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <div className={styles.notifHead}>
          <span>Sent</span>
          <span>Type</span>
          <span>Car</span>
          <span>Price</span>
          <span>Feedback</span>
          <span>Availability</span>
        </div>
        {loading && <div className={styles.emptyRow}>Loading...</div>}
        {!loading && notifications.length === 0 && (
          <div className={styles.emptyRow}>No notifications have been generated for this member.</div>
        )}
        {!loading &&
          notifications.map((n) => {
            const avail = AVAILABILITY[n.availability] ?? AVAILABILITY.sold;
            return (
              <div key={n.id} className={styles.notifRow}>
                <span className={styles.sub}>
                  {n.sent_at}
                  {n.client_deleted && <span className={styles.deletedTag}> (deleted by client)</span>}
                </span>
                <span className={styles.sub}>
                  {n.alert_type === "similar_car" || n.saved_car_id ? "Saved car" : "Saved search"}
                </span>
                <span>
                  <a href={`https://ukcarimports.ie/car/${n.car_id}`} target="_blank" rel="noreferrer">
                    {[n.make_name, n.model_name, n.car_year ? `(${n.car_year})` : null]
                      .filter(Boolean)
                      .join(" ") || n.car_id}
                  </a>
                </span>
                <span>
                  {n.computed_final_price_v2
                    ? "€" + Math.round(Number(n.computed_final_price_v2)).toLocaleString()
                    : "-"}
                </span>
                <span className={styles.sub}>{n.feedback ?? "-"}</span>
                <span className={styles[avail.cls]}>{avail.label}</span>
              </div>
            );
          })}
      </div>
    </>
  );
}
