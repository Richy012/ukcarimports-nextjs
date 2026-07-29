"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./FilterBar.module.css";

interface Option {
  label: string;
  total: number;
}

interface FilterBarProps {
  initialMakes: Option[];
  initialFuels: Option[];
  initialBodyStyles: Option[];
  initialTransmissions: Option[];
  currentMake: string;
  currentModel: string;
  currentFuel: string;
  currentBodyStyle: string;
  currentTransmission: string;
  currentSort: string;
  initialCount: number;
}

const FILTER_BODY_DEFAULTS = {
  is_manheim_car: "0",
  premium_car: 0,
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
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
};

const SORT_OPTIONS = [
  { value: "", label: "Sort by" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "mileage_low", label: "Mileage: Low to High" },
  { value: "mileage_high", label: "Mileage: High to Low" },
];

function sortToParams(sort: string): { price_sort: string; mileage_sort: string } {
  if (sort === "price_low") return { price_sort: "low", mileage_sort: "" };
  if (sort === "price_high") return { price_sort: "high", mileage_sort: "" };
  if (sort === "mileage_low") return { price_sort: "", mileage_sort: "low" };
  if (sort === "mileage_high") return { price_sort: "", mileage_sort: "high" };
  return { price_sort: "", mileage_sort: "" };
}

export default function FilterBar({
  initialMakes,
  initialFuels,
  initialBodyStyles,
  initialTransmissions,
  currentMake,
  currentModel,
  currentFuel,
  currentBodyStyle,
  currentTransmission,
  currentSort,
  initialCount,
}: FilterBarProps) {
  const router = useRouter();
  const [make, setMake] = useState(currentMake);
  const [model, setModel] = useState(currentModel);
  const [fuel, setFuel] = useState(currentFuel);
  const [bodyStyle, setBodyStyle] = useState(currentBodyStyle);
  const [transmission, setTransmission] = useState(currentTransmission);
  const [sort, setSort] = useState(currentSort);
  const [models, setModels] = useState<Option[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(initialCount);
  const [countLoading, setCountLoading] = useState(false);

  async function fetchModels(forMake: string) {
    if (!forMake) {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...FILTER_BODY_DEFAULTS, Make: forMake }),
      });
      const data = await res.json();
      setModels(
        (data.model || [])
          .filter((m: { car_model: string }) => m.car_model)
          .map((m: { car_model: string; total: number }) => ({
            label: m.car_model,
            total: m.total,
          })),
      );
    } finally {
      setModelsLoading(false);
    }
  }

  // Pre-load the model list on first render if the page was reached with a
  // Make already set (e.g. a bookmarked/shared filtered URL), so the Model
  // dropdown isn't empty and the current selection stays visible.
  useEffect(() => {
    if (currentMake) fetchModels(currentMake);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live result count for the currently-selected (not-yet-applied) filter
  // combination -- debounced so picking through several dropdowns quickly
  // doesn't fire a request per keystroke-equivalent change.
  useEffect(() => {
    const timer = setTimeout(async () => {
      setCountLoading(true);
      try {
        const { price_sort, mileage_sort } = sortToParams(sort);
        const res = await fetch("/api/car-count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...FILTER_BODY_DEFAULTS,
            Make: make,
            Model: model,
            Fuel: fuel,
            body_style: bodyStyle,
            transmission_type: transmission,
            price_sort,
            mileage_sort,
            pagenum: 0,
            limit: 1,
          }),
        });
        const data = await res.json();
        if (typeof data?.data?.count === "number") setLiveCount(data.data.count);
      } catch {
        // Leave the last known count showing rather than a jarring reset.
      } finally {
        setCountLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, model, fuel, bodyStyle, transmission, sort]);

  function handleMakeChange(newMake: string) {
    setMake(newMake);
    setModel("");
    fetchModels(newMake);
  }

  function applyFilters() {
    const { price_sort, mileage_sort } = sortToParams(sort);
    const params = new URLSearchParams();
    if (make) params.set("Make", make);
    if (model) params.set("Model", model);
    if (fuel) params.set("Fuel", fuel);
    if (bodyStyle) params.set("body_style", bodyStyle);
    if (transmission) params.set("transmission_type", transmission);
    if (price_sort) params.set("price_sort", price_sort);
    if (mileage_sort) params.set("mileage_sort", mileage_sort);
    const qs = params.toString();
    router.push(qs ? `/used-cars?${qs}` : "/used-cars");
  }

  function clearAll() {
    router.push("/used-cars");
  }

  const hasAnyFilter = !!(make || model || fuel || bodyStyle || transmission || sort);

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <select
          className={styles.select}
          value={make}
          onChange={(e) => handleMakeChange(e.target.value)}
          aria-label="Make"
        >
          <option value="">All Makes</option>
          {initialMakes.map((m) => (
            <option key={m.label} value={m.label}>
              {m.label} ({m.total})
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!make}
          aria-label="Model"
        >
          <option value="">{modelsLoading ? "Loading..." : "All Models"}</option>
          {models.map((m) => (
            <option key={m.label} value={m.label}>
              {m.label} ({m.total})
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={bodyStyle}
          onChange={(e) => setBodyStyle(e.target.value)}
          aria-label="Body Type"
        >
          <option value="">All Body Types</option>
          {initialBodyStyles.map((b) => (
            <option key={b.label} value={b.label}>
              {b.label} ({b.total})
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
          aria-label="Fuel Type"
        >
          <option value="">All Fuel Types</option>
          {initialFuels.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label} ({f.total})
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={transmission}
          onChange={(e) => setTransmission(e.target.value)}
          aria-label="Gearbox"
        >
          <option value="">All Gearboxes</option>
          {initialTransmissions.map((t) => (
            <option key={t.label} value={t.label}>
              {t.label} ({t.total})
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button type="button" className={styles.applyButton} onClick={applyFilters}>
          Apply Filters
        </button>

        {hasAnyFilter && (
          <button type="button" className={styles.clearButton} onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      <div className={styles.liveCount} aria-live="polite">
        {countLoading ? "Updating…" : `${liveCount.toLocaleString("en-IE")} vehicles match`}
      </div>
    </div>
  );
}
