/**
 * Website review 3 Oct 2026 #59: the median printed beside a Bestseller saving
 * must make the arithmetic on the page add up to the euro.
 *
 * The badge saving is round(median - our price), worked out on the unrounded
 * figures (RefreshBestsellerBadges). A median is often a half-euro (the average
 * of the two middle asking prices) and our price carries cents, so printing
 * round(median) - round(price) lands EUR 1 away from the badge on a share of
 * cars (754 of 9,493 mileage-median badges, measured 3 Oct 2026).
 *
 * EUR X and EUR X+1 are both honest roundings of a median of EUR X.50, so this
 * picks the one that makes "median - our price = saving" exact. Any bigger gap
 * (our price moved since the 15-minute badge refresh) keeps ordinary rounding.
 * Display only: no figure, threshold or part of the frozen method changes.
 *
 * tolerance: 0.5 when `median` is the unrounded figure (the maths page), 1 when
 * it has already been rounded to whole euros (the car page reads the badge row).
 */
export function shownMedian(
  median: number,
  savingEur: number | null | undefined,
  ourPrice: number | null | undefined,
  tolerance = 0.5,
): number {
  const m = Number(median);
  const s = Number(savingEur);
  const p = Number(ourPrice);
  if (!Number.isFinite(s) || !Number.isFinite(p) || p <= 0) return Math.round(m);
  const candidate = Math.round(s) + Math.round(p);
  return Math.abs(candidate - m) <= tolerance ? candidate : Math.round(m);
}
