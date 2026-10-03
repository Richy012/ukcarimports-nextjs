// A saved search as it is stored, and the /used-cars address it stands for
// (website review 3 Oct 2026 #6 and #26).
//
// query_params is the same body the listing itself sends the API (FilterBar's
// live fetch, used-cars/page.tsx getCars), so alerts:saved-searches, which
// replays it through buildCarsQueryFromParams(), matches the cars the buyer saw.

export type SearchValue = string | string[];

// The listing page reads three of the API's parameter names under other names.
const URL_KEYS: Record<string, string> = {
  bestsellerSeries: "bestseller",
  minSaving: "min_saving",
  belowCheapest: "below_cheapest",
};

/** Blanks dropped; the API's flattened "search" / "version" copies of the chip lists added, as the listing sends them. */
export function savedSearchParams(filters: Record<string, SearchValue>): Record<string, SearchValue> {
  const out: Record<string, SearchValue> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) {
      const list = v.map((s) => s.trim()).filter(Boolean);
      if (list.length) out[k] = list;
    } else if (v) {
      out[k] = v;
    }
  }
  // saveSearch() counts "version" (not versionChips) as a real filter.
  if (Array.isArray(out.searchChips)) out.search = out.searchChips.join(" ");
  if (Array.isArray(out.versionChips)) out.version = out.versionChips.join(" ");
  return out;
}

/**
 * The /used-cars query string for stored query_params. A list is written as
 * repeated keys (searchChips=a&searchChips=b), which is how the listing reads
 * it; JSON text arrived as one odd chip.
 */
export function usedCarsQuery(params: Record<string, unknown>): string {
  const p: Record<string, unknown> = { ...params };
  // "search" / "version" are flattened copies the listing ignores; a search
  // that holds only those is split into chips the way the API splits them.
  for (const [flat, list] of [["search", "searchChips"], ["version", "versionChips"]] as const) {
    if (flat in p && !Array.isArray(p[flat])) {
      const words = String(p[flat] ?? "").trim();
      const hasList = Array.isArray(p[list]) && (p[list] as unknown[]).length > 0;
      if (!hasList && words) p[list] = words.split(/\s+/);
      delete p[flat];
    }
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    for (const one of Array.isArray(v) ? v : [v]) {
      if (one === null || one === undefined || typeof one === "object") continue;
      const s = String(one);
      if (s.trim() === "") continue;
      qs.append(URL_KEYS[k] ?? k, s);
    }
  }
  return qs.toString();
}
