"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";

interface SavedCar {
  car_id: string;
  car_name: string;
  registration_date?: string;
  transmission_name?: string;
  fuel_type_name?: string;
  mileage?: string;
  engine?: string;
  seats?: string;
  car_info?: { final_price: number };
  saved_car_id?: number;
  saved_car_feedback?: "like" | "dislike" | "none";
}

function formatKm(mileageMiles?: string): string | null {
  if (!mileageMiles) return null;
  const miles = Number(mileageMiles.replace(/\D/g, ""));
  if (!miles) return null;
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(
    Math.round(miles * 1.60934),
  );
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

const MAX_COMPARE = 4;

export default function SavedCarsClient() {
  const [cars, setCars] = useState<SavedCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

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

  function toggleCompare(carId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else {
        if (next.size >= MAX_COMPARE) return prev;
        next.add(carId);
      }
      return next;
    });
  }

  const selectedCars = cars.filter((c) => selected.has(c.car_id));

  const compareRows: { label: string; render: (c: SavedCar) => string }[] = [
    { label: "Price", render: (c) => (c.car_info?.final_price != null ? `€${Math.round(c.car_info.final_price).toLocaleString()}` : "-") },
    { label: "Year", render: (c) => carYear(c) || "-" },
    { label: "Mileage", render: (c) => { const km = formatKm(c.mileage); return km ? `${km} km` : "-"; } },
    { label: "Transmission", render: (c) => c.transmission_name || "-" },
    { label: "Fuel", render: (c) => c.fuel_type_name || "-" },
    { label: "Engine", render: (c) => c.engine || "-" },
    { label: "Seats", render: (c) => c.seats || "-" },
  ];

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
        <>
          {showCompare && selectedCars.length >= 2 && (
            <div className={styles.compareTableWrap}>
              <div className={styles.compareTableHeader}>
                <h2>Comparing {selectedCars.length} cars</h2>
                <button type="button" className={styles.removeBtn} onClick={() => setShowCompare(false)}>
                  Close comparison
                </button>
              </div>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th></th>
                    {selectedCars.map((c) => (
                      <th key={c.car_id}>
                        <Link href={`/car/${c.car_id}`} target="_blank">
                          {c.car_name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.label}>
                      <td className={styles.compareRowLabel}>{row.label}</td>
                      {selectedCars.map((c) => (
                        <td key={c.car_id}>{row.render(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.grid}>
          {cars.map((car) => {
            const price = car.car_info?.final_price;
            const savedId = car.saved_car_id;
            const fb = savedId ? feedback[savedId] || "none" : "none";
            const isSelected = selected.has(car.car_id);
            return (
              <div className={styles.card} key={car.car_id}>
                <label className={styles.compareCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCompare(car.car_id)}
                    disabled={!isSelected && selected.size >= MAX_COMPARE}
                  />
                  Compare
                </label>
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

          {selected.size >= 2 && (
            <div className={styles.compareBar}>
              <span>{selected.size} selected</span>
              <button type="button" className={styles.compareBtn} onClick={() => setShowCompare(true)}>
                Compare ({selected.size})
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
