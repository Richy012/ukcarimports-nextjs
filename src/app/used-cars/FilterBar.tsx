"use client";

import RecentSearches, { rememberSearch } from "./RecentSearches";
import { publishHeadlineCount } from "./HeadlineCount";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CardsGrid from "./CardsGrid";
import pageStyles from "./page.module.css";
import SaveSearchPrompt from "./SaveSearchPrompt";
import { FollowStrip } from "@/app/components/FollowUs";
import styles from "./FilterBar.module.css";
import { PUBLIC_FLOOR_EUR } from "@/lib/stockCount";
import { RUNG_CHIPS } from "@/lib/ladder";
import { FACET_NAMES, facetBody, keepSelected, parseFacet, type FacetName } from "@/lib/facets";

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
  initialModels: Option[];
  initialFuels: Option[];
  initialBodyStyles: Option[];
  initialTransmissions: Option[];
  initialSeats: Option[];
  initialColours: Option[];
  initialEngines: Option[];
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
  currentMinSaving: string;
  currentBelowCheapest: string;
  initialCars: Car[];
  initialCount: number;
  currentPage: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
  // website review 3 Oct 2026 #33: pairs this bar with the page headline (HeadlineCount).
  headlineKey?: string;
}

// Back on 3 Oct 2026 (owner): the box now resolves a buyer's words to tested synonym groups across all seven
// equipment columns (API: App\Services\FeatureConcepts; results in FEATURE_SEARCH_GROUPS_2OCT.md).
const FEATURE_SEARCH_ENABLED = true;

const QUICK_PICKS = ["Leather seats", "Heated seats", "Panoramic roof", "Apple CarPlay", "Android Auto", "Sat nav"];

// Matches the live site's real hardcoded option lists exactly (UsedCars.jsx).
const YEAR_OPTIONS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
// Public min price floor is 15000 on the live site (PUBLIC_MIN_FINAL_PRICE) --
// non-admin users never see or can select anything below it.
const PRICE_OPTIONS = Array.from({ length: (500000 - 10000) / 5000 + 1 }, (_, i) => 10000 + i * 5000);
const MILEAGE_OPTIONS = Array.from({ length: 500000 / 5000 + 1 }, (_, i) => i * 5000);

// vrtFilter + the €15k floor are the standing public-display rules the
// legacy site always applied (no POA cars, no sub-€15k stock) — keep every
// count and listing on the same population as the canonical stock number.
const FILTER_BODY_DEFAULTS = {
  is_manheim_car: "0",
  premium_car: "0",
  // ONE number across the site (owner, 2026-08-25). These are the facet counts
  // in the make/model dropdowns, and they MUST sit on the same population as
  // the listing and the live preview beside them. The preview sends
  // minPrice || "1"; this sent "" and CarsNewTwoController caches counts for
  // 30 minutes KEYED ON THE FILTER VALUES, so "" was a different cache entry
  // that expired at a different time and drifted. That drift is exactly what
  // the "the count told the truth" E2E test catches.
  // (The old comment here still spoke of a €15k floor; PUBLIC_FLOOR_EUR has
  // been "1" since 2026-08-21 — see lib/stockCount.ts.)
  minPrice: PUBLIC_FLOOR_EUR,
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
  { value: "drop_big", label: "Biggest price drop" },
  { value: "saving_big", label: "Biggest saving vs Ireland" },
];

function sortToParams(sort: string): { price_sort: string; mileage_sort: string; drop_sort: string; saving_sort: string } {
  if (sort === "price_low") return { price_sort: "low", mileage_sort: "", drop_sort: "", saving_sort: "" };
  if (sort === "price_high") return { price_sort: "high", mileage_sort: "", drop_sort: "", saving_sort: "" };
  if (sort === "mileage_low") return { price_sort: "", mileage_sort: "low", drop_sort: "", saving_sort: "" };
  if (sort === "mileage_high") return { price_sort: "", mileage_sort: "high", drop_sort: "", saving_sort: "" };
  if (sort === "drop_big") return { price_sort: "", mileage_sort: "", drop_sort: "1", saving_sort: "" };
  if (sort === "saving_big") return { price_sort: "", mileage_sort: "", drop_sort: "", saving_sort: "1" };
  return { price_sort: "", mileage_sort: "", drop_sort: "", saving_sort: "" };
}

// Biggest saving first is the default order inside the badge set unless another sort was chosen (page.tsx getCars
// does the same). The API reads savingfilter as "badge cars only" too, so the listing AND the dropdown counts send it
// (website review 3 Oct 2026 #11 #13).
function savingFilterFor(sort: string, bestseller: string, minSaving: string, belowCheapest: string): string {
  const { price_sort, mileage_sort, drop_sort, saving_sort } = sortToParams(sort);
  return saving_sort || ((bestseller || minSaving || belowCheapest) && !price_sort && !mileage_sort && !drop_sort ? "1" : "");
}

type FeatureResolve = {
  resolved: { id: string; label: string } | null;
  suggestions: { id: string; label: string }[];
  // website review 3 Oct 2026 #37: "7 seats" / "7-seater" is a seat count, searched on the seats column
  seats?: string;
  // website review 3 Oct 2026 #78: the words are a version / trim ("m sport") - offer the Version / trim box
  trim?: boolean;
};

// The Version / trim box's check of an added term (website review 3 Oct 2026 #42): how many live cars carry it and, when
// none do, the nearest trim name or the feature the words name.
type TrimCheck = {
  trimCars: number | null;
  trimSuggest: string | null;
  feature: { id: string; label: string } | null;
};

// A message under a chip box. It belongs to the chip it describes and goes when that chip is removed (#77).
type ChipNotice = { chip: string; text: string; actions?: { label: string; run: () => void }[] };

function ChipSearch({
  label,
  placeholder,
  chips,
  onChipsChange,
  quickPicks,
  onDraftChange,
  note,
  coach,
  commitRef,
  trimCheck,
  onTrim,
  onFeature,
}: {
  label: string;
  placeholder: string;
  chips: string[];
  onChipsChange: (chips: string[]) => void;
  quickPicks?: string[];
  onDraftChange?: (draft: string) => void;
  note?: string;
  // Owner, 3 Oct 2026: show buyers what their words are searched as, and when they are not obvious, ask them to
  // pick the feature they mean ("Do you mean Leather seats?"). Backed by /api/feature-resolve.
  coach?: boolean;
  // website review 3 Oct 2026 #36: lets Apply add the text still in the box first (see FilterBar applyFilters).
  commitRef?: { current: (() => Promise<string[] | null>) | null };
  // website review 3 Oct 2026 #42: the Version / trim box says so when no live car's version or trim has the words
  trimCheck?: boolean;
  // website review 3 Oct 2026 #78: features box - send trim words ("m sport") to the Version / trim box
  onTrim?: (term: string) => void;
  // website review 3 Oct 2026 #42: Version / trim box - send a feature ("leather seats") to the Search features box
  onFeature?: (label: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [live, setLive] = useState<{ term: string; r: FeatureResolve } | null>(null);
  const [asking, setAsking] = useState<{ term: string; r: FeatureResolve } | null>(null);
  const [notice, setNotice] = useState<ChipNotice | null>(null);
  const cache = useRef(new Map<string, FeatureResolve>());
  // the chip list as of the latest render, for a message's button pressed later (#42)
  const chipsRef = useRef(chips);
  useEffect(() => {
    chipsRef.current = chips;
  }, [chips]);
  // the Version / trim term whose check is out; cleared when that chip is removed first (#42)
  const pendingTrim = useRef("");

  async function resolveTerm(term: string): Promise<FeatureResolve | null> {
    const t = term.trim();
    if (t.replace(/^-/, "").length < 2) return null;
    const k = t.toLowerCase();
    const hit = cache.current.get(k);
    if (hit) return hit;
    try {
      const r = (await fetch(`/api/feature-resolve?q=${encodeURIComponent(t)}`).then((x) => x.json())) as FeatureResolve;
      if (r && Array.isArray(r.suggestions)) {
        cache.current.set(k, r);
        return r;
      }
    } catch {
      /* coaching is a help, never a blocker: fall through to the plain chip */
    }
    return null;
  }

  useEffect(() => {
    if (!coach) return;
    const t = inputValue.trim();
    if (t.replace(/^-/, "").length < 2) {
      setLive(null);
      return;
    }
    const id = setTimeout(async () => {
      const r = await resolveTerm(t);
      setLive(r ? { term: t, r } : null);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, coach]);

  function commit(term: string): string[] {
    const key = term.toLowerCase();
    setAsking(null);
    setLive(null);
    setInputValue("");
    onDraftChange?.("");
    if (chips.some((c) => c.toLowerCase() === key)) return chips;
    const next = [...chips, term];
    onChipsChange(next);
    return next;
  }

  // website review 3 Oct 2026 #42: an added Version / trim term that no live car's version or trim contains gets a
  // message instead of a silent empty list, with the nearest trim name or the feature it names as a one-click fix.
  async function checkTrim(term: string) {
    if (term.startsWith("-")) return;
    pendingTrim.current = term;
    let r: TrimCheck | null = null;
    try {
      r = (await fetch(`/api/feature-resolve?box=trim&q=${encodeURIComponent(term)}`).then((x) => x.json())) as TrimCheck;
    } catch {
      return; // a help, never a blocker
    }
    if (!r || r.trimCars !== 0 || pendingTrim.current !== term) return;
    const actions: { label: string; run: () => void }[] = [];
    const fixed = r.trimSuggest;
    if (fixed) {
      actions.push({
        label: `Use ${fixed}`,
        run: () => {
          const rest = chipsRef.current.filter((c) => c !== term);
          onChipsChange(rest.some((c) => c.toLowerCase() === fixed.toLowerCase()) ? rest : [...rest, fixed]);
          setNotice(null);
        },
      });
    }
    const toFeature = onFeature;
    const feature = r.feature;
    if (feature && toFeature) {
      actions.push({
        label: `Search features for ${feature.label}`,
        run: () => {
          onChipsChange(chipsRef.current.filter((c) => c !== term));
          toFeature(feature.label);
          setNotice(null);
        },
      });
    }
    const hint = fixed ? ` Did you mean ${fixed}?` : feature ? ` ${feature.label} is a feature, not a trim.` : "";
    setNotice({ chip: term, text: `No version or trim contains "${term}".${hint}`, actions });
  }

  // Resolves to the chip list after the add, or null while the box is asking which feature was meant (website
  // review 3 Oct 2026 #36: Apply searches exactly that list).
  async function addChip(raw: string, fromBlur = false): Promise<string[] | null> {
    const term = raw.trim();
    if (!term) return chips;
    if (!coach) {
      const added = commit(term);
      if (trimCheck) void checkTrim(term);
      return added;
    }
    const neg = term.startsWith("-");
    const shown = term.replace(/^-/, "");
    // website review 3 Oct 2026 #76: one letter is never searched (the API skips it too) - "C" was quietly Air conditioning
    if (shown.replace(/[^a-z0-9]/gi, "").length < 2) {
      if (fromBlur) return null;
      setInputValue("");
      onDraftChange?.("");
      setNotice({ chip: "", text: `"${shown}" is too short to search for - type at least two letters.` });
      return chips;
    }
    const r = await resolveTerm(term);
    if (r?.seats && !neg) {
      // website review 3 Oct 2026 #37: a seat count, which the search filters on - not a seat feature
      setNotice({ chip: term, text: `Searching for ${r.seats}-seat cars.` });
      return commit(term);
    }
    if (r?.resolved) {
      setNotice(null);
      return commit((neg ? "-" : "") + r.resolved.label);
    }
    if (r && (r.suggestions.length > 0 || (r.trim && onTrim))) {
      // not obvious: ask the buyer to pick (a blur never forces the question; the text stays in the box)
      if (!fromBlur) setAsking({ term, r });
      return null;
    }
    if (fromBlur) return null;
    setNotice({ chip: term, text: `"${shown}" is not a feature we recognise, so we are searching the advert wording for it.` });
    return commit(term);
  }

  useEffect(() => {
    if (commitRef) commitRef.current = () => addChip(inputValue);
  });

  function choose(featureLabel: string, neg: boolean) {
    setNotice(null);
    commit((neg ? "-" : "") + featureLabel);
  }

  // website review 3 Oct 2026 #78: the words are a trim ("m sport") - they go to the Version / trim box instead
  function moveToTrim(term: string) {
    setAsking(null);
    setLive(null);
    setInputValue("");
    onDraftChange?.("");
    setNotice(null);
    onTrim?.(term);
  }

  function removeChip(term: string) {
    onChipsChange(chips.filter((c) => c !== term));
    // the message about a chip goes with it (website review 3 Oct 2026 #77)
    if (notice && notice.chip === term) setNotice(null);
    if (pendingTrim.current === term) pendingTrim.current = "";
  }

  const typed = inputValue.trim();
  const shownLive = coach && !asking && live && live.term === typed ? live.r : null;
  const liveTrim = !!(shownLive?.trim && onTrim);
  // keep the input focused while a choice is clicked, so the blur does not add the typed word first
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div className={styles.chipSearchWrap}>
      <label className={styles.chipSearchLabel}>{label}</label>
      <input
        type="text"
        className={styles.chipInput}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setAsking(null);
          onDraftChange?.(e.target.value);
          setNotice((n) => (n && n.chip === "" ? null : n));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void addChip(inputValue);
          }
        }}
        onBlur={() => void addChip(inputValue, true)}
      />
      {asking && (
        <div className={styles.coachBox} role="status">
          <span className={styles.coachText}>{`Which did you mean by "${asking.term.replace(/^-/, "")}"?`}</span>
          <div className={styles.quickPicks}>
            {asking.r.suggestions.map((sg) => (
              <button key={sg.id} type="button" className={styles.quickPickBtn} onMouseDown={keepFocus} onClick={() => choose(sg.label, asking.term.startsWith("-"))}>
                {sg.label}
              </button>
            ))}
            {asking.r.trim && onTrim && (
              <button type="button" className={styles.quickPickBtn} onMouseDown={keepFocus} onClick={() => moveToTrim(asking.term)}>
                {`Version / trim: ${asking.term.replace(/^-/, "")}`}
              </button>
            )}
            <button type="button" className={styles.coachPlain} onMouseDown={keepFocus} onClick={() => { setNotice(null); commit(asking.term); }}>
              {`Search the advert wording for "${asking.term.replace(/^-/, "")}"`}
            </button>
          </div>
        </div>
      )}
      {shownLive && (
        <div className={styles.coachBox} role="status">
          {shownLive.seats && !typed.startsWith("-") ? (
            <span className={styles.coachText}>
              {"Searching for "}<strong>{`${shownLive.seats}-seat cars`}</strong>{" - press Enter to add it."}
            </span>
          ) : shownLive.resolved ? (
            <span className={styles.coachText}>
              {"Searching for "}<strong>{shownLive.resolved.label}</strong>{" - press Enter to add it."}
            </span>
          ) : shownLive.suggestions.length > 0 || liveTrim ? (
            <span className={styles.coachText}>Do you mean:</span>
          ) : typed.replace(/^-/, "").length >= 3 ? (
            <span className={styles.coachText}>Not a feature we recognise - press Enter to search the advert wording for it.</span>
          ) : null}
          {(shownLive.suggestions.length > 0 || liveTrim) && (
            <div className={styles.quickPicks}>
              {shownLive.resolved && <span className={styles.coachText}>Or:</span>}
              {shownLive.suggestions.map((sg) => (
                <button key={sg.id} type="button" className={styles.quickPickBtn} onMouseDown={keepFocus} onClick={() => choose(sg.label, typed.startsWith("-"))}>
                  {sg.label}
                </button>
              ))}
              {liveTrim && (
                <button type="button" className={styles.quickPickBtn} onMouseDown={keepFocus} onClick={() => moveToTrim(typed)}>
                  {`Version / trim: ${typed.replace(/^-/, "")}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {quickPicks && (
        <div className={styles.quickPicks}>
          {quickPicks.map((term) => (
            <button key={term} type="button" className={styles.quickPickBtn} onClick={() => void addChip(term)}>
              {term}
            </button>
          ))}
        </div>
      )}
      {note && <p className={styles.chipHint}>{note}</p>}
      {notice && (
        <p className={styles.chipHint}>
          {notice.text}
          {notice.actions?.map((a) => (
            <button key={a.label} type="button" className={styles.quickPickBtn} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </p>
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
  initialModels,
  initialFuels,
  initialBodyStyles,
  initialTransmissions,
  initialSeats,
  initialColours,
  initialEngines,
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
  currentMinSaving,
  currentBelowCheapest,
  initialCars,
  initialCount,
  currentPage,
  totalPages,
  prevHref,
  nextHref,
  headlineKey,
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
  // Text typed into a chip box but not yet committed with Enter. Users type a
  // trim and hit Apply without pressing Enter (2026-08-04, "Shiro" bug) --
  // pending text must count as a term everywhere chips do.
  const [searchDraft, setSearchDraft] = useState("");
  const [versionDraft, setVersionDraft] = useState("");
  const withDraft = (chips: string[], draft: string) => {
    const t = draft.trim();
    if (!t || chips.some((c) => c.toLowerCase() === t.toLowerCase())) return chips;
    return [...chips, t];
  };
  const effSearchChips = withDraft(searchChips, searchDraft);
  // Live views use only ADDED feature chips: the Search features box coaches the buyer to a feature before it counts.
  const liveSearchChips = searchChips;
  // website review 3 Oct 2026 #36: Apply first adds any text still typed in Search features (ChipSearch addChip).
  const featureCommitRef = useRef<(() => Promise<string[] | null>) | null>(null);
  const effVersionChips = withDraft(versionChips, versionDraft);
  const [sort, setSort] = useState(currentSort);
  const [bestseller, setBestseller] = useState(currentBestseller);
  // Ladder rung chips + "cheaper than every Irish listing" (owner 2026-09-03).
  const [minSaving, setMinSaving] = useState(currentMinSaving);
  const [belowCheapest, setBelowCheapest] = useState(currentBelowCheapest);
  const [models, setModels] = useState<Option[]>(initialModels);
  // Dropdown counts were server-rendered once, so toggling Bestseller Series
  // left them showing whole-stock numbers ("hyundai (5,947)" when only 373
  // Hyundais carry a badge) -- owner report 2026-08-04. Since 2026-09-05
  // every dropdown refreshes against every other control (see the facet
  // effect below), so the server render and the client stay one system.
  const [makeOpts, setMakeOpts] = useState<Option[]>(initialMakes);
  const [fuelOpts, setFuelOpts] = useState<Option[]>(initialFuels);
  const [bodyOpts, setBodyOpts] = useState<Option[]>(initialBodyStyles);
  const [transOpts, setTransOpts] = useState<Option[]>(initialTransmissions);
  const [seatOpts, setSeatOpts] = useState<Option[]>(initialSeats);
  const [colourOpts, setColourOpts] = useState<Option[]>(initialColours);
  const [engineOpts, setEngineOpts] = useState<Option[]>(initialEngines);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [liveCars, setLiveCars] = useState<Car[]>(initialCars);
  const currentQsRef = useRef("");
  useEffect(() => {
    currentQsRef.current = currentQueryString();
  });
  const [liveCount, setLiveCount] = useState(initialCount ?? 0);
  // Only the newest live-count request may update the screen (owner saw 18K flip to 72K: a slow answer for a
  // half-typed word arrived after the real one). Older requests are aborted.
  const previewSeqRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Infinite scroll (AutoTrader-style, owner request 2026-07-31): more cars
  // append as the sentinel below the grid nears the viewport. The classic
  // ?page links stay in the server HTML for crawlers/no-JS, but hide once
  // scroll-loading has taken over.
  const [loadingMore, setLoadingMore] = useState(false);
  // 0-based last-loaded API page (URL pages are 1-based; the mount preview
  // normalises this to 0 the moment it replaces the list).
  const [loadedPage, setLoadedPage] = useState(Math.max(0, currentPage - 1));

  // Deep-scroll return: when a car tile is clicked, bank the loaded tiles,
  // pagination cursor and scroll position keyed to this exact query string;
  // when the same query mounts again (browser Back), put all three back.
  // Only the SSR batch survives Back otherwise, so the page renders short
  // and the browser's own scroll restoration has nothing to restore into.
  // The search this page was rendered with (its props), for the #15 check in the restore pass.
  const mountQsRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const KEY = "ucScrollReturn";
    mountQsRef.current = currentQueryString();

    function onClickCapture(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="/car/"]');
      if (!a) return;
      // Preview coherence: stamp the equivalent URL into this history entry
      // before leaving, so Back restores matching controls and SSR list.
      // website review 3 Oct 2026 #15: note when the address is re-stamped, and from which rendered search.
      let stamped: string | null = null;
      try {
        const qs = currentQsRef.current;
        if (qs !== window.location.search.replace(/^\?/, "")) {
          window.history.replaceState(window.history.state, "", qs ? `/used-cars?${qs}` : "/used-cars");
          stamped = qs;
        }
      } catch { /* ignore */ }
      try {
        sessionStorage.setItem(
          KEY,
          JSON.stringify({
            q: window.location.search,
            stamped,
            mountQs: mountQsRef.current,
            page: loadedPageRef.current,
            y: window.scrollY,
            t: Date.now(),
            clickedId: (a.getAttribute("href") || "").split("/car/")[1] || null,
            tileTop: a.getBoundingClientRect().top,
            cars: liveCarsRef.current,
          }),
        );
      } catch {
        // Quota exceeded on an extreme scroll: drop the tail — a partial
        // restore beats none.
        try {
          sessionStorage.setItem(
            KEY,
            JSON.stringify({
              q: window.location.search,
              stamped,
              mountQs: mountQsRef.current,
              page: loadedPageRef.current,
              y: window.scrollY,
              t: Date.now(),
              clickedId: (a.getAttribute("href") || "").split("/car/")[1] || null,
              tileTop: a.getBoundingClientRect().top,
              cars: liveCarsRef.current.slice(0, 200),
            }),
          );
        } catch {
          /* give up quietly */
        }
      }
    }

    // Restore pass (runs once on mount).
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        sessionStorage.removeItem(KEY);
        const saved = JSON.parse(raw);
        const fresh = Date.now() - (saved?.t ?? 0) < 30 * 60 * 1000;
        // website review 3 Oct 2026 #15: a tile click stamps live (not applied) filters into the address with
        // replaceState, but the router keeps the page it rendered for the OLD address in that history entry, so Back
        // put the saved BMW tiles under "All Makes" and the whole-stock count. When this is that old render, load the
        // address itself once; the saved tiles and scroll position wait in sessionStorage and restore on that load.
        if (
          fresh && saved.q === window.location.search && !saved.reloaded &&
          typeof saved.stamped === "string" && typeof saved.mountQs === "string" &&
          saved.stamped !== saved.mountQs && mountQsRef.current === saved.mountQs
        ) {
          sessionStorage.setItem(KEY, JSON.stringify({ ...saved, reloaded: true }));
          document.documentElement.classList.add("uc-veil");
          window.location.replace(window.location.href);
          return;
        }
        if (fresh && saved.q === window.location.search && Array.isArray(saved.cars) && saved.cars.length > 0) {
          if ("scrollRestoration" in history) history.scrollRestoration = "manual";
          pendingScrollRef.current = saved.y || 0;
          pendingCarRef.current = typeof saved.clickedId === "string" ? saved.clickedId : null;
          pendingTopRef.current = typeof saved.tileTop === "number" ? saved.tileTop : null;
          restoredRef.current = true; // live-preview effect must not clobber this
          savedLenRef.current = saved.cars.length;
          busyRef.current = true; // hold the auto-loader until we've landed
          // Veil the grid while we land (the page's inline script already
          // veiled it pre-paint on document loads; this covers client-side
          // Back, where no fresh parse happens).
          document.documentElement.classList.add("uc-veil");
          window.setTimeout(() => {
            document.documentElement.classList.remove("uc-veil");
            busyRef.current = false;
          }, 800); // failsafe: the veil never outlives this
          setLiveCars(saved.cars);
          if (typeof saved.page === "number") setLoadedPage(saved.page);
        }
      }
    } catch {
      /* corrupt state: start at the top like before */
    }

    // No restore engaged (fresh visit, different query, nothing saved): the
    // inline script may still have veiled the grid — lift it immediately.
    if (pendingScrollRef.current === null) {
      document.documentElement.classList.remove("uc-veil");
    }

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const endRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);
  const loadMoreRef = useRef<() => void>(() => {});

  // Live mirrors for the click-capture listener above (registered once).
  const liveCarsRef = useRef<Car[]>(initialCars);
  // Mirrors loadedPage (0-based). The initial value here is dead: the
  // assignment further down runs in the render body on every render,
  // including the first, so it is overwritten before the layout effect
  // registers the click handler that reads it. Kept consistent anyway --
  // a 1-based initialiser next to a 0-based ref reads like an off-by-one
  // and has already cost one investigation.
  const loadedPageRef = useRef(Math.max(0, currentPage - 1));

  // Deep-scroll restore lands before paint: once the restored tiles have
  // committed (length reaches what was saved), jump in the same frame.
  const pendingScrollRef = useRef<number | null>(null);
  const pendingCarRef = useRef<string | null>(null);
  const pendingTopRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  // False until the live-preview effect has run once. The mount run must
  // honour ?page=N; every later run is an in-place filter change, which
  // always restarts at the first page.
  const previewRanRef = useRef(false);
  const savedLenRef = useRef(0);
  useLayoutEffect(() => {
    if (pendingScrollRef.current === null || liveCars.length < savedLenRef.current) return;
    const y = pendingScrollRef.current;
    const id = pendingCarRef.current;
    pendingScrollRef.current = null;
    pendingCarRef.current = null;
    const top = pendingTopRef.current;
    pendingTopRef.current = null;
    const land = () => {
      const tile = id ? document.querySelector(`a[href="/car/${id}"]`) : null;
      if (tile) {
        tile.scrollIntoView({ block: "center" });
        if (top !== null) {
          // Put the tile back at the exact height it sat when clicked.
          const r = tile.getBoundingClientRect();
          window.scrollBy(0, r.top - top);
        }
      } else {
        window.scrollTo(0, y);
      }
    };
    land();
    // Re-assert after the router's own scroll restore has had its turn,
    // then lift the veil: one clean appearance, already in position.
    requestAnimationFrame(() => {
      land();
      window.setTimeout(() => {
        land();
        document.documentElement.classList.remove("uc-veil");
        busyRef.current = false; // release the auto-loader now we've landed
      }, 120);
    });
  }, [liveCars]);

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
    minSaving !== currentMinSaving ||
    belowCheapest !== currentBelowCheapest ||
    effSearchChips.join(" ") !== currentSearchChips.join(" ") ||
    effVersionChips.join(" ") !== currentVersionChips.join(" ");

  // CONNECTED FILTERS (owner, 2026-09-05: "if I filter down to 7 cars and
  // there are no red cars left then red should not be a choice"). Every
  // dropdown -- make, model, body, fuel, gearbox, seats, colour, engine --
  // re-describes the cars matching all the OTHER controls, on the same
  // debounce as the live preview. Each facet omits its own key (lib/facets)
  // or it would collapse to the one value already picked. The server render
  // already did this for the URL state, so the mount pass is skipped, and a
  // stale response can never overwrite a newer one (sequence check).
  const facetsRanRef = useRef(false);
  const facetSeqRef = useRef(0);
  useEffect(() => {
    if (!facetsRanRef.current) {
      facetsRanRef.current = true;
      return;
    }
    const seq = ++facetSeqRef.current;
    const timer = setTimeout(async () => {
      const full: Record<string, unknown> = {
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
        minPrice: minPrice || PUBLIC_FLOOR_EUR,
        maxPrice,
        minMileage,
        maxMileage,
        search: liveSearchChips.join(" "),
        searchChips: liveSearchChips,
        version: effVersionChips.join(" "),
        versionChips: effVersionChips,
        bestsellerSeries: bestseller,
        minSaving,
        belowCheapest,
        dropfilter: sort === "drop_big" ? "1" : "",
        // website review 3 Oct 2026 #13: the saving sort lists badge cars only, so the counts must too ("abarth (126)"
        // opened 0 cars).
        savingfilter: savingFilterFor(sort, bestseller, minSaving, belowCheapest),
      };
      if (make) setModelsLoading(true);
      const results = await Promise.all(
        FACET_NAMES.map(async (name: FacetName): Promise<Option[] | null> => {
          if (name === "models" && !make) return [];
          try {
            const res = await fetch(`/api/facets/${name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(facetBody(full, name)),
            });
            if (!res.ok) return null;
            return parseFacet(name, await res.json());
          } catch {
            // Leave the last known list showing rather than blank a dropdown.
            return null;
          }
        }),
      );
      if (seq !== facetSeqRef.current) return;
      const [mk, md, fu, bo, tr, se, co, en] = results;
      if (mk) setMakeOpts(keepSelected(mk, make));
      if (md) setModels(keepSelected(md, model));
      if (fu) setFuelOpts(keepSelected(fu, fuel));
      if (bo) setBodyOpts(keepSelected(bo, bodyStyle));
      if (tr) setTransOpts(keepSelected(tr, transmission));
      if (se) setSeatOpts(keepSelected(se, seats));
      if (co) setColourOpts(keepSelected(co, color));
      if (en) setEngineOpts(keepSelected(keepSelected(en, minEnginesize), maxEnginesize));
      setModelsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, model, fuel, bodyStyle, transmission, seats, color, minEnginesize, maxEnginesize, minYear, maxYear, minPrice, maxPrice, minMileage, maxMileage, searchChips, versionChips, versionDraft, sort, bestseller, minSaving, belowCheapest]);

  // website review 3 Oct 2026 #11: ONE request body for the first page and every scroll batch. The batch request was a
  // hand-copied subset that left out the euro-saving rung, "cheaper than every Irish listing" and the saving order,
  // so from car 26 on the list showed other cars and the count jumped (4,025 to 18,196).
  function listingBody(pagenum: number) {
    const { price_sort, mileage_sort, drop_sort } = sortToParams(sort);
    return {
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
      minPrice: minPrice || "1",
      maxPrice,
      minMileage,
      maxMileage,
      search: liveSearchChips.join(" "),
      searchChips: liveSearchChips,
      version: effVersionChips.join(" "),
      versionChips: effVersionChips,
      price_sort,
      mileage_sort,
      pricefilter: price_sort,
      mileagefilter: mileage_sort,
      dropfilter: drop_sort,
      bestsellerSeries: bestseller,
      minSaving,
      belowCheapest,
      savingfilter: savingFilterFor(sort, bestseller, minSaving, belowCheapest),
      pagenum,
      limit: 25,
    };
  }
  const listingSigRef = useRef("");
  listingSigRef.current = JSON.stringify(listingBody(0));
  // The search the tiles on screen belong to: the server render's, then whichever preview last landed.
  const shownSigRef = useRef(listingSigRef.current);

  useEffect(() => {
    // A restore just rebuilt the full scrolled list; this effect's mount run
    // would replace it with page 1 and dump the visitor somewhere else --
    // the exact "come back in a different place" bug. Skip one run.
    if (restoredRef.current) {
      restoredRef.current = false;
      // the restored list stands in for the mount run; the next run is a real change (#71 below)
      previewRanRef.current = true;
      return;
    }
    const isFirstRun = !previewRanRef.current;
    previewRanRef.current = true;
    // Deep link (?page=3) must survive the preview; a filter change must not.
    const targetPage = isFirstRun ? Math.max(0, currentPage - 1) : 0;
    if (!isFirstRun) {
      // website review 3 Oct 2026 #71: the previous search's figure stayed up through the 0.4 s wait (Toyota's 7,885
      // under Kia + Electric), and an older answer could still land in that gap. Retire it and say so at once.
      previewSeqRef.current++;
      previewAbortRef.current?.abort();
      setCountLoading(true);
    }
    const body = listingBody(targetPage);
    const sig = JSON.stringify(listingBody(0));
    const timer = setTimeout(async () => {
      const seq = ++previewSeqRef.current;
      previewAbortRef.current?.abort();
      const ctrl = new AbortController();
      previewAbortRef.current = ctrl;
      setCountLoading(true);
      try {
        const res = await fetch("/api/car-count", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (seq !== previewSeqRef.current) return; // a newer search has started: this answer is stale
        if (typeof data?.data?.count === "number") setLiveCount(data.data.count);
        if (Array.isArray(data?.data?.cars)) {
          shownSigRef.current = sig;
          setLiveCars(data.data.cars);
          // pagenum is 0-based and loadMore fetches loadedPage + 1, so record
          // the page we actually just loaded. Recording 1 here once made the
          // first load-more jump to page 2 -- cars 26-50 silently skipped on
          // EVERY browse, and short lists (<=50) hit an empty page and spun
          // forever. Recording 0 unconditionally then broke ?page=N deep
          // links, which were replaced by the first page 400ms after load.
          setLoadedPage(targetPage);
        }
      } catch {
        // Leave the last known results showing rather than a jarring reset (an aborted older request lands here too).
      } finally {
        if (seq === previewSeqRef.current) setCountLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, model, fuel, bodyStyle, transmission, seats, color, minEnginesize, maxEnginesize, minYear, maxYear, minPrice, maxPrice, minMileage, maxMileage, searchChips, versionChips, versionDraft, sort, bestseller, minSaving, belowCheapest]);

  // Reassigned every render so the IntersectionObserver callback always sees
  // the current filter state without re-registering the observer.
  liveCarsRef.current = liveCars;
  loadedPageRef.current = loadedPage;

  loadMoreRef.current = async () => {
    if (busyRef.current || loadingMore) return;
    // website review 3 Oct 2026 #11: a batch only ever extends the search whose tiles are on screen, with that
    // search's own body (listingBody). While a change waits for its first page nothing is appended, and an answer
    // that arrives after the search changed is dropped, count included.
    const sig = listingSigRef.current;
    if (shownSigRef.current !== sig) return;
    // liveCount 0 with cars on screen = the SSR count query failed; treat as
    // unknown and keep loading -- the batch response carries the real count.
    if (liveCount > 0 && liveCars.length >= liveCount) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch("/api/car-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listingBody(loadedPage + 1)),
      });
      const data = await res.json();
      if (shownSigRef.current !== sig || listingSigRef.current !== sig) return;
      const batch: Car[] = Array.isArray(data?.data?.cars) ? data.data.cars : [];
      if (batch.length) {
        setLiveCars((prev) => {
          const seen = new Set(prev.map((c) => c.car_id));
          return [...prev, ...batch.filter((c) => !seen.has(c.car_id))];
        });
        setLoadedPage((p) => p + 1);
        if (typeof data?.data?.count === "number") setLiveCount(data.data.count);
      } else {
        // An empty page IS the end of stock, whatever the count claimed --
        // counts can legitimately exceed listable tiles, and before this
        // guard the loop chained "Loading more cars" forever at the bottom
        // of a filtered list (owner repro: ?Make=toyota&bestseller=1).
        setLiveCount(liveCarsRef.current.length);
      }
    } catch {
      // Quiet failure: the sentinel will simply retry on the next intersect.
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
      // Chain straight into the next batch if the sentinel is still inside
      // the prefetch margin: IntersectionObserver only fires on boundary
      // crossings, so a fast flick past the sentinel would otherwise stall
      // until the user scrolls again. The has-more/busy guards at the top
      // of this function stop the chain at the end of the stock.
      setTimeout(() => {
        const el = endRef.current;
        if (el && el.getBoundingClientRect().top < window.innerHeight + 2000) {
          loadMoreRef.current();
        }
      }, 100);
    }
  };

  useEffect(() => {
    const el = endRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "2000px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function handleMakeChange(newMake: string) {
    setMake(newMake);
    setModel("");
    // The model list refreshes with every other dropdown in the facet effect. Until it does, offer nothing rather
    // than the previous make's models (website review 3 Oct 2026 #69: "118i" picked under Volvo gave 0 cars).
    setModels([]);
    setModelsLoading(!!newMake);
  }

  // Single source of truth for "the URL this filter state means" — used by
  // Apply, and by the tile-click history stamp so Back always lands on an
  // address matching what is on screen.
  function currentQueryString(featureChips: string[] = liveSearchChips): string {
    const { price_sort, mileage_sort, drop_sort, saving_sort } = sortToParams(sort);
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
    featureChips.forEach((c) => params.append("searchChips", c));
    effVersionChips.forEach((c) => params.append("versionChips", c));
    if (price_sort) params.set("price_sort", price_sort);
    if (mileage_sort) params.set("mileage_sort", mileage_sort);
    if (drop_sort) params.set("drop_sort", drop_sort);
    if (bestseller) params.set("bestseller", bestseller);
    if (saving_sort) params.set("saving_sort", saving_sort);
    if (minSaving) params.set("min_saving", minSaving);
    if (belowCheapest) params.set("below_cheapest", belowCheapest);
    return params.toString();
  }

  async function applyFilters() {
    // website review 3 Oct 2026 #36: the live count uses only ADDED feature chips, but Apply also searched the text
    // still typed in the box ("lumbar": 130,762 shown, 44,120 returned). Add that text first, exactly as Enter would
    // (a known feature, a "which did you mean?" question, or an advert-wording word), then apply those chips.
    let featureChips = liveSearchChips;
    if (searchDraft.trim() && featureCommitRef.current) {
      const committed = await featureCommitRef.current();
      if (committed === null) return; // the box is asking which feature was meant
      featureChips = committed;
    }
    const qs = currentQueryString(featureChips);
    const bits = [
      make && (model ? `${make} ${model}` : make),
      minPrice || maxPrice ? `€${minPrice || "0"}–${maxPrice || "any"}` : "",
      fuel,
      maxMileage ? `≤${maxMileage} km` : "",
      bestseller ? "Bestsellers" : "",
      minSaving ? `€${Number(minSaving).toLocaleString("en-IE")}+ under Ireland` : "",
      belowCheapest ? "cheaper than every Irish listing" : "",
    ].filter(Boolean);
    rememberSearch(bits.join(" · "), qs);
    router.push(qs ? `/used-cars?${qs}` : "/used-cars");
  }

  function clearAll() {
    // Reset the controls themselves: several filters (the Bestseller toggle,
    // anything picked via live preview) exist only in component state, so
    // navigating to the plain URL alone is a no-op when we're already on it.
    setMake("");
    setModel("");
    setFuel("");
    setBodyStyle("");
    setTransmission("");
    setSeats("");
    setColor("");
    setMinEnginesize("");
    setMaxEnginesize("");
    setMinYear("");
    setMaxYear("");
    setMinPrice("");
    setMaxPrice("");
    setMinMileage("");
    setMaxMileage("");
    setSearchChips([]);
    setVersionChips([]);
    setSearchDraft("");
    setVersionDraft("");
    setSort("");
    setBestseller("");
    setMinSaving("");
    setBelowCheapest("");
    if (window.location.search) {
      router.push("/used-cars");
    }
  }

  const hasAnyFilter = !!(
    make || model || fuel || bodyStyle || transmission || seats || color ||
    minEnginesize || maxEnginesize || minYear || maxYear || minPrice || maxPrice ||
    minMileage || maxMileage || searchChips.length || versionChips.length || sort || bestseller || minSaving || belowCheapest
  );

  // website review 3 Oct 2026 #73: name every filter that narrows the list, including the two that hide cars
  // without saying so elsewhere -- Price Drops, and the saving sort (Bestseller cars only).
  const span = (lo: string, hi: string, fmt: (v: string) => string) =>
    lo && hi ? (lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`) : lo ? `from ${fmt(lo)}` : hi ? `up to ${fmt(hi)}` : "";
  const activeFilters = [
    bestseller ? "Bestseller Series" : sort === "saving_big" ? "Bestseller cars only (saving sort)" : "",
    minSaving ? `€${Number(minSaving).toLocaleString("en-IE")}+ under Ireland` : "",
    belowCheapest ? "Cheaper than every Irish listing" : "",
    sort === "drop_big" ? "Price drops only" : "",
    make, model, fuel, bodyStyle, transmission, seats ? `${seats} seats` : "", color,
    minYear || maxYear ? `Year ${span(minYear, maxYear, (v) => v)}` : "",
    minPrice || maxPrice ? `Price ${span(minPrice, maxPrice, (v) => `€${Number(v).toLocaleString("en-IE")}`)}` : "",
    minMileage || maxMileage ? `Mileage ${span(minMileage, maxMileage, (v) => `${Number(v).toLocaleString("en-IE")} km`)}` : "",
    minEnginesize || maxEnginesize ? `Engine ${span(minEnginesize, maxEnginesize, (v) => `${v} L`)}` : "",
    ...liveSearchChips.map((c) => (c.startsWith("-") ? `not ${c.slice(1)}` : c)),
    ...effVersionChips.map((c) => (c.startsWith("-") ? `version not ${c.slice(1)}` : `version ${c}`)),
  ].filter(Boolean);

  // website review 3 Oct 2026 #33: the page headline follows this live count, so the page shows one number.
  const headlineFiltered = activeFilters.length > 0;
  useEffect(() => {
    if (countLoading) return;
    publishHeadlineCount({ key: headlineKey ?? "", count: liveCount ?? 0, filtered: headlineFiltered });
  }, [liveCount, countLoading, headlineFiltered, headlineKey]);

  return (
    <>
      <div className={styles.wrapper}>
        <button
          type="button"
          className={`${styles.bestsellerToggle} ${bestseller ? styles.bestsellerToggleOn : ""}`}
          onClick={() => {
            if (bestseller) {
              setBestseller("");
              setMinSaving("");
              setBelowCheapest("");
              // website review 3 Oct 2026 #12: the saving sort lists badge cars only, so leaving it on kept ~18,200
              // Bestsellers on screen after the toggle went off. Off means the whole stock again.
              if (sort === "saving_big") setSort("");
            } else {
              setBestseller("1");
            }
          }}
          aria-pressed={!!bestseller}
        >
          <span className={styles.bestsellerFlash} aria-hidden="true">&#9889;</span>
          Bestseller Series
          <span className={styles.bestsellerToggleHint}>
            {bestseller ? "Showing cars priced €750+ under the Irish market" : "Cars priced €750+ under the Irish market"}
          </span>
        </button>
        {/* Ladder rung chips (owner 2026-09-03): the buyer sets their own bar.
            Cumulative — €1,500+ includes everything above it. Picking a chip
            switches the Bestseller Series on; the toggle clears them. */}
        <div className={styles.rungChips} role="group" aria-label="Minimum saving vs the Irish market">
          {RUNG_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`${styles.rungChip} ${minSaving === c.value ? styles.rungChipOn : ""}`}
              aria-pressed={minSaving === c.value}
              onClick={() => {
                if (minSaving === c.value) {
                  setMinSaving("");
                } else {
                  setMinSaving(c.value);
                  setBestseller("1");
                }
              }}
            >
              <span className={`${styles.rungSwatch} ${styles[c.cls]}`} aria-hidden="true" />
              {c.label}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.rungChip} ${styles.rungChipBlack} ${belowCheapest ? styles.rungChipOn : ""}`}
            aria-pressed={!!belowCheapest}
            onClick={() => {
              if (belowCheapest) {
                setBelowCheapest("");
              } else {
                setBelowCheapest("1");
                setBestseller("1");
              }
            }}
          >
            Cheaper than every Irish listing
          </button>
        </div>
        <button
          type="button"
          className={`${styles.dropToggle} ${sort === "drop_big" ? styles.dropToggleOn : ""}`}
          onClick={() => setSort(sort === "drop_big" ? "" : "drop_big")}
          aria-pressed={sort === "drop_big"}
        >
          <span aria-hidden="true">&#8595;</span> Price Drops
          <span className={styles.dropToggleHint}>
            {sort === "drop_big" ? "Biggest dealer price cuts first" : "Cars the UK dealer just cut"}
          </span>
        </button>

        <ChipSearch
          label="Version / trim"
          placeholder="e.g. Inscription"
          chips={versionChips}
          onChipsChange={setVersionChips}
          onDraftChange={setVersionDraft}
          trimCheck
          onFeature={FEATURE_SEARCH_ENABLED ? (f) => setSearchChips((cs) => (cs.some((c) => c.toLowerCase() === f.toLowerCase()) ? cs : [...cs, f])) : undefined}
        />
        {/* Feature search sits below Version / trim (owner, 3 Oct 2026). FEATURE_SEARCH_ENABLED hides it again. */}
        {FEATURE_SEARCH_ENABLED && (
          <ChipSearch
            label="Search features"
            placeholder="e.g. leather seats, Apple CarPlay"
            chips={searchChips}
            onChipsChange={setSearchChips}
            quickPicks={QUICK_PICKS}
            onDraftChange={setSearchDraft}
            commitRef={featureCommitRef}
            coach
            onTrim={(t) => setVersionChips((cs) => (cs.some((c) => c.toLowerCase() === t.toLowerCase()) ? cs : [...cs, t]))}
            note={"Garages do not always describe every feature accurately or in full. Please contact the garage yourself to confirm any specific detail."}
          />
        )}

        <div className={styles.bar}>
          <select className={styles.select} value={make} onChange={(e) => handleMakeChange(e.target.value)} aria-label="Make">
            <option value="">All Makes</option>
            {makeOpts.map((m) => (
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
            {bodyOpts.map((b) => (
              <option key={b.label} value={b.label}>{b.label} ({b.total})</option>
            ))}
          </select>

          <select className={styles.select} value={fuel} onChange={(e) => setFuel(e.target.value)} aria-label="Fuel Type">
            <option value="">All Fuel Types</option>
            {fuelOpts.map((f) => (
              <option key={f.label} value={f.label}>{f.label} ({f.total})</option>
            ))}
          </select>

          <select className={styles.select} value={transmission} onChange={(e) => setTransmission(e.target.value)} aria-label="Gearbox">
            <option value="">All Gearboxes</option>
            {transOpts.map((t) => (
              <option key={t.label} value={t.label}>{t.label} ({t.total})</option>
            ))}
          </select>

          <select className={styles.select} value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="No of Seats">
            <option value="">Any Seats</option>
            {seatOpts.map((s) => (
              <option key={s.label} value={s.label}>{s.label} seats ({s.total})</option>
            ))}
          </select>

          {/* Colour is a live facet (2026-09-05): only the colours the
              current cars come in, with counts, like every other dropdown. */}
          <select className={styles.select} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour">
            <option value="">Any Colour</option>
            {colourOpts.map((c) => (
              <option key={c.label} value={c.label}>{c.label} ({c.total})</option>
            ))}
          </select>

          {/* Engine size as two selects, not free-typed numbers: a phone
              keyboard has no stepper (owner, 2026-09-05), and the list only
              offers sizes the current cars actually have. Min and max may be
              equal to isolate one size. */}
          <select className={styles.select} value={minEnginesize} onChange={(e) => setMinEnginesize(e.target.value)} aria-label="Min Engine Size">
            <option value="">Min Engine (L)</option>
            {engineOpts.filter((o) => !maxEnginesize || Number(o.label) <= Number(maxEnginesize)).map((o) => (
              <option key={o.label} value={o.label}>{o.label} L</option>
            ))}
          </select>
          <select className={styles.select} value={maxEnginesize} onChange={(e) => setMaxEnginesize(e.target.value)} aria-label="Max Engine Size">
            <option value="">Max Engine (L)</option>
            {engineOpts.filter((o) => !minEnginesize || Number(o.label) >= Number(minEnginesize)).map((o) => (
              <option key={o.label} value={o.label}>{o.label} L</option>
            ))}
          </select>

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

        <RecentSearches />

        <div className={styles.actionsRow}>
          <button type="button" className={styles.applyButton} onClick={applyFilters}>Apply Filters</button>

          {hasAnyFilter && (
            <button type="button" className={styles.clearButton} onClick={clearAll}>Clear all</button>
          )}
        </div>

        <div className={styles.liveCount} aria-live="polite">
          {countLoading ? "Updating…" : `${(liveCount ?? 0).toLocaleString("en-IE")} vehicles match`}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className={pageStyles.activeFilters}>
          <span>Filtered by: {activeFilters.join(", ")}</span>
        </div>
      )}

      <div className="js-cars-area">
        {/* Website review 3 Oct 2026 #26: a car saved from filtered results keeps the version and feature chips. */}
        <CardsGrid cars={liveCars} saveVersion={effVersionChips.join(" ")} saveChips={liveSearchChips} />
      </div>

      {/* An email alert is worth more than a follow, so the follow strip only
          appears when no filters are set and SaveSearchPrompt is silent. */}
      <FollowStrip suppressed={[make, model, fuel, bodyStyle, transmission, seats, color, minYear, maxYear, minPrice].some(Boolean)} />
      <SaveSearchPrompt
        filters={{
          Make: make,
          // Ladder (2026-09-03): the alert keeps the rung the buyer chose
          // (bestsellerSeries was already sent below).
          minSaving,
          belowCheapest,
          Model: model,
          Fuel: fuel,
          body_style: bodyStyle,
          transmission_type: transmission,
          seats,
          color,
          minYear,
          maxYear,
          minPrice,
          maxPrice,
          minMileage,
          maxMileage,
          bestsellerSeries: bestseller,
          // Website review 3 Oct 2026 #26: engine size, version and feature chips
          // narrow the cars on screen, so the alert keeps them (same values the
          // live grid fetch sends).
          minEnginesize,
          maxEnginesize,
          versionChips: effVersionChips,
          searchChips: liveSearchChips,
        }}
        matchCount={liveCount ?? 0}
      />

      {liveCars.length === 0 && (
        <p className={pageStyles.noResults}>No cars match these filters.</p>
      )}

      <div ref={endRef} aria-hidden="true" />
      {liveCars.length > 0 && liveCars.length < liveCount && (
        <p className={pageStyles.keepScrolling}>
          {loadingMore
            ? "Loading more cars\u2026"
            : `\u2193 Keep scrolling \u2014 ${(liveCount - liveCars.length).toLocaleString("en-IE")} more cars load automatically`}
        </p>
      )}
      {liveCount > 0 && liveCars.length > 0 && liveCars.length >= liveCount && (
        <p className={pageStyles.loadingMore}>
          That&rsquo;s all {liveCount.toLocaleString("en-IE")} — every matching car is above.
        </p>
      )}

      {/* website review 3 Oct 2026 #70: loadedPage is 0-based and currentPage 1-based, so this never showed. */}
      {!dirty && loadedPage === currentPage - 1 && liveCars.length > 0 && totalPages > 1 && (
        <noscript>
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
        </noscript>
      )}
    </>
  );
}
