/**
 * Fields that describe what a car costs US. Never sent to a browser.
 *
 * Hiding a panel behind a client-side token check removes the UI but not the
 * data: anything passed as a prop to a client component is serialised into the
 * RSC payload, where any visitor can read it in DevTools. On 2 Aug 2026 the car
 * page shipped converted_price / shipping_fee / customs_agent_fee to logged-out
 * visitors, and /used-cars shipped the whole database row for all fifty tiles -
 * our cost base, service fee, UK transfer cost, OMSP and depreciation rates.
 *
 * Deleting the keys server-side is what actually makes them private. The
 * breakdown is served instead by /api/staff-car-detail/<id>, which checks the
 * staff token on the server rather than trusting the browser.
 *
 * DELIBERATELY NOT LISTED: final_price, before_vrt_final_price, vrt_rate and
 * mechanical_inspection_fee. The public price line is computed from those, and
 * VRT is a published Revenue charge rather than anything of ours.
 */
export const STAFF_ONLY_PRICE_FIELDS = [
  "converted_price",
  "shipping_fee",
  "customs_agent_fee",
  "customs_clearance_fee",
  "after_irish_vat",
  "fee",
  "duty_applied",
  "uktransfer_cost",
  "frozen_price_breakdown",
  "co2_tax",
  "nox",
  "nox_rate",
  "OMSP",
  "yearly_dep_rete",
  "monthly_dep_rate",
  "mileage_dep",
  "has_valid_vrt",
  "commission",
] as const;

/**
 * Copy without the cost fields. Safe on any shape - absent keys are ignored.
 *
 * Recurses into car_info because listing rows carry the same figures TWICE:
 * once at the top level and again nested. Stripping only the top level halved
 * the count and looked like a fix. Listing tiles read exactly one field from
 * that nested object, car_info.final_price, which is not in the list.
 */
export function stripStaffPriceFields<T extends object>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const k of STAFF_ONLY_PRICE_FIELDS) delete out[k];
  const nested = out.car_info;
  if (nested && typeof nested === "object") {
    out.car_info = stripStaffPriceFields(nested as object);
  }
  return out as T;
}
