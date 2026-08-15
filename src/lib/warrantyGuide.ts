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

// ---------------------------------------------------------------------------
// Owner caught this live 2026-08-15: a 2019 BMW was told "3 years unlimited
// mileage". That warranty ran out in March 2022. A brand's headline term is
// only worth saying on a car young enough to still have some of it left, so
// every line below is now gated on the car's own first-registration date.
//
// BASE_YEARS is the manufacturer warranty that travels to Ireland (the
// European part only -- the UK-only top-up year is deliberately NOT counted,
// since it is exactly what an import loses). BATTERY_YEARS is the high-voltage
// battery term, which runs far longer and is what actually matters on an
// older EV.
const BASE_YEARS: Record<string, number> = {
  "warranty-audi": 2, "warranty-bmw": 3, "warranty-byd": 6, "warranty-citroen": 3,
  "warranty-cupra": 5, "warranty-dacia": 3, "warranty-fiat": 3, "warranty-ford": 3,
  "warranty-honda": 3, "warranty-hyundai": 5, "warranty-jaecoo": 7, "warranty-jaguar": 3,
  "warranty-jeep": 3, "warranty-kia": 7, "warranty-land-rover": 3, "warranty-lexus": 3,
  "warranty-mazda": 3, "warranty-mercedes-benz": 2, "warranty-mg": 7, "warranty-mini": 3,
  "warranty-nissan": 3, "warranty-omoda": 7, "warranty-peugeot": 3, "warranty-polestar": 3,
  "warranty-renault": 3, "warranty-seat": 2, "warranty-skoda": 2, "warranty-suzuki": 3,
  "warranty-tesla": 4, "warranty-toyota": 3, "warranty-vauxhall": 3,
  "warranty-volkswagen": 2, "warranty-volvo": 3,
};

// Toyota Relax and Lexus Battery Care are re-activated at each qualifying
// service, so they are not a fixed clock from registration -- they get their
// own wording rather than an expiry date.
const SERVICE_RENEWED: Record<string, string> = {
  "warranty-toyota": "Toyota Relax can be re-activated at each qualifying service by an Irish dealer, up to 10 years",
  "warranty-lexus": "Lexus renews the hybrid battery cover at each qualifying service, up to 10 years",
};

const BATTERY_YEARS: Record<string, number> = {
  "warranty-audi": 8, "warranty-bmw": 8, "warranty-byd": 8, "warranty-citroen": 8,
  "warranty-cupra": 8, "warranty-dacia": 8, "warranty-fiat": 8, "warranty-ford": 8,
  "warranty-honda": 8, "warranty-hyundai": 8, "warranty-jaecoo": 8, "warranty-jaguar": 8,
  "warranty-jeep": 8, "warranty-kia": 7, "warranty-land-rover": 8, "warranty-lexus": 10,
  "warranty-mazda": 8, "warranty-mercedes-benz": 8, "warranty-mg": 8, "warranty-mini": 8,
  "warranty-nissan": 8, "warranty-omoda": 8, "warranty-peugeot": 8, "warranty-polestar": 8,
  "warranty-renault": 8, "warranty-seat": 8, "warranty-skoda": 8,
  "warranty-tesla": 8, "warranty-toyota": 8, "warranty-vauxhall": 8,
  "warranty-volkswagen": 8, "warranty-volvo": 8,
};

function parseReg(reg?: string | null): Date | null {
  const t = (reg ?? "").trim();
  // The API returns DD/MM/YYYY; fall back to a bare year if that is all we have.
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = t.match(/(\d{4})/);
  if (m) return new Date(Number(m[1]), 0, 1);
  return null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];

export function titleCaseMake(makeName?: string | null): string {
  const t = (makeName ?? "").trim();
  if (!t) return "";
  const upper: Record<string, string> = {
    bmw: "BMW", mg: "MG", byd: "BYD", ds: "DS", seat: "SEAT", mini: "MINI",
    vw: "VW", kia: "Kia",
  };
  if (upper[t.toLowerCase()]) return upper[t.toLowerCase()];
  return t
    .split(/([ -])/)
    .map((w) => (w === " " || w === "-" ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

/**
 * What can honestly be said about THIS car's warranty, given its age.
 * Returns null for `hook` rather than a claim that has already expired.
 */
export function warrantyStatusFor(
  makeName?: string | null,
  registrationDate?: string | null,
  fuelTypeName?: string | null,
): { href: string; hook: string | null; make: string } {
  const base = warrantyGuideFor(makeName);
  const make = titleCaseMake(makeName);
  const anchor = base.href.includes("#") ? base.href.split("#")[1] : "";
  const reg = parseReg(registrationDate);

  // No anchor (make not in the guide) or no date: link only, claim nothing.
  if (!anchor || !reg) return { href: base.href, hook: null, make };

  const now = new Date();
  const ageYears = (now.getTime() - reg.getTime()) / (365.25 * 24 * 3600 * 1000);

  const baseYears = BASE_YEARS[anchor];
  if (baseYears && ageYears < baseYears) {
    const end = new Date(reg.getTime());
    end.setFullYear(end.getFullYear() + baseYears);
    return {
      href: base.href,
      hook: `${base.hook ?? "the manufacturer warranty travels to Ireland"} — on this car that runs to about ${MONTHS[end.getMonth()]} ${end.getFullYear()}`,
      make,
    };
  }

  const fuel = (fuelTypeName ?? "").toLowerCase();
  const electrified = fuel.includes("electric") || fuel.includes("hybrid");
  const battYears = BATTERY_YEARS[anchor];
  if (electrified && battYears && ageYears < battYears) {
    const end = new Date(reg.getTime());
    end.setFullYear(end.getFullYear() + battYears);
    return {
      href: base.href,
      hook: `the manufacturer warranty has run out on a car this age, but the high-voltage battery is covered to about ${MONTHS[end.getMonth()]} ${end.getFullYear()} — conditions apply`,
      make,
    };
  }

  if (SERVICE_RENEWED[anchor]) {
    return { href: base.href, hook: SERVICE_RENEWED[anchor], make };
  }

  // Out of every published term: say nothing about cover, keep the link.
  return { href: base.href, hook: null, make };
}
