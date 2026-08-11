// Owner's brand composites. One place to add artwork: drop a 1672x941 JPEG
// into public/assets/images/ and add a line here. Nothing else changes.
//
// make  - the make slug this artwork depicts, matching the API's slugs
//         (audi, bmw, mercedes-benz, land-rover, polestar, skoda, volvo).
//         A visitor looking at one make sees that make's own artwork.
// alt   - use the heroAlt overlay positions. The original hero bakes its
//         headline in a different place, so it is the exception.
// strip - the artwork carries its own feature strip along the bottom, which
//         the gold stock count would print straight on top of. Verified by
//         cropping the count's zone out of each image: Polestar and Skoda
//         collided outright. Suppressed there; the search panel button still
//         shows the live number.

export type BrandArt = {
  /** mobile crop needs a deeper window: this artwork sets its strapline lower */
  mobileDeep?: boolean;
  /** mobile crop anchors RIGHT: this artwork sets its headline on the right side */
  mobileRight?: boolean;
  img: string;
  make: string | null;
  alt: boolean;
  strip: boolean;
  altText: string;
};

export const BRAND_ART: BrandArt[] = [
  {
    img: "/assets/images/hero-full.jpg",
    make: null,
    alt: false,
    strip: false,
    altText: "Importing a car should feel this simple",
  },
  {
    img: "/assets/images/hero-rot-port.jpg",
    make: "bmw",
    alt: true,
    strip: false,
    altText: "Imported and delivered to Ireland with every cost included",
  },
  {
    img: "/assets/images/hero-rot-irishprice.jpg",
    make: "land-rover",
    alt: true,
    strip: false,
    altText: "Browse the UK's market, buy at the Irish price",
  },
  {
    img: "/assets/images/hero-rot-nocosts.jpg",
    mobileRight: true,
    make: "audi",
    alt: true,
    strip: false,
    altText: "No hidden costs, no surprises - every vehicle priced for Ireland before you buy",
  },
  {
    img: "/assets/images/hero-rot-mercedes-eqc.jpg",
    mobileDeep: true,
    make: "mercedes-benz",
    alt: true,
    strip: false,
    altText: "The price you see is the price you pay",
  },
  {
    // Mercedes is already mapped above; this one appears in the rotation only.
    img: "/assets/images/hero-rot-mercedes-eclass.jpg",
    mobileDeep: true,
    make: null,
    alt: true,
    strip: false,
    altText: "Imported luxury should feel this effortless",
  },
  {
    img: "/assets/images/hero-rot-polestar.jpg",
    make: "polestar",
    alt: true,
    strip: true,
    altText: "Premium cars, smarter imports, better value",
  },
  {
    img: "/assets/images/hero-rot-skoda.jpg",
    mobileDeep: true,
    make: "skoda",
    alt: true,
    strip: true,
    altText: "Quality cars, transparent prices, zero hassle",
  },
  {
    img: "/assets/images/hero-rot-volvo.jpg",
    make: "volvo",
    alt: true,
    strip: true,
    altText: "Same car, better value, imported for less",
  },
];

/** Artwork depicting a given make, or null when we have none for it. */
export function artForMake(make?: string | null): BrandArt | null {
  if (!make) return null;
  const slug = make.trim().toLowerCase().replace(/\s+/g, "-");
  return BRAND_ART.find((a) => a.make === slug) ?? null;
}

/**
 * Hero artwork for a given day. A UTC-day index, not a per-request random
 * pick: the homepage is ISR-cached, so randomising would only make cached
 * copies disagree with each other. Each day shows a different car.
 */
export function heroForDay(now: number = Date.now()): BrandArt {
  return BRAND_ART[Math.floor(now / 86400000) % BRAND_ART.length];
}

/** Banner for pages wanting brand artwork with no make in play. */
export const DEFAULT_BANNER: BrandArt =
  BRAND_ART.find((a) => a.make === "land-rover") ?? BRAND_ART[0];
