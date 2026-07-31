"use client";

import { Camera, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";

interface Notification {
  id: number;
  car_id: string;
  car_year?: string;
  make_name: string;
  model_name: string;
  availability: "available" | "pricing_pending" | "sold";
  computed_final_price_v2?: number;
  sent_at: string;
  feedback?: "like" | "dislike" | "none";
}

function NotificationThumb({ carId, alt }: { carId: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={styles.notifThumbFallback}>
        <span><Camera size={24} strokeWidth={1.5} aria-hidden="true" /></span>
      </div>
    );
  }
  return (
    <img
      src={`${API_BASE}/car-thumb/${carId}`}
      alt={alt}
      width={120}
      height={90}
      loading="lazy"
      decoding="async"
      className={styles.notifThumb}
      onError={() => setFailed(true)}
    />
  );
}

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTokenValid()) {
      window.location.href = "/sign-in";
      return;
    }

    fetch(`/api/notifications`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setNotifications(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFeedback(id: number, value: "like" | "dislike") {
    const current = notifications.find((n) => n.id === id);
    const next = current && current.feedback === value ? "none" : value;

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, feedback: next } : n)));

    fetch(`/api/notifications/${id}/feedback`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: next }),
    }).catch(() => {});
  }

  function deleteNotification(id: number) {
    fetch(`/api/notifications/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ResponseCode === "1" || data.ResponseCode === 1) {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }
      })
      .catch(() => {});
  }

  return (
    <>
      <h1 className={styles.heading}>My Notifications</h1>
      <p className={styles.intro}>
        Every car we&apos;ve sent you based on your saved cars and saved searches, newest first. Let us know
        what you think so we can narrow the search for you: a thumbs up means more like this one, a thumbs down
        means fewer.
      </p>

      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : notifications.length === 0 ? (
        <p className={styles.empty}>
          You haven&apos;t been sent any car notifications yet. Save a car or a search from{" "}
          <Link href="/used-cars">our used cars</Link> and we&apos;ll email you when something similar turns up.
        </p>
      ) : (
        <div className={styles.notifList}>
          {notifications.map((n) => {
            const carName = `${n.car_year ? `${n.car_year} ` : ""}${n.make_name} ${n.model_name}`;
            return (
              <div className={styles.notifCard} key={n.id}>
                <Link href={`/car/${n.car_id}`} className={styles.notifThumbLink}>
                  <NotificationThumb carId={n.car_id} alt={carName} />
                </Link>

                <div className={styles.notifBody}>
                  <Link href={`/car/${n.car_id}`} className={styles.notifTitle}>
                    {carName}
                  </Link>
                  <div className={styles.notifMetaRow}>
                    {n.availability === "available" && (
                      <span className={`${styles.availBadge} ${styles.availAvailable}`}>Available</span>
                    )}
                    {n.availability === "pricing_pending" && (
                      <span
                        className={`${styles.availBadge} ${styles.availPending}`}
                        title="Still listed, we're still finalizing the price"
                      >
                        Pricing pending
                      </span>
                    )}
                    {n.availability === "sold" && (
                      <span className={`${styles.availBadge} ${styles.availSold}`}>Sold / removed</span>
                    )}
                    {n.computed_final_price_v2 ? (
                      <span className={styles.notifPrice}>
                        €{Number(n.computed_final_price_v2).toLocaleString()}
                      </span>
                    ) : null}
                    <span className={styles.notifSent}>Sent {n.sent_at}</span>
                  </div>
                </div>

                <div className={styles.notifActions}>
                  <button
                    type="button"
                    className={styles.feedbackBtn}
                    style={n.feedback === "like" ? { background: "#14A800", borderColor: "#14A800" } : undefined}
                    aria-pressed={n.feedback === "like"}
                    onClick={() => setFeedback(n.id, "like")}
                    title="More like this"
                  >
                    <ThumbsUp size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.feedbackBtn}
                    style={n.feedback === "dislike" ? { background: "#E02020", borderColor: "#E02020" } : undefined}
                    aria-pressed={n.feedback === "dislike"}
                    onClick={() => setFeedback(n.id, "dislike")}
                    title="Fewer like this"
                  >
                    <ThumbsDown size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => deleteNotification(n.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
