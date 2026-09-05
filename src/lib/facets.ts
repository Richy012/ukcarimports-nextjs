// Connected filter dropdowns (owner, 2026-09-05: "if I filter down to 7 cars
// and there are no red cars left then red should not be a choice"). Every
// dropdown's options and counts describe the cars matching all the OTHER
// controls, so the list shrinks as the visitor narrows. One place for the
// endpoint names, the response shapes and the label clean-up, shared by the
// server render and the client refresh so the two can never disagree.

export type FacetName =
  | "makes"
  | "models"
  | "fuel-types"
  | "body-styles"
  | "transmission-types"
  | "seats"
  | "colors"
  | "engine-types";

export interface FacetOption {
  label: string;
  total: number;
}

export const FACET_NAMES: FacetName[] = [
  "makes",
  "models",
  "fuel-types",
  "body-styles",
  "transmission-types",
  "seats",
  "colors",
  "engine-types",
];

// endpoint -> [response array key, row label key]. transmission-types
// answers under "transmission"/"car_transmission", not "transmission_type"
// -- the old client refresh read the wrong key and silently kept stale
// gearbox counts.
const SHAPE: Record<FacetName, [string, string]> = {
  makes: ["make", "make"],
  models: ["model", "car_model"],
  "fuel-types": ["fuel_type", "fuel_type"],
  "body-styles": ["body_style", "body_style"],
  "transmission-types": ["transmission", "car_transmission"],
  seats: ["seats", "seats"],
  colors: ["exterior_color", "color"],
  "engine-types": ["engine", "car_engine"],
};

// A facet must not send its OWN value, or the dropdown collapses to the one
// entry already picked and the visitor can never switch (fuel-types with
// Fuel=Diesel answers "Diesel" alone -- measured). Model depends on Make, so
// the make list also ignores the chosen model.
export function facetBody(full: Record<string, unknown>, name: FacetName): Record<string, unknown> {
  const body: Record<string, unknown> = { ...full };
  switch (name) {
    case "makes":
      body.Make = "";
      body.Model = "";
      break;
    case "models":
      body.Model = "";
      break;
    case "fuel-types":
      body.Fuel = "";
      break;
    case "body-styles":
      body.body_style = "";
      break;
    case "transmission-types":
      body.transmission_type = "";
      break;
    case "seats":
      body.seats = "";
      break;
    case "colors":
      body.color = "";
      break;
    case "engine-types":
      body.minEnginesize = "";
      body.maxEnginesize = "";
      break;
  }
  return body;
}

export function parseFacet(name: FacetName, data: unknown): FacetOption[] {
  const [arrKey, labelKey] = SHAPE[name];
  const rows = (data as Record<string, unknown> | null)?.[arrKey];
  if (!Array.isArray(rows)) return [];
  const out: FacetOption[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const raw = String(row[labelKey] ?? "").trim();
    if (!raw) continue;
    let label = raw;
    if (name === "colors") {
      // color_name is free text off the advert: "BLUE", "Blue" and "blue"
      // are one colour (the listing filter matches case-insensitively --
      // measured, 2,484 BMWs whichever way it is spelt) and a few rows
      // carry junk like "38,769 miles".
      if (/\d/.test(raw)) continue;
      label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    if (name === "engine-types") {
      // "1.5L" -> "1.5": the range filter compares the number.
      label = raw.replace(/l$/i, "");
      if (!/^\d+(\.\d+)?$/.test(label)) continue;
    }
    const total = Number(row.total ?? 0);
    const hit = out.find((o) => o.label === label);
    if (hit) hit.total += total;
    else out.push({ label, total });
  }
  if (name === "engine-types") out.sort((a, b) => Number(a.label) - Number(b.label));
  return out.filter((o) => o.total > 0);
}

// The value already picked must stay listed even when the other filters
// leave it with no cars, or the select goes blank and the visitor cannot
// see what to clear.
export function keepSelected(opts: FacetOption[], selected: string): FacetOption[] {
  if (!selected) return opts;
  if (opts.some((o) => o.label.toLowerCase() === selected.toLowerCase())) return opts;
  return [...opts, { label: selected, total: 0 }];
}
