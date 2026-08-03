"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CardsGrid from "./CardsGrid";
import pageStyles from "./page.module.css";
import styles from "./FilterBar.module.css";

interface Option {
  label: string;
  total: number;
}

interface Car {
  car_id: string;
  car_name: string;
  featured_image: string;
  car_images: string;
  registration_date: string;
  transmission_name: string;
  fuel_type_name: string;
  mileage: string;
  premium_car: number;
  is_manheim_car: string;
  car_info?: { final_price?: number };
  bestseller_tier?: string | null;
  bestseller_saving_eur?: number | null;
}

interface FilterBarProps {
  initialMakes: Option[];
  initialFuels: Option[];
  initialBodyStyles: Option[];
  initialTransmissions: Option[];
  initialSeats: Option[];
  currentMake: string;
  currentModel: string;
  currentFuel: string;
  currentBodyStyle: string;
  currentTransmission: string;
  currentSeats: string;
  currentColor: string;
  currentMinEnginesize: string;
  currentMaxEnginesize: string;
  currentMinYear: string;
  currentMaxYear: string;
  currentMinPrice: string;
  currentMaxPrice: string;
  currentMinMileage: string;
  currentMaxMileage: string;
  currentSearchChips: string[];
  currentVersionChips: string[];
  currentSort: string;
  currentBestseller: string;
  initialCars: Car[];
  initialCount: number;
  currentPage: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
}

const COLOURS = [
  "Beige", "Black", "Blue", "Bronze", "Burgundy", "Gold", "Green", "Grey", "Indigo",
  "Magenta", "Maroon", "Multicolour", "Navy", "Orange", "Pink", "Purple", "Red",
  "Silver", "Turquoise", "Unlisted", "White", "Yellow",
];

const QUICK_PICKS = ["Leather seats", "Heated seats", "Panoramic roof", "Apple CarPlay", "Android Auto", "Sat nav"];

// Matches the live site's real hardcoded option lists exactly (UsedCars.jsx).
const YEAR_OPTIONS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
// Public min price floor is 15000 on the live site (PUBLIC_MIN_FINAL_PRICE) --
// non-admin users never see or can select anything below it.
const PRICE_OPTIONS = Array.from({ length: (500000 - 15000) / 5000 + 1 }, (_, i) => 15000 + i * 5000);
const MILEAGE_OPTIONS = Array.from({ length: 500000 / 5000 + 1 }, (_, i) => i * 5000);

// vrtFilter + the €15k floor are the standing public-display rules the
// legacy site always applied (no POA cars, no sub-€15k stock) — keep every
// count and listing on the same population as the canonical stock number.
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

function ChipSearch({
  label,
  placeholder,
  chips,
  onChipsChange,
  quickPicks,
}: {
  label: string;
  placeholder: string;
  chips: string[];
  onChipsChange: (chips: string[]) => void;
  quickPicks?: string[];
}) {
  const [inputValue, setInputValue] = useState("");

  function addChip(raw: string) {
    const term = raw.trim();
    if (!term) return;
    const key = term.toLowerCase();
    if (chips.some((c) => c.toLowerCase() === key)) {
      setInputValue("");
      return;
    }
    onChipsChange([...chips, term]);
    setInputValue("");
  }

  function removeChip(term: string) {
    onChipsChange(chips.filter((c) => c !== term));
  }

  return (
    <div className={styles.chipSearchWrap}>
      <label className={styles.chipSearchLabel}>{label}</label>
      <input
        type="text"
        className={styles.chipInput}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addChip(inputValue);
          }
        }}
      />
      {quickPicks && (
        <div className={styles.quickPicks}>
          {quickPicks.map((term) => (
            <button key={term} type="button" className={styles.quickPickBtn} onClick={() => addChip(term)}>
              {term}
            </button>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className={styles.chipRow}>
          {chips.map((chip) => {
            const excluded = chip.indexOf("-") === 0;
            const chipLabel = excluded ? chip.slice(1) : chip;
            return (
              <span key={chip} className={`${styles.chip} ${excluded ? styles.chipExclude : ""}`}>
                {excluded ? "not " : ""}
                {chipLabel}
                <button type="button" onClick={() => removeChip(chip)} aria-label={`Remove ${chipLabel}`}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <p className={styles.chipHint}>
        Press Enter to add a term. Prefix with <code>-</code> to exclude one.
      </p>
    </div>
  );
}

export default function FilterBar({
  initialMakes,
  initialFuels,
  initialBodyStyles,
  initialTransmissions,
  initialSeats,
  currentMake,
  currentModel,
  currentFuel,
  currentBodyStyle,
  currentTransmission,
  currentSeats,
  currentColor,
  currentMinEnginesize,
  currentMaxEnginesize,
  currentMinYear,
  currentMaxYear,
  currentMinPrice,
  currentMaxPrice,
  currentMinMileage,
  currentMaxMileage,
  currentSearchChips,
  currentVersionChips,
  currentSort,
  currentBestseller,
  initialCars,
  initialCount,
  currentPage,
  totalPages,
  prevHref,
  nextHref,
}: FilterBarProps) {
  const router = useRouter();
  const [make, setMake] = useState(currentMake);
  const [model, setModel] = useState(currentModel);
  const [fuel, setFuel] = useState(currentFuel);
  const [bodyStyle, setBodyStyle] = useState(currentBodyStyle);
  const [transmission, setTransmission] = useState(currentTransmission);
  const [seats, setSeats] = useState(currentSeats);
  const [color, setColor] = useState(currentColor);
  const [minEnginesize, setMinEnginesize] = useState(currentMinEnginesize);
  const [maxEnginesize, setMaxEnginesize] = useState(currentMaxEnginesize);
  const [minYear, setMinYear] = useState(currentMinYear);
  const [maxYear, setMaxYear] = useState(currentMaxYear);
  const [minPrice, setMinPrice] = useState(currentMinPrice);
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice);
  const [minMileage, setMinMileage] = useState(currentMinMileage);
  const [maxMileage, setMaxMileage] = useState(currentMaxMileage);
  const [searchChips, setSearchChips] = useState<string[]>(currentSearchChips);
  const [versionChips, setVersionChips] = useState<string[]>(currentVersionChips);
  const [sort, setSort] = useState(currentSort);
  const [bestseller, setBestseller] = useState(currentBestseller);
  const [models, setModels] = useState<Option[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [liveCars, setLiveCars] = useState<Car[]>(initialCars);
  const [liveCount, setLiveCount] = useState(initialCount);
  const [countLoading, setCountLoading] = useState(false);

  // Infinite scroll (AutoTrader-style, owner request 2026-07-31): more cars
  // append as the sentinel below the grid nears the viewport. The classic
  // ?page links stay in the server HTML for crawlers/no-JS, but hide once
  // scroll-loading has taken over.
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPage, setLoadedPage] = useState(currentPage);
  const endRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);
  const loadMoreRef = useRef<() => void>(() => {});

  // True once the user changes anything from the URL-applied state -- while
  // true we're showing a live preview (page 1 only, no sort applied server
  // side yet), so real pagination controls don't make sense until Apply.
  const dirty =
    make !== currentMake ||
    model !== currentModel ||
    fuel !== currentFuel ||
    bodyStyle !== currentBodyStyle ||
    transmission !== currentTransmission ||
    seats !== currentSeats ||
    color !== currentColor ||
    minEnginesize !== currentMinEnginesize ||
    maxEnginesize !== currentMaxEnginesize ||
    minYear !== currentMinYear ||
    maxYear !== currentMaxYear ||
    minPrice !== currentMinPrice ||
    maxPrice !== currentMaxPrice ||
    minMileage !== currentMinMileage ||
    maxMileage !== currentMaxMileage ||
    sort !== currentSort ||
    bestseller !== currentBestseller ||
    searchChips.join(" ") !== currentSearchChips.join(" ") ||
    versionChips.join(" ") !== currentVersionChips.join(" ");

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

  useEffect(() => {
    if (currentMake) fetchModels(currentMake);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            seats,
            color,
            minEnginesize,
            maxEnginesize,
            minYear,
            maxYear,
            minPrice: minPrice || "15000",
            maxPrice,
            minMileage,
            maxMileage,
            search: searchChips.join(" "),
            searchChips,
            version: versionChips.join(" "),
            versionChips,
            price_sort,
            mileage_sort,
            bestsellerSeries: bestseller,
            pagenum: 0,
            limit: 25,
          }),
        });
        const data = await res.json();
        if (typeof data?.data?.count === "number") setLiveCount(data.data.count);
        if (Array.isArray(data?.data?.cars)) {
          setLiveCars(data.data.cars);
          setLoadedPage(1);
        }
      } catch {
        // Leave the last known results showing rather than a jarring reset.
      } finally {
        setCountLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, model, fuel, bodyStyle, transmission, seats, color, minEnginesize, maxEnginesize, minYear, maxYear, minPrice, maxPrice, minMileage, maxMileage, searchChips, versionChips, sort, bestseller]);

  // Reassigned every render so the IntersectionObserver callback always sees
  // the current filter state without re-registering the observer.
  loadMoreRef.current = async () => {
    if (busyRef.current || loadingMore) return;
    if (liveCars.length >= liveCount) return;
    busyRef.current = true;
    setLoadingMore(true);
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
          seats,
          color,
          minEnginesize,
          maxEnginesize,
          minYear,
          maxYear,
          minPrice: minPrice || "15000",
          maxPrice,
          minMileage,
          maxMileage,
          search: searchChips.join(" "),
          searchChips,
          version: versionChips.join(" "),
          versionChips,
          price_sort,
          mileage_sort,
          bestsellerSeries: bestseller,
          pagenum: loadedPage + 1,
          limit: 25,
        }),
      });
      const data = await res.json();
      const batch: Car[] = Array.isArray(data?.data?.cars) ? data.data.cars : [];
      if (batch.length) {
        setLiveCars((prev) => {
          const seen = new Set(prev.map((c) => c.car_id));
          return [...prev, ...batch.filter((c) => !seen.has(c.car_id))];
        });
      }
      setLoadedPage((p) => p + 1);
      if (typeof data?.data?.count === "number") setLiveCount(data.data.count);
    } catch {
      // Quiet failure: the sentinel will simply retry on the next intersect.
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const el = endRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "800px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
    if (seats) params.set("seats", seats);
    if (color) params.set("color", color);
    if (minEnginesize) params.set("minEnginesize", minEnginesize);
    if (maxEnginesize) params.set("maxEnginesize", maxEnginesize);
    if (minYear) params.set("minYear", minYear);
    if (maxYear) params.set("maxYear", maxYear);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minMileage) params.set("minMileage", minMileage);
    if (maxMileage) params.set("maxMileage", maxMileage);
    searchChips.forEach((c) => params.append("searchChips", c));
    versionChips.forEach((c) => params.append("versionChips", c));
    if (price_sort) params.set("price_sort", price_sort);
    if (mileage_sort) params.set("mileage_sort", mileage_sort);
    if (bestseller) params.set("bestseller", bestseller);
    const qs = params.toString();
    router.push(qs ? `/used-cars?${qs}` : "/used-cars");
  }

  function clearAll() {
    router.push("/used-cars");
  }

  const hasAnyFilter = !!(
    make || model || fuel || bodyStyle || transmission || seats || color ||
    minEnginesize || maxEnginesize || minYear || maxYear || minPrice || maxPrice ||
    minMileage || maxMileage || searchChips.length || versionChips.length || sort || bestseller
  );

  const activeFilters = [bestseller ? "Bestseller Series" : "", make, model, fuel, bodyStyle, transmission, seats ? `${seats} seats` : "", color].filter(Boolean);

  return (
    <>
      <div className={styles.wrapper}>
        <button
          type="button"
          className={`${styles.bestsellerToggle} ${bestseller ? styles.bestsellerToggleOn : ""}`}
          onClick={() => setBestseller(bestseller ? "" : "1")}
          aria-pressed={!!bestseller}
        >
          <span className={styles.bestsellerFlash} aria-hidden="true">&#9889;</span>
          Bestseller Series
          <span className={styles.bestsellerToggleHint}>
            {bestseller ? "Showing cars priced under the Irish market" : "Cars priced under the Irish market"}
          </span>
        </button>

        <ChipSearch
          label="Search features"
          placeholder="e.g. leather seats, Apple CarPlay"
          chips={searchChips}
          onChipsChange={setSearchChips}
          quickPicks={QUICK_PICKS}
        />
        <ChipSearch
          label="Version / trim"
          placeholder="e.g. Inscription"
          chips={versionChips}
          onChipsChange={setVersionChips}
        />

        <div className={styles.bar}>
          <select className={styles.select} value={make} onChange={(e) => handleMakeChange(e.target.value)} aria-label="Make">
            <option value="">All Makes</option>
            {initialMakes.map((m) => (
              <option key={m.label} value={m.label}>{m.label} ({m.total})</option>
            ))}
          </select>

          <select className={styles.select} value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} aria-label="Model">
            <option value="">{modelsLoading ? "Loading..." : "All Models"}</option>
            {models.map((m) => (
              <option key={m.label} value={m.label}>{m.label} ({m.total})</option>
            ))}
          </select>

          <select className={styles.select} value={bodyStyle} onChange={(e) => setBodyStyle(e.target.value)} aria-label="Body Type">
            <option value="">All Body Types</option>
            {initialBodyStyles.map((b) => (
              <option key={b.label} value={b.label}>{b.label} ({b.total})</option>
            ))}
          </select>

          <select className={styles.select} value={fuel} onChange={(e) => setFuel(e.target.value)} aria-label="Fuel Type">
            <option value="">All Fuel Types</option>
            {initialFuels.map((f) => (
              <option key={f.label} value={f.label}>{f.label} ({f.total})</option>
            ))}
          </select>

          <select className={styles.select} value={transmission} onChange={(e) => setTransmission(e.target.value)} aria-label="Gearbox">
            <option value="">All Gearboxes</option>
            {initialTransmissions.map((t) => (
              <option key={t.label} value={t.label}>{t.label} ({t.total})</option>
            ))}
          </select>

          <select className={styles.select} value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="No of Seats">
            <option value="">Any Seats</option>
            {initialSeats.map((s) => (
              <option key={s.label} value={s.label}>{s.label} seats ({s.total})</option>
            ))}
          </select>

          <select className={styles.select} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour">
            <option value="">Any Colour</option>
            {COLOURS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <input
            type="number"
            className={styles.select}
            placeholder="Min Engine (L)"
            value={minEnginesize}
            onChange={(e) => setMinEnginesize(e.target.value)}
            aria-label="Min Engine Size"
            step="0.1"
            min="0"
          />
          <input
            type="number"
            className={styles.select}
            placeholder="Max Engine (L)"
            value={maxEnginesize}
            onChange={(e) => setMaxEnginesize(e.target.value)}
            aria-label="Max Engine Size"
            step="0.1"
            min="0"
          />

          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.rangeSection}>
          <span className={styles.rangeLabel}>Year</span>
          <select className={styles.select} value={minYear} onChange={(e) => setMinYear(e.target.value)} aria-label="Min Year">
            <option value="">Min Year</option>
            {YEAR_OPTIONS.filter((y) => !maxYear || y <= maxYear).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className={styles.select} value={maxYear} onChange={(e) => setMaxYear(e.target.value)} aria-label="Max Year">
            <option value="">Max Year</option>
            {YEAR_OPTIONS.filter((y) => !minYear || y >= minYear).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <span className={styles.rangeLabel}>Price</span>
          <select className={styles.select} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} aria-label="Min Price">
            <option value="">Min Price</option>
            {PRICE_OPTIONS.filter((p) => !maxPrice || p < Number(maxPrice)).map((p) => (
              <option key={p} value={p}>€{p.toLocaleString("en-IE")}</option>
            ))}
          </select>
          <select className={styles.select} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Max Price">
            <option value="">Max Price</option>
            {PRICE_OPTIONS.filter((p) => !minPrice || p > Number(minPrice)).map((p) => (
              <option key={p} value={p}>€{p.toLocaleString("en-IE")}</option>
            ))}
          </select>

          <span className={styles.rangeLabel}>Mileage</span>
          <select className={styles.select} value={minMileage} onChange={(e) => setMinMileage(e.target.value)} aria-label="Min Mileage">
            <option value="">Min Mileage</option>
            {MILEAGE_OPTIONS.filter((m) => !maxMileage || m < Number(maxMileage)).map((m) => (
              <option key={m} value={m}>{m.toLocaleString("en-IE")} km</option>
            ))}
          </select>
          <select className={styles.select} value={maxMileage} onChange={(e) => setMaxMileage(e.target.value)} aria-label="Max Mileage">
            <option value="">Max Mileage</option>
            {MILEAGE_OPTIONS.filter((m) => !minMileage || m > Number(minMileage)).map((m) => (
              <option key={m} value={m}>{m.toLocaleString("en-IE")} km</option>
            ))}
          </select>
        </div>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.applyButton} onClick={applyFilters}>Apply Filters</button>

          {hasAnyFilter && (
            <button type="button" className={styles.clearButton} onClick={clearAll}>Clear all</button>
          )}
        </div>

        <div className={styles.liveCount} aria-live="polite">
          {countLoading ? "Updating…" : `${liveCount.toLocaleString("en-IE")} vehicles match`}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className={pageStyles.activeFilters}>
          <span>Filtered by: {activeFilters.join(", ")}</span>
        </div>
      )}

      <CardsGrid cars={liveCars} />

      {liveCars.length === 0 && (
        <p className={pageStyles.noResults}>No cars match these filters.</p>
      )}

      <div ref={endRef} aria-hidden="true" />
      {loadingMore && <p className={pageStyles.loadingMore}>Loading more cars&hellip;</p>}
      {liveCars.length > 0 && liveCars.length >= liveCount && (
        <p className={pageStyles.loadingMore}>
          That&rsquo;s all {liveCount.toLocaleString("en-IE")} — every matching car is above.
        </p>
      )}

      {!dirty && loadedPage === currentPage && liveCars.length > 0 && totalPages > 1 && (
        <nav className={pageStyles.pagination} aria-label="Pagination">
          {prevHref ? (
            <Link href={prevHref} className={pageStyles.pageLink}>&larr; Previous</Link>
          ) : (
            <span className={pageStyles.pageLinkDisabled}>&larr; Previous</span>
          )}

          <span className={pageStyles.pageStatus}>
            Page {currentPage.toLocaleString("en-IE")} of {totalPages.toLocaleString("en-IE")}
          </span>

          {nextHref ? (
            <Link href={nextHref} className={pageStyles.pageLink}>Next &rarr;</Link>
          ) : (
            <span className={pageStyles.pageLinkDisabled}>Next &rarr;</span>
          )}
        </nav>
      )}
    </>
  );
}
