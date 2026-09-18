"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import { CANONICAL_BROWSE_BODY } from "@/lib/stockCount";
import CollectionHealth from "./CollectionHealth";
import Servers from "./Servers";
import styles from "./page.module.css";

export default function DashboardClient() {
  const [totalCars, setTotalCars] = useState<number | null>(null);
  const [totalLeads, setTotalLeads] = useState<number | null>(null);

  useEffect(() => {
    // ONE number across the site (owner requirement, restated 2026-08-25):
    // send the SAME canonical body getStockCount() and the homepage use.
    // This block used to hand-roll its own body with minPrice: "" where the
    // public browse sends "1". CarsNewTwoController caches the count for 30
    // minutes keyed on the filter values, so a different minPrice is a
    // DIFFERENT CACHE KEY - the two numbers expired at different times and
    // drifted apart (127,531 here against 128,281 public, same minute).
    fetch("/api/car-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CANONICAL_BROWSE_BODY),
    })
      .then((res) => res.json())
      .then((data) => setTotalCars(typeof data?.data?.count === "number" ? data.data.count : null))
      .catch(() => setTotalCars(null));

    // BuyCarController::getLeads() responds {ResponseCode, data: [...]} --
    // not a bare array.
    fetch("/api/staff-leads", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setTotalLeads(Array.isArray(data?.data) ? data.data.length : 0))
      .catch(() => setTotalLeads(null));
  }, []);

  return (
    <>
      <h1 className={styles.heading}>Dashboard</h1>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <h2 className={styles.statLabel}>VRT-Priced Vehicles</h2>
          <div className={styles.statValue}>{totalCars ?? "..."}</div>
          <span className={styles.statUnit}>Cars</span>
        </div>
        <div className={styles.statCard}>
          <h2 className={styles.statLabel}>Total Leads</h2>
          <div className={styles.statValue}>{totalLeads ?? "..."}</div>
          <span className={styles.statUnit}>Leads</span>
        </div>
      </div>
      <CollectionHealth />
      <Servers />
    </>
  );
}
