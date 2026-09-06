/**
 * Price every route off ONE number. INTERNAL DATA, PUBLIC OUTPUT IS RANGES.
 *
 * Owner, 4 Sep: "we have to offer a price per route - this is how people will
 * choose how they want to sell their trade in." A menu of descriptions is
 * homework; a menu of numbers is a choice. The thing that makes the menu
 * coherent is that every route is a share of the SAME Carzone retail median
 * for that exact car, by the frozen segment — so the customer can see for
 * themselves what convenience costs, and no two cards can contradict.
 *
 * THE TWO ENGINES ARE NOT ON EQUAL EVIDENCE, and the difference is stated
 * rather than smoothed over:
 *
 *   TRADE   fitted on 2,105 REAL TRANSACTIONS — cars that changed hands at a
 *           known price in Irish trade auctions. Held-out error 10.9 points.
 *   PRIVATE built from ASKING prices, because no achieved private price exists
 *           in any data we hold and nobody publishes them. What rescues it
 *           from being a guess is that we can see which private ads actually
 *           moved: ads that left within two weeks were asking 88.7% of the
 *           dealer median, ones that stuck were asking 92.3%. The same
 *           price-predicts-speed gradient already proven across ~28,000 cars
 *           holds inside the private ads on their own, so "price it here and
 *           it goes" is measured, not asserted.
 *
 * That 88.7% also vindicates the design's original ~87–90% assumption, which
 * was explicitly held as configuration pending exactly this calibration.
 *
 * WHY THE PRIVATE FLOOR IS THE TRADE FIGURE: a seller always has the trade-in
 * available, so no rational private sale settles below it. That makes the
 * floor a measured number rather than a chosen one, and the gap between the
 * two cards — the money the seller is being asked to work for — is the whole
 * argument for the private route.
 */

import { tradeShare, type TradeShare } from "./tradeinModel";
import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "privateproof_model.json");
const CACHE_MS = 10 * 60 * 1000;

interface Band { pct: number; n: number }
interface PrivateModel {
  asking_pct_global: number | null;
  asking_pct_by_mileage: Record<string, Band>;
  /** what a DEALER ad at each mileage is worth against its own segment median.
   *  The private percentages are expressed against a like-for-like dealer ad,
   *  so they have to be scaled by this to become euro off the segment median. */
  mileage_control_pct: Record<string, number>;
  sells_at: {
    sold_within_2_snapshots_asked_pct: number;
    n_sold: number;
    still_listed_asked_pct: number;
    n_stayed: number;
    moved_p25_pct: number;
    moved_p75_pct: number;
    gap_from_typical_ask_pts: number;
  } | null;
  markdown: { private: { expected_markdown_pct: number; n: number } | null };
  time_on_market: Record<string, { at_risk: number; gone_pct: number } | string>;
  private_ads_matched: number;
  built_from_snapshots: string[];
}

let cache: { at: number; m: PrivateModel | null } | null = null;

async function loadPrivate(): Promise<PrivateModel | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.m;
  let m: PrivateModel | null = null;
  try {
    m = JSON.parse(await fs.readFile(FILE, "utf8")) as PrivateModel;
  } catch {
    m = null;
  }
  cache = { at: Date.now(), m };
  return m;
}

function mileageBand(km: number): string {
  if (km < 60000) return "under 60k";
  if (km < 100000) return "60-100k";
  if (km < 150000) return "100-150k";
  return "150k+";
}

export interface RouteQuote {
  route: "private" | "trade";
  label: string;
  lowEur: number;
  highEur: number;
  /** the one figure to lead a card with; the range is the honest spread round it */
  typicalEur: number;
  /**
   * THE CONDITION RANGE (owner, 5 Sep) — what the card shows. Bottom reads
   * "no service history, mechanical faults", top "a perfect car"; the OFFER
   * is placed inside it from the photos and condition answers at submission
   * (lib/conditionOffer.ts). Trade: the measured 80% spread of real auction
   * outcomes. Private: the measured spread of asking prices on ads that moved.
   */
  conditionLowEur: number;
  conditionHighEur: number;
  /** trade route only: the unbiased centre, for the dealer view - NOT the offer */
  medianEur?: number;
  timing: string;
  givesUp: string;
  evidence: string;
  /** how strong the evidence behind this route actually is — they are NOT equal */
  evidenceGrade: "transactions" | "asking prices";
}

export interface RoutePricing {
  retailEur: number;
  segment: string;
  comparables: number;
  routes: RouteQuote[];
  /** private minus trade, at the midpoint — what the work is worth */
  privatePremiumEur: number | null;
  notes: string[];
}

const to50 = (x: number) => Math.round(x / 50) * 50;

/**
 * Both routes, or null when the car cannot be priced. Deliberately strict:
 * no retail median or no mileage means no cards, because a route menu with a
 * made-up number on it is worse than no menu.
 */
export async function priceRoutes(
  make: string,
  model: string,
  year: number | null,
  km: number | null,
  retailEur: number | null,
  comparables: number,
): Promise<RoutePricing | null> {
  if (!retailEur || retailEur <= 0 || year == null || !km) return null;

  const trade: TradeShare | null = await tradeShare(make, model, year, km);
  const pm = await loadPrivate();
  if (!trade) return null;

  const segment = `${make} ${model} ${year}`.replace(/\s+/g, " ").trim();
  const routes: RouteQuote[] = [];
  const notes: string[] = [];

  // ---- PRIVATE ---------------------------------------------------------
  let privateMid: number | null = null;
  if (pm && pm.sells_at && pm.asking_pct_global) {
    const mb = mileageBand(km);
    const band = pm.asking_pct_by_mileage[mb];
    const ask = band ? band.pct : pm.asking_pct_global;
    // the measured distance between what private sellers typically ask and
    // what the ones who actually moved were asking, applied to this car's band
    const movesAt = ask - pm.sells_at.gap_from_typical_ask_pts;

    // A PRIVATE SALE CANNOT BEAT THE DEALER'S OWN ASKING PRICE. The raw data
    // says private sellers of low-mileage cars ask a shade over 100% of a
    // like-for-like dealer ad, which is them being optimistic — a buyer who
    // pays dealer money privately gives up the warranty and every scrap of
    // recourse for nothing. Left uncapped the page would tell customers they
    // can sell privately for more than a dealer charges, which is not true
    // and would discredit every other number on it.
    // THE SPREAD IS THE MEASURED ONE, and it is uncomfortably wide on purpose.
    // The middle half of private ads that actually moved were asking anywhere
    // from 82.7% to 103.2% of a like-for-like dealer ad. That is what private
    // selling is: the outcome depends on condition, patience and who turns up,
    // none of which we can see. Narrowing it would be inventing precision, so
    // the card leads with the typical figure and carries the spread honestly.
    const s = pm.sells_at;
    const loOff = s.moved_p25_pct - s.sold_within_2_snapshots_asked_pct;
    const hiOff = s.moved_p75_pct - s.sold_within_2_snapshots_asked_pct;

    // A PRIVATE SALE CANNOT BEAT THE DEALER'S OWN ASKING PRICE. The top of the
    // measured spread runs past 100% of a like-for-like dealer ad — real, but
    // it is a handful of optimistic sellers, and a card telling customers they
    // can beat dealer money privately would discredit every other number on
    // the page. A private buyer gives up the warranty and every scrap of
    // recourse; they do not pay a premium for that.
    const capped = 100;

    // the private percentages are relative to a dealer ad AT THIS MILEAGE, so
    // scale by the control to turn them into euro off the segment median
    const ctrl = (pm.mileage_control_pct?.[mb] ?? 100) / 100;
    const lowPct = Math.max((movesAt + loOff) * ctrl, trade.sold.pct); // trade floor
    const highPct = Math.min(movesAt + hiOff, capped) * ctrl;
    const low = to50((retailEur * lowPct) / 100);
    const high = to50((retailEur * Math.max(highPct, lowPct)) / 100);
    // the DECISION number is the typical outcome, not the midpoint of a wide
    // range — a midpoint drifts with the spread and would flatter the route
    privateMid = to50((retailEur * movesAt * ctrl) / 100);
    routes.push({
      route: "private",
      // THE LABEL MATTERS AS MUCH AS THE NUMBER. Everything measurable about
      // the private route is an ASKING price — what sellers advertise at, and
      // what the ones who moved advertised at. Nobody publishes what Irish
      // private sellers finally accept. So this card must read as "advertise
      // it here", which is exactly what the evidence supports and is genuinely
      // useful advice, and must NOT read as "this is what you will pocket",
      // which the evidence does not support and which the trade card, backed
      // by actual transactions, is the only one entitled to say.
      label: "Sell it yourself, protected — advertise it at",
      lowEur: low,
      highEur: high,
      typicalEur: privateMid,
      conditionLowEur: low,
      conditionHighEur: high,
      evidenceGrade: "asking prices",
      timing: "weeks, not days",
      givesUp:
        "your time, viewings, and no certainty of a sale — and this is the advertised " +
        "price, so expect to settle a little under it",
      evidence:
        `Private ads for cars like this are advertised at about ${ask.toFixed(0)}% of what a ` +
        `dealer asks for the same car at the same mileage; the ones that actually moved were ` +
        `priced nearer ${movesAt.toFixed(0)}%. Based on ${band ? band.n : pm.private_ads_matched} ` +
        `private ads. An advertised price is not a sold price — no data anywhere shows what Irish ` +
        `private sellers finally accept, so the real figure sits a little under this.`,
    });
    const gone2 = pm.time_on_market["private_2w"];
    if (typeof gone2 === "object") {
      notes.push(
        `About ${Math.round(gone2.gone_pct)}% of private ads leave the market within two weeks, ` +
          `but some of those are sellers giving up rather than selling — we cannot tell which.`,
      );
    }
  } else {
    notes.push("Private route not priced: the private-sale model has not been built yet.");
  }

  // ---- TRADE -----------------------------------------------------------
  const tLow = to50((retailEur * trade.sold.lowPct) / 100);
  const tHigh = to50((retailEur * trade.sold.highPct) / 100);
  // THE OFFER IS THE BOTTOM OF THE RANGE - owner, 5 Sep. The median is
  // unbiased over many cars but any one car can be EUR 4,000 out and half make
  // less than it; the bottom of the range is covered on ~3 cars in 4. The
  // median is kept as `medianEur` for the dealer view and the record.
  const tMed = to50((retailEur * trade.sold.pct) / 100);
  const tTyp = tLow;
  // The condition range is ASYMMETRIC (owner, 5 Sep: "you have that it could
  // make 85% of the best retail price" — the first version put the top at the
  // 90th percentile of outcomes, which is spec and market luck, not condition).
  // TOP = the measured 50% band's top: one trade sale in four makes more than
  // this, and that quartile is where a clean, full-history, well-kept car sits.
  // BOTTOM = the 80% band's low: the worst decile of outcomes is where no
  // history and mechanical faults land. Never below what the room bid on all
  // lots including the unsold.
  const cLow = Math.max(to50((retailEur * trade.sold.low80Pct) / 100), to50((retailEur * trade.floor.low80Pct) / 100));
  const cHigh = tHigh;
  routes.push({
    route: "trade",
    label: "Against your import",
    lowEur: tLow,
    highEur: tHigh,
    typicalEur: tTyp,
    medianEur: tMed,
    conditionLowEur: Math.min(cLow, tLow),
    conditionHighEur: Math.max(cHigh, tHigh),
    evidenceGrade: "transactions",
    timing: "certain today, credited on delivery day",
    givesUp: "the difference — you are paying for certainty and no effort",
    evidence:
      `From ${trade.sold.n} real Irish trade sales of cars at this mileage and age. ` +
      `About three cars in four make at least this figure.`,
  });

  return {
    retailEur,
    segment,
    comparables,
    routes,
    // typical vs typical — the only comparison that answers "which route"
    // ADVERTISED private price minus the trade figure a customer would actually
    // be paid. It is therefore an UPPER bound on what the extra work is worth,
    // not the work's value — say so wherever this is rendered.
    privatePremiumEur: privateMid != null ? to50(privateMid - tTyp) : null,
    notes: [
      ...notes,
      "Every figure here is a share of the same Irish dealer price for your exact car, " +
        "so the routes can be compared directly.",
      "The two routes are not backed by equally strong evidence: the trade figure comes from " +
        "cars that actually changed hands at a known price, the private figure from what " +
        "comparable private ads were asking. Private outcomes vary far more.",
      "All ranges are indicative until the car is inspected.",
    ],
  };
}
