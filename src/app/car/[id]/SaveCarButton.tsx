"use client";
import { track } from "@/lib/gtm";

import { useEffect, useState } from "react";
import SignInSlideOver from "../../components/SignInSlideOver";
import { authHeaders, isTokenValid } from "@/lib/auth";
import styles from "./page.module.css";

// Save-this-car heart on the car detail page — same contract as the listing
// tiles (CardsGrid) and the legacy SingleCar.jsx: saved-car-ids on mount,
// save-car/unsave-car to toggle, sign-in slide-over when logged out.
// Website review 3 Oct 2026 #26: opened from a filtered listing (the ucScrollReturn
// stash FilterBar writes on a tile click: same tab, this car, last 30 minutes), the
// car is saved with that listing's version and feature chips, as the tile heart is.
function listingChips(carId: string): { version: string; searchChips: string[] } {
  const none = { version: "", searchChips: [] as string[] };
  try {
    const raw = sessionStorage.getItem("ucScrollReturn");
    if (!raw) return none;
    const s = JSON.parse(raw) as { q?: string; t?: number; clickedId?: string | null };
    const fresh = typeof s.t === "number" && Date.now() - s.t < 30 * 60 * 1000;
    if (!fresh || s.clickedId !== carId || typeof s.q !== "string") return none;
    const qs = new URLSearchParams(s.q);
    return { version: qs.getAll("versionChips").join(" "), searchChips: qs.getAll("searchChips") };
  } catch {
    return none;
  }
}

export default function SaveCarButton({ carId }: { carId: string }) {
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    if (!isTokenValid()) return;
    fetch("/api/saved-car-ids", { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setSaved((data.data || []).includes(carId)))
      .catch(() => {});
  }, [carId]);

  function performToggle() {
    if (pending) return;
    setPending(true);
    fetch(saved ? `/api/unsave-car/${carId}` : "/api/save-car", {
      method: saved ? "DELETE" : "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: saved ? undefined : JSON.stringify({ car_id: carId, ...listingChips(carId) }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ResponseCode === "1" || data.ResponseCode === 1) {
          if (!saved) track("save_car", { car_id: carId });
          setSaved(!saved);
        }
      })
      .finally(() => setPending(false));
  }

  function handleClick() {
    if (!isTokenValid()) {
      setSignInOpen(true);
      return;
    }
    performToggle();
  }

  function handleSignInSuccess() {
    setSignInOpen(false);
    performToggle();
  }

  return (
    <>
      <button
        type="button"
        className={saved ? `${styles.saveBtn} ${styles.saveBtnSaved}` : styles.saveBtn}
        onClick={handleClick}
        title="Saves this car to your account and emails you when a similar car arrives"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-10-9.3C.3 8.2 2 4.5 5.6 4c2-.3 3.9.7 6.4 3 2.5-2.3 4.4-3.3 6.4-3 3.6.5 5.3 4.2 3.6 7.7-2.5 4.7-10 9.3-10 9.3z"></path>
        </svg>
        {saved ? "Saved \u00b7 alerts on" : "Save + alerts"}
      </button>
      <SignInSlideOver open={signInOpen} onClose={() => setSignInOpen(false)} onSuccess={handleSignInSuccess} />
    </>
  );
}
