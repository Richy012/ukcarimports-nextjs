"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CANONICAL_BROWSE_BODY } from "@/lib/stockCount";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

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
  const [count, setCount] = useState(totalCount);

  // Live count: the button re-counts as make/model/budget change, exactly
  // like the used-cars filter bar — a static number next to chosen filters
  // reads as broken (owner caught it).
  useEffect(() => {
    if (!make && !model && !budget) {
      setCount(totalCount);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API_BASE}/allcarsnew/0/1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...CANONICAL_BROWSE_BODY,
          Make: make,
          Model: model,
          maxPrice: budget,
        }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d) => {
          const c = d?.data?.count;
          if (typeof c === "number") setCount(c);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [make, model, budget, totalCount]);

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
      <div className={styles.searchPanelHeader}>LET&apos;S FIND A CAR FOR YOU!</div>
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
          {/* Unfiltered = the rounded marketing figure the hero shows, so
              the two never disagree; a real filter result stays exact. */}
          Search {count.toLocaleString()}{count === totalCount ? "+" : ""} cars
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
