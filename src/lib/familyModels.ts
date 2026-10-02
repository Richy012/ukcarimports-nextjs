import { normaliseMake, normaliseModel } from "./carNames";

/**
 * Model names the national vehicle file uses for a whole FAMILY of cars.
 *
 * 2 Oct 2026: motortax.ie answered "LANDROVER / RANGE ROVER" for a 2020
 * Range Rover Evoque P300e (her registration certificate, line D.2, reads
 * "RANGE ROVER P300E EVOQE RDYN S"). The valuation then priced it as a
 * full-size Range Rover - 25 Irish ads, ~€47,500 - and showed a trade range
 * about €15,000 above what the same engine gives for an Evoque. The same
 * "RANGE ROVER" came back for two other regs. A Range Rover Sport, by
 * contrast, came back as "RANGE ROVER SPORT", so the file is not consistent.
 *
 * When the file gives one of these names, the trade-in page asks the customer
 * which car it is before any figure is shown, and /api/deal will not price an
 * unanswered one. A name not listed here is priced as before.
 *
 * Discovery is here on the same reasoning (Discovery Sport is a different car
 * at a different price); no "DISCOVERY" answer has been seen yet.
 */
const FAMILIES: { make: string; model: string; choices: { name: string; from: number }[] }[] = [
  {
    make: "land rover",
    model: "range rover",
    choices: [
      { name: "Range Rover", from: 1970 },
      { name: "Range Rover Sport", from: 2005 },
      { name: "Range Rover Evoque", from: 2011 },
      { name: "Range Rover Velar", from: 2017 },
    ],
  },
  {
    make: "land rover",
    model: "discovery",
    choices: [
      { name: "Discovery", from: 1989 },
      { name: "Discovery Sport", from: 2014 },
    ],
  },
];

/**
 * The cars a family name can mean in that year, or null when the name is
 * already specific (or only one family member existed that year).
 */
export function familyChoices(make: string, model: string, year: number | null): string[] | null {
  const mk = normaliseMake(make);
  const md = normaliseModel(make, model);
  const fam = FAMILIES.find((f) => f.make === mk && f.model === md);
  if (!fam) return null;
  const choices = fam.choices.filter((c) => year == null || year >= c.from).map((c) => c.name);
  return choices.length > 1 ? choices : null;
}
