"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CarThumb from "./CarThumb";
import CardImageCarousel from "./CardImageCarousel";
import SignInSlideOver from "../components/SignInSlideOver";
import { authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

interface Car {
  car_id: string;
  car_name: string;
  registration_date: string;
  transmission_name: string;
  fuel_type_name: string;
  mileage: string;
  premium_car?: number;
  is_manheim_car?: string;
  car_info?: { final_price?: number };
  thumb_v?: string | null;
  photo_count?: number;
  photo_ids?: number[];
}

function buildCarYear(car: Car): string {
  if (!car.registration_date) return "";
  const parts = car.registration_date.split("/");
  if (parts.length < 3) return "";
  const year = parts[2];
  const month = Number(parts[1]);
  const half = month > 6 ? 2 : 1;
  return `${year} (${year.slice(2)}${half})`;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatKm(mileageMiles: string): string | null {
  const miles = Number(mileageMiles.replace(/\D/g, ""));
  if (!miles) return null;
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(
    Math.round(miles * 1.60934),
  );
}

export default function CardsGrid({ cars }: { cars: Car[] }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [signInCarId, setSignInCarId] = useState<string | null>(null);

  useEffect(() => {
    if (!isTokenValid()) return;
    fetch(`/api/saved-car-ids`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setSavedIds(new Set(data.data || [])))
      .catch(() => {});
  }, []);

  function performToggle(carId: string) {
    if (pending.has(carId)) return;

    const isSaved = savedIds.has(carId);
    setPending((prev) => new Set(prev).add(carId));

    fetch(isSaved ? `/api/unsave-car/${carId}` : "/api/save-car", {
      method: isSaved ? "DELETE" : "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: isSaved ? undefined : JSON.stringify({ car_id: carId, version: "", searchChips: [] }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ResponseCode === "1" || data.ResponseCode === 1) {
          setSavedIds((prev) => {
            const next = new Set(prev);
            if (isSaved) next.delete(carId);
            else next.add(carId);
            return next;
          });
        }
      })
      .finally(() => {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(carId);
          return next;
        });
      });
  }

  function toggleSave(e: React.MouseEvent, carId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!isTokenValid()) {
      setSignInCarId(carId);
      return;
    }
    performToggle(carId);
  }

  function handleSignInSuccess() {
    const carId = signInCarId;
    setSignInCarId(null);
    if (carId) performToggle(carId);
  }

  return (
    <>
    <div className={styles.grid}>
      {cars.map((car, index) => {
        const year = buildCarYear(car);
        const km = formatKm(car.mileage);
        const finalPrice = car.car_info?.final_price;
        const imageUrl = `${API_BASE}/car-thumb/${car.car_id}${car.thumb_v ? `?v=${car.thumb_v}` : ""}`;
        const isSaved = savedIds.has(car.car_id);

        return (
          <Link key={car.car_id} href={`/car/${car.car_id}`} className={styles.card}>
            {car.premium_car === 1 ? (
              <span className={`${styles.badge} ${styles.badgePremium}`}>★ Premium</span>
            ) : null}
            <button
              type="button"
              className={styles.saveButton}
              aria-label={isSaved ? "Remove from saved cars" : "Save this car"}
              aria-pressed={isSaved}
              onClick={(e) => toggleSave(e, car.car_id)}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 21s-7.5-4.6-10-9.3C.3 8.2 2 4.5 5.6 4c2-.3 3.9.7 6.4 3 2.5-2.3 4.4-3.3 6.4-3 3.6.5 5.3 4.2 3.6 7.7-2.5 4.7-10 9.3-10 9.3z" />
              </svg>
            </button>
            <CardImageCarousel
              carId={car.car_id}
              alt={car.car_name}
              heroSrc={imageUrl}
              photoIds={car.photo_ids ?? []}
              photoCount={car.photo_count ?? 1}
              priority={index < 4}
            />
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{car.car_name}</div>
              <div className={styles.chips}>
                {year && <span className={styles.chip}>{year}</span>}
                {car.transmission_name && <span className={styles.chip}>{car.transmission_name}</span>}
                {car.fuel_type_name && <span className={styles.chip}>{car.fuel_type_name}</span>}
                {km && <span className={styles.chip}>{km} km</span>}
              </div>
            </div>
            <div className={styles.cardPrice}>
              {finalPrice != null ? `€${formatEuro(finalPrice)}` : ""}
            </div>
          </Link>
        );
      })}
    </div>
    <SignInSlideOver
      open={signInCarId !== null}
      onClose={() => setSignInCarId(null)}
      onSuccess={handleSignInSuccess}
    />
    </>
  );
}
