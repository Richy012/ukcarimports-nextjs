"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";

if (typeof window !== "undefined") { document.title = "MODULE-LOADED"; }

interface SavedCar {
  car_id: string;
  car_name: string;
  registration_date?: string;
  transmission_name?: string;
  fuel_type_name?: string;
  mileage?: string;
  car_info?: { final_price: number };
  saved_car_id?: number;
  saved_car_feedback?: "like" | "dislike" | "none";
}

function carYear(car: SavedCar): string {
  if (!car.registration_date) return "";
  const parts = car.registration_date.split("/");
  return parts[2] || "";
}

function CarImage({ carId, alt }: { carId: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={styles.cardImageFallback}>
        <span>📷</span>
        <span>Photo not available</span>
      </div>
    );
  }
  return (
    <img
      src={`${API_BASE}/car-thumb/${carId}`}
      alt={alt}
      width={280}
      height={210}
      loading="lazy"
      decoding="async"
      className={styles.cardImage}
      onError={() => setFailed(true)}
    />
  );
}

export default function SavedCarsClient() {
    const [cars, setCars] = useState<SavedCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isTokenValid()) {
      window.location.href = "/sign-in";
      return;
    }

    fetch(`${API_BASE}/user/saved-cars`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        const list: SavedCar[] = (data.data && data.data.cars) || [];
        setCars(list);
        const initialFeedback: Record<number, string> = {};
        list.forEach((c) => {
          if (c.saved_car_id) initialFeedback[c.saved_car_id] = c.saved_car_feedback || "none";
        });
        setFeedback(initialFeedback);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeCar(carId: string) {
    fetch(`${API_BASE}/user/unsave-car/${carId}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ResponseCode === "1" || data.ResponseCode === 1) {
          setCars((prev) => prev.filter((c) => c.car_id !== carId));
        }
      })
      .catch(() => {});
  }

  function sendFeedback(savedCarId: number, value: "like" | "dislike") {
    const current = feedback[savedCarId] || "none";
    const next = current === value ? "none" : value;
    setFeedback((prev) => ({ ...prev, [savedCarId]: next }));

    fetch(`${API_BASE}/user/saved-cars/${savedCarId}/feedback`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: next }),
    }).catch(() => {});
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>My Saved Cars</h1>
      <p className={styles.intro}>
        We&apos;ll email you if a similar car is added to our stock later. You can unsubscribe from those
        emails any time using the link at the bottom of one.
      </p>

      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : cars.length === 0 ? (
        <p className={styles.empty}>
          You haven&apos;t saved any cars yet. Browse our <Link href="/used-cars">used cars</Link> and tap the
          heart on any listing to save it here.
        </p>
      ) : (
        <div className={styles.grid}>
          {cars.map((car) => {
            const price = car.car_info?.final_price;
            const savedId = car.saved_car_id;
            const fb = savedId ? feedback[savedId] || "none" : "none";
            return (
              <div className={styles.card} key={car.car_id}>
                <Link href={`/car/${car.car_id}`} target="_blank">
                  <CarImage carId={car.car_id} alt={car.car_name} />
                </Link>
                <div className={styles.cardBody}>
                  <Link href={`/car/${car.car_id}`} target="_blank" className={styles.cardTitle}>
                    {car.car_name}
                  </Link>
                  <div className={styles.cardPrice}>
                    {price != null ? `€${Math.round(price).toLocaleString()}` : ""}
                  </div>
                  {savedId && (
                    <div>
                      <button
                        type="button"
                        className={styles.feedbackBtn}
                        style={fb === "like" ? { background: "#14A800", borderColor: "#14A800" } : undefined}
                        title="More cars like this"
                        aria-pressed={fb === "like"}
                        onClick={() => sendFeedback(savedId, "like")}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className={styles.feedbackBtn}
                        style={fb === "dislike" ? { background: "#E02020", borderColor: "#E02020" } : undefined}
                        title="Fewer cars like this"
                        aria-pressed={fb === "dislike"}
                        onClick={() => sendFeedback(savedId, "dislike")}
                      >
                        👎
                      </button>
                    </div>
                  )}
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.removeBtn} onClick={() => removeCar(car.car_id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
