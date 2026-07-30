"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface MakeOption {
  make: string;
  n: number;
}

const BUDGETS = [20000, 25000, 30000, 35000, 40000, 50000, 60000, 80000, 100000];

export default function HomeSearchPanel({
  makes,
  totalCount,
}: {
  makes: MakeOption[];
  totalCount: number;
}) {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [budget, setBudget] = useState("");
  const [models, setModels] = useState<{ car_model: string; total: number }[]>([]);

  useEffect(() => {
    setModel("");
    if (!make) {
      setModels([]);
      return;
    }
    let cancelled = false;
    fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Make: make }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.model ?? []);
        setModels(list.filter((m: { car_model: string }) => m.car_model));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [make]);

  function search() {
    const params = new URLSearchParams();
    if (make) params.set("Make", make);
    if (model) params.set("Model", model);
    if (budget) params.set("maxPrice", budget);
    router.push(`/used-cars${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className={styles.searchPanel}>
      <div className={styles.searchPanelHeader}>Let&apos;s Find You a Car</div>
      <div className={styles.searchPanelBody}>
        <select value={make} onChange={(e) => setMake(e.target.value)} aria-label="Make">
          <option value="">Any make</option>
          {makes.map((m) => (
            <option key={m.make} value={m.make}>
              {m.make.replace(/\b\w/g, (c) => c.toUpperCase())} ({m.n.toLocaleString()})
            </option>
          ))}
        </select>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!make}
          aria-label="Model"
        >
          <option value="">Any model</option>
          {models.map((m) => (
            <option key={m.car_model} value={m.car_model}>
              {m.car_model} ({m.total.toLocaleString()})
            </option>
          ))}
        </select>
        <select value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Max budget">
          <option value="">Max budget</option>
          {BUDGETS.map((b) => (
            <option key={b} value={b}>
              up to €{b.toLocaleString()}
            </option>
          ))}
        </select>
        <button type="button" className={styles.searchPanelButton} onClick={search}>
          Search {totalCount.toLocaleString()} cars
        </button>
        <button
          type="button"
          className={styles.searchPanelMore}
          onClick={() => router.push("/used-cars")}
        >
          More filters &rarr;
        </button>
      </div>
    </div>
  );
}
