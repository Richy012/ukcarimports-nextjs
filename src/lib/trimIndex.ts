/**
 * Trim adjustment to the retail figure. INTERNAL DATA, PUBLIC OUTPUT IS A RANGE.
 *
 * The retail estimate is the median of a make+model+year segment, so every trim
 * in it is quoted the same. Measured on our own data that is right for most
 * cars and badly wrong for a minority: knowing the trim is worth EUR 19 on an
 * ordinary car, EUR 753 on one sitting 8-15% from its segment median, and
 * EUR 2,235 beyond 15%. Thirteen per cent of cars are in those last two groups
 * — and averaged together the whole effect looks like EUR 176, which is why
 * three earlier measurements said "not worth building" and were all answering
 * the wrong question.
 *
 * The owner spotted it before the data did: "an AMG LINE vs an AMG LINE PREMIUM
 * PLUS for the same make and model, same year, same mileage can be thousands in
 * the difference." It can, and this is that difference.
 *
 * WHAT MAKES IT WORK: Carzone's version field is dealer free-text, 20,515
 * near-unique strings, useless for grouping. Our OWN catalogue already carries
 * a canonical trim extracted from 134,981 UK cars, and used as a dictionary it
 * collapses those into 440 real trims — match rate 16% -> 44%. That was his
 * suggestion too.
 *
 * Every ratio is SHRUNK toward 1 by n/(n+4), so a three-car trim moves the
 * price a little and a twenty-car trim moves it a lot. Half these groups rest
 * on three listings and an unshrunk x1.45 is as likely to be one optimistic
 * dealer as a real premium.
 */

import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "trim_index.json");
const CACHE_MS = 10 * 60 * 1000;

interface TrimRow { ratio: number; raw_ratio: number; n: number; far: boolean }
interface TrimIndex {
  built: string;
  far_threshold_pct: number;
  trims: Record<string, TrimRow>;
  offered: Record<string, string[]>;
}

let cache: { at: number; idx: TrimIndex | null } | null = null;

async function load(): Promise<TrimIndex | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.idx;
  let idx: TrimIndex | null = null;
  try {
    idx = JSON.parse(await fs.readFile(FILE, "utf8")) as TrimIndex;
  } catch {
    idx = null; // no artifact -> no adjustment, which is the current behaviour
  }
  cache = { at: Date.now(), idx };
  return idx;
}

const key = (mk: string, md: string) =>
  `${mk.trim().toLowerCase()}|${md.trim().toLowerCase()}`;

/** The trims we can actually price for this make/model — the dropdown. */
export async function trimsFor(make: string, model: string): Promise<string[]> {
  const idx = await load();
  if (!idx) return [];
  return idx.offered[key(make, model)] ?? [];
}

export interface TrimAdjustment {
  ratio: number;      // multiply the segment retail median by this
  n: number;          // listings behind it
  far: boolean;       // 8%+ from the segment median: worth real money, and
                      // the signal that a person should see this quote
  trim: string;
}

/**
 * Null when we cannot price this trim — no artifact, no trim given, or too
 * few comparable listings. Null means "quote off the segment median exactly as
 * before", never a guessed adjustment.
 */
export async function trimAdjustment(
  make: string,
  model: string,
  year: number | null,
  trim: string | null,
): Promise<TrimAdjustment | null> {
  if (!trim || year == null) return null;
  const idx = await load();
  if (!idx) return null;
  const t = trim.trim().toUpperCase();
  const row = idx.trims[`${key(make, model)}|${year}|${t}`];
  if (!row || !row.ratio || row.ratio <= 0) return null;
  return { ratio: row.ratio, n: row.n, far: row.far, trim: t };
}
