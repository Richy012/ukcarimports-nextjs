"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CarThumb from "./CarThumb";
import CardImageCarousel from "./CardImageCarousel";
import SignInSlideOver from "../components/SignInSlideOver";
import { authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";
import { ladderRung, RUNG_CLASS, RUNG_LABEL, evidenceLine, type Rung } from "@/lib/ladder";

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
  bestseller_tier?: string | null;
  bestseller_saving_eur?: number | null;
  bestseller_irish_ads?: number | null;
  bestseller_median_eur?: number | null;
  bestseller_cheapest_eur?: number | null;
  bestseller_below_cheapest?: number | null;
  price_drop_eur?: number | null;
  price_dropped_at?: string | null;
}

// Tile badge for the Bestseller Series. The euro figure is the live saving
// vs the Irish market (refreshed every 15 min server-side). Trending badges
// hedge: evidence is real but thin, so the figure is rounded to the nearest
// €500 and phrased as "around", never shown under €1,000 (wording guard —
// see the comparison-method notes).
function bestsellerBadge(car: Car): { cls: string; label: string; saving: string; evidence: string; rung: Rung | null } | null {
  const tier = car.bestseller_tier;
  if (!tier) return null;
  const sav = Number(car.bestseller_saving_eur ?? 0);
  // Ladder (owner 2026-09-03): one brand from €750 up, six colour rungs, the
  // exact figure on every badge, and the evidence behind it on line three.
  const rung = ladderRung(tier, sav);
  if (rung) {
    return {
      cls: RUNG_CLASS[rung],
      label: RUNG_LABEL[rung],
      saving: sav >= 750 ? `€${formatEuro(sav)} less than in Ireland` : "",
      evidence: evidenceLine(car.bestseller_irish_ads),
      rung,
    };
  }
  const rounded = Math.round(sav / 500) * 500;
  return {
    cls: "badgeTrending",
    label: "Trending Bestseller",
    saving: rounded >= 1000 ? `around €${formatEuro(rounded)} less than in Ireland` : "",
    evidence: "",
    rung: null,
  };
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

        const badge = bestsellerBadge(car);
        // The strongest honest line on the site: below the CHEAPEST Irish ad
        // in the model-year, not just the median. Only with a 10+ listing base.
        const cheapestLine =
          badge && badge.rung && Number(car.bestseller_below_cheapest ?? 0) === 1 && Number(car.bestseller_irish_ads ?? 0) >= 10
            ? `Cheaper than all ${Number(car.bestseller_irish_ads).toLocaleString("en-IE")} Irish listings`
            : "";

        return (
          // The card was previously a single <Link> wrapping the save button and
          // the carousel arrows — interactive controls nested inside an anchor is
          // invalid HTML and the page's one real accessibility failure (75 nested
          // controls, Lighthouse `nested-interactive`). Now: a <div> with a
          // stretched-link overlay as its first child; the buttons are siblings
          // ABOVE the overlay (saveButton z-index 2, carouselArrow z-index 2),
          // so clicks anywhere else on the card still navigate exactly as before.
          <div key={car.car_id} className={styles.card}>
            <Link href={`/car/${car.car_id}`} className={styles.cardLink}>
              <span className={styles.srOnly}>{car.car_name}</span>
            </Link>
            {badge ? (
              <span className={`${styles.badge} ${styles[badge.cls]}`}>
                <span className={styles.badgeTierLine}>&#9889; {badge.label}</span>
                {badge.saving ? <span className={styles.badgeSavingLine}>{badge.saving}</span> : null}
                {badge.evidence ? <span className={styles.badgeEvidenceLine}>{badge.evidence}</span> : null}
              </span>
            ) : null}
            {cheapestLine ? <span className={styles.cheapestStrip}>{cheapestLine}</span> : null}
            {car.premium_car === 1 ? (
              <span className={`${styles.badge} ${styles.badgePremium} ${badge ? (cheapestLine ? styles.badgeBelow2 : styles.badgeBelow) : ""}`}>★ Premium</span>
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
              {finalPrice != null && Number(car.price_drop_eur ?? 0) >= 300 ? (
                <s className={styles.oldPrice}>€{formatEuro(Math.round(finalPrice + Number(car.price_drop_eur)))}</s>
              ) : null}
              {Number(car.price_drop_eur ?? 0) >= 300 ? (
                <span className={styles.dropTag}>
                  &#8595; &euro;{(Math.round(Number(car.price_drop_eur) / 50) * 50).toLocaleString("en-IE")} price drop
                </span>
              ) : null}
            </div>
            {badge && badge.rung ? (
              <div className={styles.rungBar} role="img" aria-label={`Saving rung ${badge.rung} of 6`}>
                {[1, 2, 3, 4, 5, 6].map((r) => (
                  <span key={r} className={`${styles[`rung${r}`]} ${r <= (badge.rung as number) ? styles.rungLit : ""}`} />
                ))}
              </div>
            ) : null}
          </div>
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
