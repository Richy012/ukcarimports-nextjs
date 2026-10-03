/**
 * Fold the names the national vehicle file returns into the names the Irish
 * price index uses. Owner, 22 Sep 2026: five of the weekend's valuation
 * requests came back "not enough Irish evidence" for cars we hold dozens of
 * ads for — the lookup said "BMW 520", "BMW 330", "MERCEDES BENZ S350",
 * "C SERIES"; the index says "5 series", "3 series", "s class", "c class".
 *
 * Measured on every real lookup since launch (50 distinct make|model pairs):
 * 12 missed, all of them this shape. Nothing here invents a match — a name
 * that does not fold stays as typed and fails as before.
 */

const MAKE_ALIAS: Record<string, string> = {
  "mercedes benz": "mercedes-benz",
  "mercedes": "mercedes-benz",
  "mercedes-benz": "mercedes-benz",
  "vw": "volkswagen",
  "landrover": "land rover",
  "land-rover": "land rover",
  "range rover": "land rover",
  "alfa": "alfa romeo",
  "ds": "ds automobiles",
  "citroën": "citroen",
  "škoda": "skoda",
  "opel": "vauxhall",
};

export function normaliseMake(make: string): string {
  const m = (make || "").trim().toLowerCase().replace(/\s+/g, " ");
  return MAKE_ALIAS[m] ?? m;
}

/** "520", "520d", "523", "530e", "M550d" -> "5 series"; "330", "330e" -> "3 series" … */
function bmwFamily(md: string): string {
  const m = md.match(/^(?:m)?([1-8])[0-9]{2}\s*[a-z]*$/); // 118d, 320d, 520, 530e, m550d
  if (m) return `${m[1]} series`;
  if (/^[1-8]\s*series$/.test(md)) return md.replace(/\s+/, " ");
  if (/^[1-8]$/.test(md)) return `${md} series`;
  return md;
}

/** "S350", "C SERIES", "C-CLASS", "E220 D", "E 220 CDI", "GLC 220", "A180" -> "s class", "c class", … */
function mercedesFamily(md: string): string {
  const m = md.match(/^(gla|glb|glc|gle|gls|cla|cls|eqa|eqb|eqc|eqe|eqs|amg|cle|[abcegsvx])(?:[\s-]*(?:class|series|klasse))?(?:[\s-]*\d.*)?$/);
  if (!m) return md;
  const head = m[1];
  if (["eqa", "eqb", "eqc", "eqe", "eqs", "cle", "glb"].includes(head)) return head;
  return `${head} class`;
}

function audiFamily(md: string): string {
  const m = md.match(/^(a[1-8]|q[2-8]|tt|s[3-8]|rs[3-7])(?:\s|$)/); // "a4 avant" -> a4, "q5 sportback" -> q5
  return m ? m[1] : md;
}

function lexusFamily(md: string): string {
  const m = md.match(/^(ct|es|is|nx|rx|ux|lbx|rz)\s*(\d{3})\s*(h\+?|e)?$/); // "nx300h" -> "nx 300 h"
  if (!m) return md;
  return [m[1], m[2], m[3]].filter(Boolean).join(" ");
}

export function normaliseModel(make: string, model: string): string {
  const mk = normaliseMake(make);
  let md = (model || "").trim().toLowerCase().replace(/\s+/g, " ");
  // 30 Sep 2026: the national vehicle file appends a powertrain descriptor to
  // some models ("MONDEO HEV", "... PHEV") — it is never part of a model name
  // in the Irish index, and a 2020 Mondeo (26 ads) came back "not enough Irish
  // evidence" because of it. Strip a trailing HEV/PHEV/MHEV/HYBRID token.
  md = md.replace(/\s+(?:p?hev|mhev|hybrid|plug[- ]?in hybrid)$/i, "").trim();
  // 2 Oct 2026: BYD's plug-in badge the same way - the file says "SEAL U DM-I",
  // the Irish index says "seal u" (86 ads for 2025); "DM-p" is its sporty twin.
  md = md.replace(/\s+dm[- ]?[ip]$/i, "").trim();
  // 30 Sep 2026: the same file mis-spells Range Rover as "RANGR ROVER"
  // (a 2023 Range Rover Sport, 47 Irish ads / ~€85k, came back with no value).
  if (mk === "land rover") md = md.replace(/\brangr\b/g, "range");
  if (mk === "bmw") md = bmwFamily(md);
  else if (mk === "mercedes-benz") md = mercedesFamily(md);
  else if (mk === "audi") md = audiFamily(md);
  else if (mk === "lexus") md = lexusFamily(md);
  else if (mk === "volkswagen" && /^golf\b/.test(md)) md = "golf"; // "golf s", "golf gti"
  // 29 Sep 2026: the vehicle file calls the V40 "40 SERIES" (a 2015 car on /trade-ins came back
  // "not enough Irish evidence"). S40 production ended in 2012, so from 2013 on it can only be a V40.
  if (mk === "volvo" && /^40\s*series\b/.test(md)) md = "v40";
  return md;
}

// ---------------------------------------------------------------------------
// DISPLAY names (website review 3 Oct 2026 #63 #64). How a make or a model is
// WRITTEN on the page - never use these for a lookup (that is what
// normaliseMake/normaliseModel above are for). They lived in
// src/app/import/ImportLanding.tsx, which re-exports them so the footer, the car
// page and the related-deals strip are unchanged; they live here so the
// client-side home search can share them without pulling the import page into
// the browser bundle.
// ---------------------------------------------------------------------------

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bBmw\b/, "BMW").replace(/\bMg\b/, "MG").replace(/\bByd\b/, "BYD").replace(/\bDs\b/, "DS");
}

// Model names are stored the way the scraper found them (xc90, glc, 320d,
// A180d, 3 Series after family grouping). Render them the way a human — and
// a Google query — writes them.
function baseDisplayModel(make: string, model: string): string {
  const m = model.trim();
  const mk = make.toLowerCase();
  if (mk === "bmw" && /^i[x0-9][a-z0-9]*$/i.test(m)) return "i" + m.slice(1).toUpperCase();
  if (mk === "hyundai" && /^i\d+$/i.test(m)) return m.toLowerCase();
  if (/[\s-]/.test(m)) {
    // 17 Sep 2026: "cx-60" rendered "Cx-60" in the page title and in a
    // published post. A short letter code in front of digits or "-digits"
    // (CX-60, MX-30, EV6) is upper case; words stay title case (E-Tron, Aircross).
    // 1 Oct 2026: two short letter codes joined by a hyphen (c-hr, hr-v) are
    // both upper case - C-HR, HR-V - not C-Hr; a real word after the hyphen
    // (e-tron, x-trail) still reads E-Tron, X-Trail.
    if (/^[a-z]{1,3}-[a-z]{1,3}$/i.test(m)) return m.toUpperCase();
    return titleCase(m).replace(/\b([A-Za-z]{1,3})(?=\d|-\d)/g, (c) => c.toUpperCase());
  }
  if (/^[a-z]+$/.test(m)) return m.length <= 3 ? m.toUpperCase() : titleCase(m);
  if (/^[a-z]{1,2}\d+[a-z]*$/.test(m)) return m.toUpperCase();
  return m;
}

// Whole names the rules cannot derive - the maker's own spelling (website
// review 3 Oct 2026 #64: "Toyota rav4", "Kia RIO", "Toyota BZ4X" ...).
const MODEL_DISPLAY: Record<string, string> = {
  rav4: "RAV4",
  bz4x: "bZ4X",
  rio: "Rio",
  ka: "Ka",
  mii: "Mii",
  e: "e",
  "e:ny1": "e:Ny1",
  ix20: "ix20",
  mito: "MiTo",
  ecosport: "EcoSport",
  xceed: "XCeed",
  proceed: "ProCeed",
  "t-roc": "T-Roc",
  "up!": "up!",
  "e-up!": "e-up!",
  "e-golf": "e-Golf",
  "e vitara": "e Vitara",
};

// Words inside a name that the makers write in capitals or lower case
// ("e-tron GT", "Golf SV", "308 SW", "ID.3", "C-MAX", "500X").
function brandTokens(make: string, s: string): string {
  const mk = make.toLowerCase();
  let out = s
    .replace(/\bGt\b/g, "GT")
    .replace(/\bSw\b/g, "SW")
    .replace(/\bSv\b/g, "SV")
    .replace(/\bRs\b/g, "RS")
    .replace(/\b([BCS])-Max\b/g, "$1-MAX")
    .replace(/Spacetourer/g, "SpaceTourer")
    .replace(/^id\./i, "ID.");
  if (mk === "audi") out = out.replace(/\bE-Tron\b/g, "e-tron");
  if ((mk === "fiat" || mk === "abarth") && /^\d{3}[xc]$/i.test(out)) out = out.toUpperCase();
  return out;
}

export function displayModel(make: string, model: string): string {
  const raw = model.trim();
  const fixed = MODEL_DISPLAY[raw.toLowerCase()];
  if (fixed) return fixed;
  // "prius+", "c-hr+", "ka+": the model's own name, then the plus.
  if (raw.length > 1 && raw.endsWith("+")) return displayModel(make, raw.slice(0, -1)) + "+";
  return brandTokens(make, baseDisplayModel(make, raw));
}

// "an Audi", "an MG", "an Alfa Romeo"; "a BMW", "a Hyundai" (website review
// 3 Oct 2026 #63: the make pages said "Import a Audi"). A name written in
// capitals is read letter by letter, so MG takes "an" and BMW, BYD, DS take "a".
export function withArticle(name: string): string {
  const n = name.trim();
  const letters = n.match(/^([A-Z]{2,})\b/);
  const vowelSound = letters ? /^[AEFHILMNORSX]/.test(letters[1]) : /^[aeiou]/i.test(n);
  return `${vowelSound ? "an" : "a"} ${n}`;
}
