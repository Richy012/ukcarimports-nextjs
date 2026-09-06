/**
 * The measured trade-in share of retail. INTERNAL DATA, PUBLIC OUTPUT IS A BAND.
 *
 * Until now the trade-in band was an ASSUMPTION: fixed tiers (fast 70-85%,
 * ordinary 65-72%, slow 58-65%) picked by how fast the segment moves on
 * Carzone. Those percentages were the owner's specification informed by trade
 * practice, explicitly held as configuration "to be calibrated as real bids
 * arrive". This is that calibration, and it replaces the guess with a number
 * measured on 3,211 real Irish trade auctions.
 *
 * WHAT THE NUMBER IS: top bid as a share of the Irish retail median for the
 * car's FROZEN segment (make + model + year). The denominator is the same
 * valuation index the site already quotes as retail, so the share composes
 * directly with the retail estimate the customer is shown.
 *
 * TWO ANSWERS, ALWAYS - owner, 31 Aug: "the estimator has to offer a sold
 * figure and then one including unsold."
 *   sold   what cars like this actually changed hands for. Biased slightly
 *          upward: it only counts sellers willing to let go at the price bid.
 *   floor  the same across every lot including the unsold, using the top bid
 *          whether or not it met reserve. This is what the room actually bid.
 * The honest expectation sits between them, and the width of the gap is itself
 * information: a wide gap is a segment where buyers and sellers disagree, which
 * is exactly where a trade-in quote is riskiest.
 *
 * THE ESTIMATOR was chosen by held-out score, not by preference - five
 * candidates, 75/25 split, 250 trials, in `tb_model.py` on production. The
 * winner is the mileage x age table plus a per-model factor shrunk toward 1,
 * at 10.9 points of mean absolute error against a 15.4-point constant. Three
 * better-scoring variants were REJECTED because they need fields a real quote
 * does not have: fuel, gearbox and body (the reg lookup returns make, model
 * and year only) and bidder count (we cannot know the turnout for a car nobody
 * has listed). Rejecting them cost 0.13 points, which is nothing.
 *
 * HARD RULE 4 STANDS: no firm online valuation, ever. The band this returns is
 * the measured interquartile spread of the model's own out-of-sample error, so
 * its width is a fact about how well we can predict, not a comfort margin -
 * and about half of cars land inside it, which is what the copy must say.
 */

import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "tradein_model.json");
const CACHE_MS = 10 * 60 * 1000;

interface Cell { pct: number; n: number }
interface Factor { factor: number; n: number }
interface Accuracy {
  estimator: string;
  mae_pts: number;
  sd_pts: number;
  bias_pts: number;
  band50_pts: [number, number];
  band80_pts: [number, number];
  beats_constant_pts: number;
}
interface Side {
  estimator: string;
  base: "ols" | "cells";
  apply_model_factor: boolean;
  global_pct: number;
  n: number;
  coefficients: Record<string, number> | null;
  bands: Record<string, Cell>;
  cells: Record<string, Cell>;
  model_factors: Record<string, Factor>;
  direct_segments: Record<string, Cell>;
  accuracy: Accuracy;
}
interface Model {
  built: string;
  this_year: number;
  mileage_bands: [number, number, string][];
  age_bands: [number, number, string][];
  min_direct_n: number;
  sold: Side;
  all: Side;
}

let cache: { at: number; model: Model | null } | null = null;

async function load(): Promise<Model | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.model;
  let model: Model | null = null;
  try {
    model = JSON.parse(await fs.readFile(FILE, "utf8")) as Model;
  } catch {
    model = null; // no artifact -> caller falls back to the configured tiers
  }
  cache = { at: Date.now(), model };
  return model;
}

function labelFor(bands: [number, number, string][], v: number): string | null {
  for (const [lo, hi, lab] of bands) if (v >= lo && v < hi) return lab;
  return bands.length ? bands[bands.length - 1][2] : null;
}

export type Basis = "cell" | "band" | "global";

export interface Share {
  pct: number;        // central estimate, % of Irish retail
  lowPct: number;     // measured 50% band, low
  highPct: number;    // measured 50% band, high
  // the measured 80% band — the CONDITION range shown to the customer
  // (lib/conditionOffer.ts): its bottom reads as "no history, mechanical
  // faults", its top as "a perfect car". Width measured, the reading is not.
  low80Pct: number;
  high80Pct: number;
  n: number;          // observations behind the cell/band used
  basis: Basis;
}

export interface TradeShare {
  sold: Share;
  floor: Share;
  modelFactor: number | null;   // >1 = this model beats its mileage/age peers
  modelFactorN: number;
  direct: { pct: number; n: number } | null; // exact make|model|year evidence
  maePts: number;               // out-of-sample MAE of the chosen estimator
  bandCoverage: 50;             // what share of cars land inside the band
  built: string;
}

/** km, whatever the customer typed in. */
export function toKm(mileage: number | null, unit: "km" | "miles"): number | null {
  if (mileage == null || !Number.isFinite(mileage) || mileage <= 0) return null;
  return unit === "miles" ? Math.round(mileage * 1.609) : Math.round(mileage);
}

function shareFrom(side: Side, m: Model, key: string, km: number, year: number): Share {
  const kmLab = labelFor(m.mileage_bands, km);
  const ageLab = labelFor(m.age_bands, m.this_year - year);

  let pct = side.global_pct;
  let n = side.n;
  let basis: Basis = "global";

  const band = kmLab ? side.bands[kmLab] : undefined;
  if (band) { pct = band.pct; n = band.n; basis = "band"; }

  const cell = kmLab && ageLab ? side.cells[`${kmLab}|${ageLab}`] : undefined;
  if (cell) { pct = cell.pct; n = cell.n; basis = "cell"; }

  // the per-model factor is already shrunk toward 1 in the artifact, so a model
  // with six cars moves its own price a little and one with sixty moves it a lot
  if (side.apply_model_factor) {
    const f = side.model_factors[key];
    if (f) pct = pct * f.factor;
  }

  const [lo, hi] = side.accuracy.band50_pts;
  const [lo80, hi80] = side.accuracy.band80_pts ?? [lo * 2, hi * 2];
  return {
    pct: Math.round(pct * 10) / 10,
    lowPct: Math.round((pct + lo) * 10) / 10,
    highPct: Math.round((pct + hi) * 10) / 10,
    low80Pct: Math.round((pct + lo80) * 10) / 10,
    high80Pct: Math.round((pct + hi80) * 10) / 10,
    n,
    basis,
  };
}

/**
 * Returns null when there is no artifact or no usable mileage — the caller
 * must then fall back to the configured tiers rather than invent a number.
 * Mileage is not optional here on purpose: it is the single strongest thing
 * we know about the car, and a share quoted without it is the old guess in
 * new clothing.
 */
export async function tradeShare(
  make: string,
  model: string,
  year: number | null,
  km: number | null,
): Promise<TradeShare | null> {
  const m = await load();
  if (!m || !km || year == null || !Number.isInteger(year)) return null;
  if (km <= 1000 || km > 400000) return null; // outside what was measured

  const mk = (make || "").trim().toLowerCase();
  const md = (model || "").trim().toLowerCase();
  if (!mk || !md) return null;

  const key = `${mk}|${md}`;
  const sold = shareFrom(m.sold, m, key, km, year);
  const floor = shareFrom(m.all, m, key, km, year);

  const f = m.sold.model_factors[key];
  const d = m.sold.direct_segments[`${mk}|${md}|${year}`];

  return {
    sold,
    // the floor can never read above the sold line; if a thin cell inverts
    // them, the pair is meaningless, so collapse to equality rather than
    // print a floor that is higher than the figure it is a floor for
    floor: floor.pct > sold.pct ? { ...floor, pct: sold.pct } : floor,
    modelFactor: f ? f.factor : null,
    modelFactorN: f ? f.n : 0,
    direct: d && d.n >= m.min_direct_n ? { pct: d.pct, n: d.n } : null,
    maePts: m.sold.accuracy.mae_pts,
    bandCoverage: 50,
    built: m.built,
  };
}
