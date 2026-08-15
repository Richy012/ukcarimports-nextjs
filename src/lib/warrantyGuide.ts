// The 33-brand manufacturer warranty guide (published 2026-08-15) carries an
// anchor per brand, so a car page or a make landing can drop the reader on its
// own make instead of the top of a 67KB article.
//
// Keys are lowercase make names as they arrive from the API (make_name), the
// value is the anchor id in the article. Any make not listed links to the top.
export const WARRANTY_GUIDE_SLUG = "uk-car-warranty-ireland-does-it-transfer";

const ANCHORS: Record<string, string> = {
  audi: "warranty-audi",
  bmw: "warranty-bmw",
  byd: "warranty-byd",
  citroen: "warranty-citroen",
  cupra: "warranty-cupra",
  dacia: "warranty-dacia",
  fiat: "warranty-fiat",
  ford: "warranty-ford",
  honda: "warranty-honda",
  hyundai: "warranty-hyundai",
  jaecoo: "warranty-jaecoo",
  jaguar: "warranty-jaguar",
  jeep: "warranty-jeep",
  kia: "warranty-kia",
  "land rover": "warranty-land-rover",
  "land-rover": "warranty-land-rover",
  lexus: "warranty-lexus",
  mazda: "warranty-mazda",
  "mercedes-benz": "warranty-mercedes-benz",
  "mercedes benz": "warranty-mercedes-benz",
  mercedes: "warranty-mercedes-benz",
  mg: "warranty-mg",
  mini: "warranty-mini",
  nissan: "warranty-nissan",
  omoda: "warranty-omoda",
  opel: "warranty-vauxhall",
  peugeot: "warranty-peugeot",
  polestar: "warranty-polestar",
  renault: "warranty-renault",
  seat: "warranty-seat",
  skoda: "warranty-skoda",
  suzuki: "warranty-suzuki",
  tesla: "warranty-tesla",
  toyota: "warranty-toyota",
  vauxhall: "warranty-vauxhall",
  volkswagen: "warranty-volkswagen",
  vw: "warranty-volkswagen",
  volvo: "warranty-volvo",
};

// One line per brand, in that brand own published terms, so the link says
// something before it is clicked. Absent = generic wording.
const HOOKS: Record<string, string> = {
  "warranty-audi": "the 2-year European warranty travels; year three is a UK arrangement",
  "warranty-bmw": "3 years unlimited mileage, and year three is valid in the Republic",
  "warranty-byd": "6 years or 150,000 km, pan-European, and it transfers",
  "warranty-citroen": "Citroen call the 3-year cover valid across the whole EU",
  "warranty-cupra": "up to 5 years or 90,000 miles, repairable anywhere in Europe",
  "warranty-dacia": "3-year European cover; the UK Zen extension stays behind",
  "warranty-fiat": "3-year cover Fiat call valid across the whole EU",
  "warranty-ford": "3-year cover across a 44-country area that names Ireland",
  "warranty-honda": "3 years and 90,000 miles; the UK 8-year scheme excludes Ireland",
  "warranty-hyundai": "5 years unlimited mileage, Europe defined to include Ireland",
  "warranty-jaecoo": "7 years or 100,000 miles, transferable, no export exclusion",
  "warranty-jaguar": "one warranty region across Europe; only Approved Used is UK-only",
  "warranty-jeep": "3-year cover on the same EU-wide Stellantis wording",
  "warranty-kia": "a 7-year warranty that passes to each new owner",
  "warranty-land-rover": "Europe and the UK are one warranty region",
  "warranty-lexus": "3-year cover repairable in the UK or any EU country",
  "warranty-mazda": "unresolved - confirm against the VIN before you commit",
  "warranty-mercedes-benz": "2-year cover across the EU, the EEA and Switzerland",
  "warranty-mg": "7 years or 80,000 miles, no territorial clause, transferable",
  "warranty-mini": "the same 3-year unlimited-mileage terms as BMW",
  "warranty-nissan": "Ireland is named in Nissan own warranty country list",
  "warranty-omoda": "7 years or 100,000 miles, transferable, no export exclusion",
  "warranty-peugeot": "Peugeot call the 3-year cover valid across the whole of the EU",
  "warranty-polestar": "3-year cover written internationally, not for one market",
  "warranty-renault": "3-year cover with Ireland named in the country list",
  "warranty-seat": "the 2-year European warranty travels; year three is UK-administered",
  "warranty-skoda": "the 2-year European warranty travels; year three is a UK arrangement",
  "warranty-suzuki": "3 years and 60,000 miles; the 10-year scheme needs a UK resident",
  "warranty-tesla": "4-year cover across a region that includes the UK and Ireland",
  "warranty-toyota": "eligible for the 10-year Relax extension at an Irish dealer",
  "warranty-vauxhall": "3-year cover with an explicit EU geographic clause",
  "warranty-volkswagen": "the 2-year European warranty travels; year three is a UK arrangement",
  "warranty-volvo": "3-year cover that runs on regardless of re-registration",
};

export function warrantyGuideFor(makeName?: string | null): {
  href: string;
  hook: string | null;
} {
  const key = (makeName ?? "").trim().toLowerCase();
  const anchor = ANCHORS[key];
  return {
    href: `/blog/${WARRANTY_GUIDE_SLUG}${anchor ? "#" + anchor : ""}`,
    hook: anchor ? (HOOKS[anchor] ?? null) : null,
  };
}
