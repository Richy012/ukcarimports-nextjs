/**
 * The CONDITION range and the OFFER made from it — owner, 5 Sep:
 *
 *   "We need to offer a range of pricing from no service history / issues
 *    mechanically to perfect car for both routes, with an actual offer made
 *    on submission of photos and questions answered regarding the condition
 *    of the car, damage, service history etc — like TradeBid do."
 *
 * Two halves, both pure so the page can preview and the server can decide:
 *
 *   1. THE RANGE. Its ends are named for the buyer: the bottom is a car with
 *      no service history and mechanical faults, the top is a perfect one.
 *      The WIDTH is measured — for the trade route it is the 80% spread of
 *      real Irish trade auction outcomes for cars at this mileage and age
 *      (tradein_model.json band80, fitted on 2,105 sales); for the private
 *      route it is the measured spread of asking prices on private ads that
 *      actually moved. What is NOT measured is that condition alone explains
 *      that spread — the Trade Book carries no condition fields, so it cannot
 *      be. It is the honest reading of it, and it is what the customer needs
 *      to see to understand why their answers move the figure.
 *
 *   2. THE OFFER. Starts at the top of the range (a perfect car) and steps
 *      down for every answer a buyer would step down for, floored at the
 *      bottom. Each step is a SHARE OF THE RANGE WIDTH, so a €40,000 car and
 *      a €9,000 car are both deducted in proportion. The weights below are
 *      the OWNER'S DIALS, not measurements — TradeBid do not publish theirs
 *      and no data we hold can fit them. Change them here and nowhere else.
 */

export interface ConditionAnswers {
  /** step 4: "Full" | "Partial" | "None" | "" */
  serviceHistory: string;
  /** step 4: "Nothing" | "Minor marks" | "Something to mention" | "" */
  damage: string;
  /** step 4: "Over 6 months" | "Under 6 months" | "Expired" | "" */
  nct: string;
  /** step 5 yes/no disclosure set, keyed by DISCLOSURES ids */
  disclosures: Record<string, string>;
}

export interface Deduction {
  id: string;
  label: string;
  /** share of the range width, positive = money off; negative = money back on */
  share: number;
}

/** THE DIALS. Share of the range width each answer moves the offer by. */
export const CONDITION_WEIGHTS = {
  history_partial: 0.25,
  history_none: 0.45,
  damage_minor: 0.1,
  damage_serious: 0.3,
  nct_under6: 0.04,
  nct_expired: 0.1,
  warning_lights: 0.25,
  warning_lights_diagnosed: 0.15,
  cold_noise: 0.2,
  cold_noise_clears: 0.1,
  gearbox_noisy: 0.25,
  electronics_faulty: 0.1,
  windscreen: 0.08,
  interior_damage: 0.1,
  body_repair: 0.15,
  odours: 0.05,
  one_key: 0.05,
  no_aircon: 0.03,
  /** the one thing that adds money back: a car already prepared to retail */
  retail_ready: -0.05,
};

const W = CONDITION_WEIGHTS;

/**
 * Every deduction the answers earn, in the order a buyer would raise them.
 * Unanswered questions deduct nothing — the flow will not let a customer
 * submit with the disclosure set incomplete, and a blank must never read as
 * a fault.
 */
export function conditionDeductions(a: ConditionAnswers): Deduction[] {
  const d = a.disclosures || {};
  const out: Deduction[] = [];
  const add = (id: string, label: string, share: number) => out.push({ id, label, share });

  // Service history: the step-4 answer leads; the disclosure pair backs it up
  // when step 4 was left blank.
  const history =
    a.serviceHistory ||
    (d.fsh === "yes" ? "Full" : d.fsh === "no" ? (d.partial_sh === "yes" ? "Partial" : d.partial_sh === "no" ? "None" : "") : "");
  if (history === "Partial") add("history", "Partial service history", W.history_partial);
  if (history === "None") add("history", "No service history", W.history_none);

  if (a.damage === "Minor marks") add("damage", "Minor bodywork marks", W.damage_minor);
  if (a.damage === "Something to mention") add("damage", "Bodywork damage to mention", W.damage_serious);

  if (a.nct === "Under 6 months") add("nct", "NCT due within 6 months", W.nct_under6);
  if (a.nct === "Expired") add("nct", "NCT expired", W.nct_expired);

  if (d.warning_lights === "yes") {
    add(
      "warning_lights",
      d.warning_diagnosed === "yes" ? "Warning light on, fault diagnosed" : "Warning light on, not diagnosed",
      d.warning_diagnosed === "yes" ? W.warning_lights_diagnosed : W.warning_lights,
    );
  }
  if (d.cold_noise === "yes") {
    add(
      "cold_noise",
      d.cold_noise_clears === "yes" ? "Engine noise when cold (clears warm)" : "Engine noise when cold",
      d.cold_noise_clears === "yes" ? W.cold_noise_clears : W.cold_noise,
    );
  }
  if (d.gearbox === "no") add("gearbox", "Gearbox noise or vibration", W.gearbox_noisy);
  if (d.electronics === "no") add("electronics", "Electronics not all working", W.electronics_faulty);
  if (d.windscreen === "yes") add("windscreen", "Windscreen damage", W.windscreen);
  if (d.interior_damage === "yes") add("interior", "Interior rips, tears or damage", W.interior_damage);
  if (d.body_repair === "yes") add("body_repair", "Previous paint or body repair", W.body_repair);
  if (d.odours === "no") add("odours", "Interior odours", W.odours);
  if (d.keys === "no") add("keys", "Only one key", W.one_key);
  if (d.aircon === "no") add("aircon", "No air conditioning", W.no_aircon);
  if (d.retail_ready === "yes") add("retail_ready", "Prepared to retail-ready condition", W.retail_ready);

  return out;
}

export interface Offer {
  /** the figure */
  eur: number;
  /** the condition range it was placed in */
  lowEur: number;
  highEur: number;
  /** 0 = a perfect car (top of range), 1 = the bottom */
  position: number;
  deductions: { id: string; label: string; eur: number }[];
}

const to50 = (x: number) => Math.round(x / 50) * 50;

/**
 * Place the car in its range.
 *
 * OWNER, 6 Sep: "Anchor on the median — the one point in the range that is
 * unbiased against real sales — and move off it only for things the customer
 * has told us... nothing ever goes below the bottom of the range." So a clean
 * car with full history, no faults and NCT clear sits at the MEDIAN (where
 * half of real sales land); each disclosed problem takes its dial's slice of
 * the range width off; the floor is the bottom of the range and the ceiling
 * is its top (a retail-ready car can earn a little back, never past the top).
 *
 * Before this the anchor was the TOP of the range - the price one sale in
 * four ever makes - which paid every clean car the best case. `anchorEur` is
 * optional only so nothing else that calls this breaks; the deal route passes
 * the trade route's median.
 */
export function makeOffer(lowEur: number, highEur: number, a: ConditionAnswers, anchorEur?: number): Offer {
  const lo = Math.min(lowEur, highEur);
  const hi = Math.max(lowEur, highEur);
  const width = hi - lo;
  const start = anchorEur != null && Number.isFinite(anchorEur) ? Math.min(hi, Math.max(lo, anchorEur)) : hi;
  const ded = conditionDeductions(a);
  const raw = ded.reduce((s, x) => s + x.share, 0);
  const eur = to50(Math.min(hi, Math.max(lo, start - raw * width)));
  const position = width > 0 ? (hi - eur) / width : 0;
  return {
    eur,
    lowEur: lo,
    highEur: hi,
    position,
    deductions: ded.map((x) => ({ id: x.id, label: x.label, eur: to50(x.share * width) })),
  };
}
