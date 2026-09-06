/**
 * Trade-in valuation — staging, v3: the MEASURED band.
 *
 * HARD RULE 4 unchanged: no firm online valuation, ever. Output is a retail
 * estimate + indicative band + comparables count, or "not enough Irish
 * evidence".
 *
 * v2 (2026-08-19, owner's direction): price Irish cars that are NOT on
 * Carzone using comparable examples. Evidence is the weekly-rebuilt
 * valuation index (data/valuation_index.json — every tracked Carzone
 * vehicle's latest asking price, segment = the FROZEN make+model+year):
 *
 *   1. exact segment, n>=5            -> its median.
 *   2. both adjacent years present    -> geometric midpoint of their medians
 *      ("a 2022 sits between the 2021s and the 2023s").
 *   3. one adjacent year + the model's MEASURED year-step ratio -> stepped
 *      estimate (steps come from adjacent-year median ratios, never assumed).
 *   4. legacy exact medians file (belt).
 *   5. honestly: no number.
 *
 * Estimates from routes 2–3 are rounded to €50 and use the ordinary band —
 * derived evidence never earns the fast tier.
 *
 * v3 (2026-09-04): THE BAND IS NOW MEASURED, NOT ASSUMED. The retail ladder
 * above is untouched — only the trade-in percentage applied to it changes.
 * Where we know the mileage, data/tradein_model.json supplies the share of
 * retail that Irish trade buyers actually pay, fitted on 3,211 real trade
 * auctions and chosen by held-out score (see lib/tradeinModel.ts). It returns
 * TWO figures — what cars like this sold for, and the floor including lots
 * that did not meet reserve — because the owner asked for both.
 *
 * WITHOUT A MILEAGE NOTHING CHANGES. The old velocity-tiered configured bands
 * remain exactly as they were, and remain the fallback, because a share quoted
 * without the mileage is the old guess in new clothing. Velocity still writes
 * its note either way: how fast a segment moves is real information about the
 * car even when it no longer picks the percentage.
 */

import { promises as fs } from "fs";
import path from "path";
import { readOnly, type Valuation } from "./dealstore";
import { tradeShare } from "./tradeinModel";
import { trimAdjustment } from "./trimIndex";

const DATA = (f: string) => path.join(process.cwd(), "data", f);
const MIN_ADS = 5;
const FAST_ADS = 10;
const CACHE_MS = 10 * 60 * 1000;

interface SegRow { n: number; median: number; p25?: number; p75?: number }
interface ValIndex {
  segments: Record<string, SegRow>;
  year_steps: Record<string, Record<string, number>>;
}
interface VelocityCell { at_risk: number; gone: number; pct: number }
interface Velocity {
  segments: Record<string, Record<string, VelocityCell>>;
  models: Record<string, Record<string, VelocityCell>>;
}

let cache: { at: number; idx: ValIndex; velo: Velocity | null; legacy: Record<string, { ads: number; med: number }> } | null = null;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(DATA(file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function load() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const idxRaw = await readJson<{ segments?: unknown; year_steps?: unknown }>("valuation_index.json");
  const idx: ValIndex = {
    segments: (idxRaw?.segments as ValIndex["segments"]) ?? {},
    year_steps: (idxRaw?.year_steps as ValIndex["year_steps"]) ?? {},
  };
  const veloRaw = await readJson<Velocity>("velocity.json");
  const legacy = (await readJson<Record<string, { ads: number; med: number }>>("segment_medians.json")) ?? {};
  cache = { at: Date.now(), idx, velo: veloRaw, legacy };
  return cache;
}

function seg(idx: ValIndex, mk: string, md: string, y: number): SegRow | null {
  const r = idx.segments[`${mk}|${md}|${y}`];
  return r && r.n >= MIN_ADS && r.median > 0 ? r : null;
}

function avgStep(idx: ValIndex, mk: string, md: string): number | null {
  const st = idx.year_steps[`${mk}|${md}`];
  if (!st) return null;
  const vals = Object.values(st).filter((v) => v > 0.6 && v <= 1.0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function velocityNote(velo: Velocity | null, mk: string, md: string, y: number): string {
  if (!velo) return "";
  const cell = velo.segments?.[`${mk}|${md}|${y}`] ?? velo.models?.[`${mk}|${md}`];
  if (!cell) return "";
  const two = cell["gone_2w"];
  const one = cell["gone_1w"];
  if (two && two.at_risk >= 8) {
    return ` ${two.pct}% of newly listed Irish examples were gone within two weeks.`;
  }
  if (one && one.at_risk >= 8) {
    return ` ${one.pct}% of newly listed Irish examples were gone within a week.`;
  }
  return "";
}

const to50 = (x: number) => Math.round(x / 50) * 50;

type Tier = "fast" | "ordinary" | "slow";

/**
 * Velocity-tiered bands (owner, 19 Aug): tier membership is MEASURED, never
 * judged — the two-week gone-%% from velocity.json picks the band. Unknown
 * velocity or a thin cohort defaults to ordinary. Priors fast 70-85%% /
 * ordinary 65-72%% / slow 58-65%% of retail.
 *
 * v3: this is now the FALLBACK, used only when we have no mileage to feed the
 * measured model. It is deliberately left intact rather than deleted — it is
 * the only answer available when someone asks for a price without saying how
 * far the car has been driven.
 */
function velocityTier(
  velo: Velocity | null, mk: string, md: string, y: number,
  fastPct: number, slowPct: number,
): Tier {
  if (!velo) return "ordinary";
  const seg = velo.segments?.[`${mk}|${md}|${y}`];
  const mod = velo.models?.[`${mk}|${md}`];
  const pick = (c: Record<string, VelocityCell> | undefined): VelocityCell | undefined => {
    const two = c?.["gone_2w"];
    return two && two.at_risk >= 8 ? two : undefined;
  };
  const cell = pick(seg) ?? pick(mod);
  if (!cell) return "ordinary";
  if (cell.pct >= fastPct) return "fast";
  if (cell.pct <= slowPct) return "slow";
  return "ordinary";
}

const TIER_NOTE: Record<Tier, string> = {
  fast: " Fast-selling segment in Ireland — trade bids typically run near the top of the band.",
  ordinary: "",
  slow: " Slower-selling segment — trade bids run nearer the bottom of the band.",
};

export async function valueTradeIn(
  make: string,
  model: string,
  year: number | null,
  km: number | null = null,
  trim: string | null = null,
): Promise<Valuation> {
  const mk = (make || "").trim().toLowerCase();
  const md = (model || "").trim().toLowerCase();
  const segment = [make?.trim(), model?.trim(), year ?? ""].join(" ").replace(/\s+/g, " ").trim();

  const noEvidence: Valuation = {
    estimateEur: null,
    comparables: 0,
    segment,
    bandLowEur: null,
    bandHighEur: null,
    note: "not enough Irish evidence",
  };
  if (!mk || !md || year == null || !Number.isInteger(year)) return noEvidence;

  const { idx, velo, legacy } = await load();
  const cfg = await readOnly((db) => ({
    tiers: db.config.bandTiers,
    fastPct: db.config.tierFastPct ?? 40,
    slowPct: db.config.tierSlowPct ?? 15,
  }));
  const vNote = velocityNote(velo, mk, md, year);
  const marketTier = velocityTier(velo, mk, md, year, cfg.fastPct, cfg.slowPct);
  const measured = await tradeShare(make, model, year, km);
  // v4 (2026-09-05, owner's catch): the segment median prices every trim the
  // same, which is right for most cars and wrong by EUR 750-2,200 for the 13%
  // whose spec sits well away from their segment. Applied to the RETAIL figure,
  // before the trade percentage, because that is where the money actually is.
  const trimAdj = await trimAdjustment(make, model, year, trim);

  const finish = (rawEst: number, comparables: number, capToOrdinary: boolean, note: string): Valuation => {
    // The ladder found the SEGMENT's retail median; the trim ratio moves it to
    // THIS car's retail. Rounded to EUR 50 like every other derived figure.
    const est = trimAdj ? Math.round((rawEst * trimAdj.ratio) / 50) * 50 : rawEst;
    const trimNote = trimAdj
      ? ` Adjusted for ${trimAdj.trim} spec, from ${trimAdj.n} Irish ${trimAdj.trim} listings.`
      : "";
    if (measured) {
      // MEASURED PATH. The band is the model's own out-of-sample interquartile
      // spread, so its width states how well we can predict rather than how
      // cautious we feel. Half of cars land inside it — say so, never imply
      // the range is a guarantee.
      // TRIM APPLIES TO THE RETAIL FIGURE ONLY, NOT THE TRADE BAND.
      // Measured end-to-end against 2,105 real auction outcomes: adjusting the
      // retail and then applying the same percentage makes the TRADE figure
      // WORSE by EUR 73 on the cars it touches. The auction has already priced
      // the trim - a GTI makes a higher share of its segment median, and the
      // per-model factor has absorbed that - so uplifting the retail as well
      // double-counts it. Refitting the percentage on trim-adjusted retail was
      // still worse (EUR 62), so this is not a calibration bug, it is the trim
      // genuinely belonging on one side of the sum and not the other.
      // The retail figure keeps the adjustment because there it IS more
      // accurate, and it is what the private route quotes.
      const pctToEur = (p: number) => Math.round((rawEst * p) / 100 / 50) * 50;
      return {
        estimateEur: est,
        comparables,
        segment,
        bandLowEur: pctToEur(measured.sold.lowPct),
        bandHighEur: pctToEur(measured.sold.highPct),
        floorLowEur: pctToEur(measured.floor.lowPct),
        floorHighEur: pctToEur(measured.floor.highPct),
        tradePctSold: measured.sold.pct,
        tradePctFloor: measured.floor.pct,
        tradeBasis: measured.sold.basis,
        tradeObservations: measured.sold.n,
        trimApplied: trimAdj ? trimAdj.trim : undefined,
        trimRatio: trimAdj ? trimAdj.ratio : undefined,
        trimNeedsReview: trimAdj ? trimAdj.far : undefined,
        note:
          note + trimNote +
          ` Trade-in range from ${measured.sold.n} comparable trade sales at this mileage and age;` +
          ` about half of cars like this land inside it, and it is indicative until inspection.` +
          vNote,
      };
    }
    // FALLBACK, unchanged from v2: the MARKET picks the tier (measured
    // velocity); thin or derived evidence never earns the fast band,
    // whatever the market is doing.
    const tier: Tier = capToOrdinary && marketTier === "fast" ? "ordinary" : marketTier;
    const band = cfg.tiers[tier] ?? cfg.tiers.ordinary;
    return {
      estimateEur: est,
      comparables,
      segment,
      bandLowEur: Math.round(est * band[0]),
      bandHighEur: Math.round(est * band[1]),
      trimApplied: trimAdj ? trimAdj.trim : undefined,
      trimRatio: trimAdj ? trimAdj.ratio : undefined,
      trimNeedsReview: trimAdj ? trimAdj.far : undefined,
      note: note + trimNote + TIER_NOTE[tier] + vNote,
    };
  };

  // 1. exact segment
  const exact = seg(idx, mk, md, year);
  if (exact) {
    return finish(
      Math.round(exact.median),
      exact.n,
      exact.n < FAST_ADS,
      `Estimate from ${exact.n} similar Irish cars.`,
    );
  }

  // 2. both neighbouring years
  const below = seg(idx, mk, md, year - 1);
  const above = seg(idx, mk, md, year + 1);
  if (below && above) {
    const est = to50(Math.sqrt(below.median * above.median));
    return finish(
      est,
      Math.min(below.n, above.n),
      true,
      `No ${year} examples on the Irish market — estimated between the ` +
        `${year - 1}s (${below.n} ads) and ${year + 1}s (${above.n} ads).`,
    );
  }

  // 3. one neighbour + the model's measured year-step
  const step = avgStep(idx, mk, md);
  if (step) {
    if (above) {
      const est = to50(above.median * step);
      return finish(est, above.n, true,
        `No ${year} examples on the Irish market — stepped from ${above.n} ` +
          `Irish ${year + 1}s using this model's measured year-on-year ratio.`);
    }
    if (below) {
      const est = to50(below.median / step);
      return finish(est, below.n, true,
        `No ${year} examples on the Irish market — stepped from ${below.n} ` +
          `Irish ${year - 1}s using this model's measured year-on-year ratio.`);
    }
  }

  // 4. legacy exact medians (belt)
  const row = legacy[`${mk}|${md}|${year}`];
  if (row && row.ads >= MIN_ADS && row.med > 0) {
    return finish(Math.round(row.med), Math.round(row.ads), row.ads < FAST_ADS,
      `Estimate from ${Math.round(row.ads)} similar Irish cars.`);
  }

  return noEvidence;
}
