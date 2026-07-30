"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

// AutoTrader-style filter bar for the admin catalog. Same params as the
// public /used-cars FilterBar (both feed buildCarsQueryFromParams), but with
// no public price floor and the admin-only VRT state filter integrated.

export interface AdminFilters {
  vrt: "All" | "Yes" | "No";
  Make: string;
  Model: string;
  Fuel: string;
  transmission_type: string;
  body_style: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  minMileage: string;
  maxMileage: string;
  sort: "" | "price_asc" | "price_desc" | "mileage_asc" | "mileage_desc";
}

export const DEFAULT_FILTERS: AdminFilters = {
  vrt: "All",
  Make: "",
  Model: "",
  Fuel: "",
  transmission_type: "",
  body_style: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  minMileage: "",
  maxMileage: "",
  sort: "",
};

interface Option {
  label: string;
  total: number;
}

const YEARS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
// Admin has no price floor, unlike the public €15k minimum.
const PRICES = Array.from({ length: 101 }, (_, i) => i * 5000);
const MILEAGES = Array.from({ length: 101 }, (_, i) => i * 5000);

function fmt(n: number): string {
  return n.toLocaleString();
}

export default function AdminFilterBar({
  filters,
  onChange,
  count,
  loading,
}: {
  filters: AdminFilters;
  onChange: (patch: Partial<AdminFilters>) => void;
  count: number;
  loading: boolean;
}) {
  const [makes, setMakes] = useState<Option[]>([]);
  const [fuels, setFuels] = useState<Option[]>([]);
  const [bodyStyles, setBodyStyles] = useState<Option[]>([]);
  const [transmissions, setTransmissions] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);

  useEffect(() => {
    const facet = (name: string) =>
      fetch(`/api/staff-facets/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).then((r) => r.json());
    Promise.all([facet("makes"), facet("fuel-types"), facet("body-styles"), facet("transmission-types")]).then(
      ([m, f, b, t]) => {
        setMakes(
          (m?.make ?? [])
            .filter((x: { make: string }) => x.make)
            .map((x: { make: string; total: number }) => ({ label: x.make, total: x.total }))
        );
        setFuels(
          (f?.fuel_type ?? [])
            .filter((x: { fuel_type: string }) => x.fuel_type)
            .map((x: { fuel_type: string; total: number }) => ({ label: x.fuel_type, total: x.total }))
        );
        setBodyStyles(
          (b?.body_style ?? [])
            .filter((x: { body_style: string }) => x.body_style)
            .map((x: { body_style: string; total: number }) => ({ label: x.body_style, total: x.total }))
        );
        setTransmissions(
          (t?.transmission ?? [])
            .filter((x: { car_transmission: string }) => x.car_transmission)
            .map((x: { car_transmission: string; total: number }) => ({
              label: x.car_transmission,
              total: x.total,
            }))
        );
      }
    );
  }, []);

  useEffect(() => {
    if (!filters.Make) {
      setModels([]);
      return;
    }
    let cancelled = false;
    fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Make: filters.Make }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // With a Make the endpoint wraps the list as { model: [...] };
        // without one it returns a bare array.
        const list = Array.isArray(data) ? data : (data?.model ?? []);
        setModels(
          list
            .filter((x: { car_model: string }) => x.car_model)
            .map((x: { car_model: string; total: number }) => ({ label: x.car_model, total: x.total }))
        );
      });
    return () => {
      cancelled = true;
    };
  }, [filters.Make]);

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className={styles.fbWrap}>
      <div className={styles.fbRow}>
        <label className={styles.fbField}>
          <span>Make</span>
          <select
            value={filters.Make}
            onChange={(e) => onChange({ Make: e.target.value, Model: "" })}
          >
            <option value="">Any</option>
            {makes.map((m) => (
              <option key={m.label} value={m.label}>
                {m.label} ({fmt(m.total)})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fbField}>
          <span>Model</span>
          <select
            value={filters.Model}
            disabled={!filters.Make}
            onChange={(e) => onChange({ Model: e.target.value })}
          >
            <option value="">Any</option>
            {models.map((m) => (
              <option key={m.label} value={m.label}>
                {m.label} ({fmt(m.total)})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fbField}>
          <span>Price (€)</span>
          <span className={styles.fbRange}>
            <select value={filters.minPrice} onChange={(e) => onChange({ minPrice: e.target.value })}>
              <option value="">Min</option>
              {PRICES.map((p) => (
                <option key={p} value={p}>
                  {fmt(p)}
                </option>
              ))}
            </select>
            <select value={filters.maxPrice} onChange={(e) => onChange({ maxPrice: e.target.value })}>
              <option value="">Max</option>
              {PRICES.filter((p) => p > 0).map((p) => (
                <option key={p} value={p}>
                  {fmt(p)}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={styles.fbField}>
          <span>Year</span>
          <span className={styles.fbRange}>
            <select value={filters.minYear} onChange={(e) => onChange({ minYear: e.target.value })}>
              <option value="">From</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select value={filters.maxYear} onChange={(e) => onChange({ maxYear: e.target.value })}>
              <option value="">To</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={styles.fbField}>
          <span>Mileage (km)</span>
          <span className={styles.fbRange}>
            <select value={filters.minMileage} onChange={(e) => onChange({ minMileage: e.target.value })}>
              <option value="">Min</option>
              {MILEAGES.map((m) => (
                <option key={m} value={m}>
                  {fmt(m)}
                </option>
              ))}
            </select>
            <select value={filters.maxMileage} onChange={(e) => onChange({ maxMileage: e.target.value })}>
              <option value="">Max</option>
              {MILEAGES.filter((m) => m > 0).map((m) => (
                <option key={m} value={m}>
                  {fmt(m)}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={styles.fbField}>
          <span>Fuel</span>
          <select value={filters.Fuel} onChange={(e) => onChange({ Fuel: e.target.value })}>
            <option value="">Any</option>
            {fuels.map((f) => (
              <option key={f.label} value={f.label}>
                {f.label} ({fmt(f.total)})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fbField}>
          <span>Gearbox</span>
          <select
            value={filters.transmission_type}
            onChange={(e) => onChange({ transmission_type: e.target.value })}
          >
            <option value="">Any</option>
            {transmissions.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label} ({fmt(t.total)})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fbField}>
          <span>Body</span>
          <select value={filters.body_style} onChange={(e) => onChange({ body_style: e.target.value })}>
            <option value="">Any</option>
            {bodyStyles.map((b) => (
              <option key={b.label} value={b.label}>
                {b.label} ({fmt(b.total)})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fbField}>
          <span>VRT</span>
          <select
            value={filters.vrt}
            onChange={(e) => onChange({ vrt: e.target.value as AdminFilters["vrt"] })}
          >
            <option value="All">All</option>
            <option value="Yes">Has VRT</option>
            <option value="No">No VRT</option>
          </select>
        </label>

        <label className={styles.fbField}>
          <span>Sort</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as AdminFilters["sort"] })}
          >
            <option value="">Newest</option>
            <option value="price_asc">Price low-high</option>
            <option value="price_desc">Price high-low</option>
            <option value="mileage_asc">Mileage low-high</option>
            <option value="mileage_desc">Mileage high-low</option>
          </select>
        </label>
      </div>

      <div className={styles.fbFooter}>
        <span className={styles.countText}>
          {loading ? "Counting..." : `${fmt(count)} cars match`}
        </span>
        {!isDefault && (
          <button type="button" className={styles.fbReset} onClick={() => onChange({ ...DEFAULT_FILTERS })}>
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
