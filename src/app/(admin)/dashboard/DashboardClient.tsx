"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import CollectionHealth from "./CollectionHealth";
import HealthRegister from "./HealthRegister";
import Servers from "./Servers";
import styles from "./page.module.css";

export default function DashboardClient() {
  const [totalCars, setTotalCars] = useState<number | null>(null);
  const [totalLeads, setTotalLeads] = useState<number | null>(null);

  useEffect(() => {
    // Same body shape FilterBar.tsx sends for an unfiltered count -- the
    // endpoint expects every field present, not an empty object.
    fetch("/api/car-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_manheim_car: "0",
        premium_car: 0,
        minPrice: "",
        maxPrice: "",
        minYear: "",
        maxYear: "",
        Make: "",
        Model: "",
        Fuel: "",
        seats: "",
        body_style: "",
        Condition: "",
        minMileage: "",
        maxMileage: "",
        minEnginesize: "",
        maxEnginesize: "",
        transmission_type: "",
        engine: "",
        color: "",
        vrtFilter: "Yes",
      }),
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
          <h2 className={styles.statLabel}>Total Vehicles</h2>
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
      <HealthRegister />
      <Servers />
    </>
  );
}
