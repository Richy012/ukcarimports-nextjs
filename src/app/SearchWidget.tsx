"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./SearchWidget.module.css";

interface Option {
  label: string;
  total: number;
}

export default function SearchWidget({
  initialMakes,
  initialFuels,
  initialBodyStyles,
  initialTransmissions,
}: {
  initialMakes: Option[];
  initialFuels: Option[];
  initialBodyStyles: Option[];
  initialTransmissions: Option[];
}) {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuel, setFuel] = useState("");
  const [bodyStyle, setBodyStyle] = useState("");
  const [transmission, setTransmission] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  async function handleMakeChange(newMake: string) {
    setMake(newMake);
    setModel("");
    setModels([]);
    if (!newMake) return;
    setModelsLoading(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_manheim_car: "0",
          premium_car: 0,
          minPrice: "",
          maxPrice: "",
          minYear: "",
          maxYear: "",
          Make: newMake,
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

  function handleSearch() {
    const params = new URLSearchParams({ filter: "true" });
    if (make) params.set("Make", make);
    if (model) params.set("Model", model);
    if (fuel) params.set("Fuel", fuel);
    if (bodyStyle) params.set("body_style", bodyStyle);
    if (transmission) params.set("transmission_type", transmission);
    router.push(`/used-cars?${params.toString()}`);
  }

  return (
    <div className={styles.widget}>
      <h3 className={styles.heading}>Start Your Search Here</h3>
      <div className={styles.grid}>
        <select
          className={styles.select}
          value={make}
          onChange={(e) => handleMakeChange(e.target.value)}
          aria-label="Make"
        >
          <option value="">Make</option>
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
          <option value="">{modelsLoading ? "Loading..." : "Model"}</option>
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
          <option value="">Body Type</option>
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
          <option value="">Fuel Type</option>
          {initialFuels.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label} ({f.total})
            </option>
          ))}
        </select>

        <select
          className={styles.selectWide}
          value={transmission}
          onChange={(e) => setTransmission(e.target.value)}
          aria-label="Gearbox"
        >
          <option value="">GearBox</option>
          {initialTransmissions.map((t) => (
            <option key={t.label} value={t.label}>
              {t.label} ({t.total})
            </option>
          ))}
        </select>
      </div>
      <button type="button" className={styles.searchButton} onClick={handleSearch}>
        Search Vehicles
      </button>
    </div>
  );
}
