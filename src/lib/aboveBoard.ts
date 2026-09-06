/**
 * Above Board Cars — shared copy and prices. STAGING.
 *
 * Quoted on /trade-ins (the seller's card), /trade-ins/above-board-cars (the
 * customer page) and /above-board-cars (the buyer page the advert sends
 * people to). One place, so the pages can never disagree. Owner's wording and
 * prices, 6 Sep.
 */

/** The one line a seller puts in their DoneDeal / Carzone advert. */
export const AD_LINE =
  "This private sale is supported by the Above Board Cars platform, offering a Stripe-provided escrow-like transfer account, a mechanical inspection and a 12-month warranty.";

export const PUNCH_LINE = "Taking the Pirate out of Private car sales.";

/** Payment protection through Stripe's escrow-like transfer account, per sale. */
export const ESCROW_FEE_EUR = 195;

/** Independent mechanical inspection, by location and level of check. */
export const INSPECTION_FEE_EUR = { low: 250, high: 500 };

/**
 * The 12-month warranties that can go on an Above Board Cars sale — the same five
 * covers sold on every import. Above Board Cars prices (higher than the import
 * prices on the car page, deliberately — owner 6 Sep). Each links to the full
 * policy PDF the car page already serves.
 */
export const WARRANTY_DOC_BASE = "https://api.ukcarimports.ie/public/warranty-docs/";
export const WARRANTIES: { label: string; price: number; doc: string }[] = [
  { label: "Premium Power Train", price: 395, doc: "premium_powertrain" },
  { label: "Premium Max", price: 495, doc: "premium_max" },
  { label: "Premium Plus", price: 495, doc: "premium_plus" },
  { label: "Premium Component", price: 495, doc: "premium_component" },
  { label: "Premium EV", price: 495, doc: "premium_ev" },
];
