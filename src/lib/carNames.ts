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
