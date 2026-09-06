/**
 * Pick the right capture wireframe for the seller's own car. STAGING ONLY.
 *
 * Why this exists: showing a minivan outline to someone photographing a Golf
 * makes the alignment check unpassable, because the outline is the wrong shape.
 * The reg the seller already typed gives make and model (via /api/reg-lookup,
 * which reads motortax.ie), and our own Carzone capture gives the body type for
 * that make and model - 99% coverage across 310 make+model pairs. From the body
 * type we choose one of Monk's published vehicle sets.
 *
 * Only sets holding all ten exterior sights are used. The T-Roc and A7 sets
 * carry three apiece, so an SUV gets the Ford Escape - a compact crossover,
 * which is what most Irish "SUV" listings actually are - and a coupe gets the
 * Accord rather than a set with holes in it.
 */

export type WireframeSet =
  | "ffocus18"    // hatchback
  | "haccord"     // saloon / coupe / convertible
  | "fesc20"      // crossover, and our default
  | "jgc21"       // large SUV
  | "ff150"       // pickup
  | "tsienna20"   // MPV
  | "ftransit18"; // van - only 13 of the 16, see below

/** What we fall back to when the reg tells us nothing. The Escape is a middling
 *  crossover shape, so it is the least wrong single choice across Irish stock. */
export const DEFAULT_SET: WireframeSet = "fesc20";

/** The van set is missing three sights; those slots fall back to the default. */
export const INCOMPLETE: Partial<Record<WireframeSet, string[]>> = {
  ftransit18: ["out_roof", "out_front_pass_close", "out_front_driver"],
};

/** Carzone's own body_type values, which is what our lookup returns. */
const BY_BODY: Record<string, WireframeSet> = {
  hatchback: "ffocus18",
  saloon: "haccord",
  coupe: "haccord",
  convertible: "haccord",
  // An estate is a hatchback stretched at the back; no Monk set is an estate,
  // and the Focus is far closer than the minivan.
  estate: "ffocus18",
  suv: "fesc20",
  // NOT the minivan, despite the name. Measured from our own Carzone capture:
  // the models Irish dealers file under "MPV" are overwhelmingly crossovers -
  // Puma, 3008, Qashqai, Kona, 2008, Sportage, Juke, Kuga - and the Tucson
  // appears under both MPV and SUV, so the field is inconsistently entered. A
  // crossover outline fits nearly all of them; a minivan fits almost none.
  // Genuine people carriers are caught by name in NAME_HINTS instead.
  mpv: "fesc20",
  minivan: "tsienna20",
  van: "ftransit18",
  "wheelchair accessible": "ftransit18",
  pickup: "ff150",
};

/**
 * Models our Carzone data cannot classify, because they are commercials and do
 * not appear in retail car stock. Without these a Ford Transit falls through to
 * the make-level fallback and gets Ford's commonest shape - a Focus - which is
 * a worse guide than no match at all. Checked before any fallback.
 */
const NAME_HINTS: Array<[RegExp, string]> = [
  [/\b(transit|sprinter|vito|crafter|ducato|boxer|relay|jumper|transporter|caddy|combo|berlingo|partner|expert|proace|vivaro|trafic|master|movano|daily|nv200|nv300|nv400|doblo|scudo|talento)\b/, "van"],
  [/\b(hilux|ranger|navara|l200|amarok|d-?max|musso|rodeo|barbarian|wildtrak)\b/, "pickup"],
  // Genuine people carriers. Needed because our body-type field cannot be
  // trusted to find them - Irish dealers file crossovers under "MPV" too, so
  // that value alone would send a Golf-sized crossover a minivan outline.
  [/\b(zafira|touran|sharan|alhambra|galaxy|s-?max|scenic|espace|picasso|verso|carens|jogger|multivan|caravelle|tourneo|5008|grand ?c-?max|proace verso)\b/, "minivan"],
];

export interface BodyTypeLookup {
  pairs: Record<string, string>;
  makes: Record<string, string>;
}

let cache: BodyTypeLookup | null = null;
let inflight: Promise<BodyTypeLookup | null> | null = null;

/** Loaded once and reused; 8KB, so it costs nothing to keep. */
export async function loadLookup(): Promise<BodyTypeLookup | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/tradein-body-types.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      cache = j;
      return j;
    })
    .catch(() => null);
  return inflight;
}

/** Body type for a make and model, or null if we hold nothing for it. */
export function bodyTypeFor(
  lookup: BodyTypeLookup | null,
  make?: string | null,
  model?: string | null,
): string | null {
  if (!make) return null;
  const mk = make.trim().toLowerCase();
  const md = (model || "").trim().toLowerCase();

  // Commercials first: these never appear in retail car stock, so the lookup
  // cannot know them and the make fallback would actively mislead.
  for (const [re, bt] of NAME_HINTS) {
    if (re.test(md) || re.test(mk)) return bt;
  }

  if (!lookup) return null;

  if (md) {
    const exact = lookup.pairs[`${mk}|${md}`];
    if (exact) return exact;
    // Irish adverts write "3008 Allure" or "Golf GTI" where we hold "3008" and
    // "golf", so try the leading word before giving up on the model.
    const head = md.split(/[\s/-]/)[0];
    if (head && head !== md) {
      const partial = lookup.pairs[`${mk}|${head}`];
      if (partial) return partial;
    }
  }
  return lookup.makes[mk] || null;
}

/** Body type -> wireframe set, defaulting rather than ever returning nothing. */
export function setForBodyType(bodyType?: string | null): WireframeSet {
  if (!bodyType) return DEFAULT_SET;
  return BY_BODY[bodyType.trim().toLowerCase()] || DEFAULT_SET;
}

/**
 * The whole chain in one call: make + model -> body type -> wireframe set.
 * Always returns a usable set.
 */
export function setForVehicle(
  lookup: BodyTypeLookup | null,
  make?: string | null,
  model?: string | null,
): { set: WireframeSet; bodyType: string | null } {
  const bodyType = bodyTypeFor(lookup, make, model);
  return { set: setForBodyType(bodyType), bodyType };
}

/**
 * Where a given slot's overlay actually lives. Falls back to the default set for
 * the handful of sights the van set does not carry, so a slot is never blank
 * just because of the vehicle chosen.
 */
export function overlayUrl(version: string, set: WireframeSet, slot: string): string {
  const holes = INCOMPLETE[set];
  const useSet = holes && holes.includes(slot) ? DEFAULT_SET : set;
  return `/tradein-outlines/${version}/${useSet}/${slot}.svg`;
}
