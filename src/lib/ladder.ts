// The Bestseller ladder (owner-approved 2026-09-03, signed off on the visual).
// ONE brand, Bestseller, for every car whose SOUND saving vs the Irish market
// is €750 or more; six colour rungs and the exact euro figure do the ranking.
// The badge job writes tier 'bestseller' for 750-2499 as well as 2500-4999;
// the rung is derived here, from the figure, so the tier enum never changed.
// Plain module (no "use client") so both server and client components use it.
export type Rung = 1 | 2 | 3 | 4 | 5 | 6;

export function ladderRung(tier: string | null | undefined, savingEur: number): Rung | null {
  if (!tier || tier === "trending") return null;
  if (tier === "number_one" || savingEur >= 5000) return 6;
  if (savingEur >= 2500) return 5;
  if (savingEur >= 2000) return 4;
  if (savingEur >= 1500) return 3;
  if (savingEur >= 1000) return 2;
  if (savingEur >= 750) return 1;
  return null;
}

export const RUNG_LABEL: Record<Rung, string> = {
  1: "Bestseller \u00b7 \u20ac750+",
  2: "Bestseller \u00b7 \u20ac1,000+",
  3: "Bestseller \u00b7 \u20ac1,500+",
  4: "Bestseller \u00b7 \u20ac2,000+",
  5: "Bestseller",
  6: "#1 Bestseller",
};

// Tile badge classes (used-cars/page.module.css). 5 and 6 are the classes the
// site already had; 1-4 are the four greens beneath them.
export const RUNG_CLASS: Record<Rung, string> = {
  1: "badgeR1",
  2: "badgeR2",
  3: "badgeR3",
  4: "badgeR4",
  5: "badgeBestseller",
  6: "badgeNumberOne",
};

export const RUNG_THRESHOLDS = [750, 1000, 1500, 2000, 2500, 5000] as const;

// The filter chips: cumulative ("€1,500+" includes everything above it).
export const RUNG_CHIPS = [
  { value: "750", label: "\u20ac750+", cls: "rungC1" },
  { value: "1000", label: "\u20ac1,000+", cls: "rungC2" },
  { value: "1500", label: "\u20ac1,500+", cls: "rungC3" },
  { value: "2000", label: "\u20ac2,000+", cls: "rungC4" },
  { value: "2500", label: "\u20ac2,500+", cls: "rungC5" },
  { value: "5000", label: "\u20ac5,000+", cls: "rungC6" },
] as const;

export function evidenceLine(irishAds: number | null | undefined): string {
  const n = Number(irishAds ?? 0);
  return n >= 10 ? `vs ${n.toLocaleString("en-IE")} Irish listings` : "vs the same car in Ireland";
}
