/**
 * Irish-registered cars advertised on ukcarimports.ie — the Above Board Cars
 * listings. STAGING.
 *
 * Owner, 6 Sep: "make sure the Above Board Cars functionality all works — that
 * their car is advertised and the home page has a dedicated section to Irish
 * registered cars." Until now a Above Board Cars seller was only given a page to
 * send to buyers of their own DoneDeal ad; nothing of theirs appeared here.
 *
 * A car appears ONLY when:
 *   - the seller chose the private route, and
 *   - staff have approved the deal to "live" on the deal-builder admin (the
 *     same approval that exists today — nothing goes public unreviewed)
 *
 * What is public: the car, its mileage, the photos the seller took, the
 * routing area of their eircode (first three characters, never the full
 * code), the condition answers, and the asking price the seller gave us
 * (targetEur). Never the seller's name, email, phone or reg. Enquiries go
 * to us, and we pass them on — that is the protection Above Board Cars sells.
 */

import { readdir } from "fs/promises";
import path from "path";
import { readOnly, type Deal } from "./dealstore";

const PHOTO_ROOT = `${process.cwd()}/uploads/tradein`;
const LIVE_STATUSES = new Set(["live", "accepted", "matched", "completed"]);
// the order a buyer wants to see them in
const PHOTO_ORDER = [
  "out_front_pass", "out_side_driver", "out_front", "out_rear_driver", "out_side_pass",
  "out_rear", "out_front_driver", "out_rear_pass", "in_dash", "in_front_seats",
  "in_rear_seats", "in_screen", "in_console", "in_boot", "out_roof",
  "out_front_pass_close", "wheel_fd", "wheel_fp", "wheel_rd", "wheel_rp",
  "in_seat_wear", "doc_keys", "doc_service", "doc_discs",
];

export interface IrishListing {
  id: string;
  title: string;          // "2018 Volkswagen Golf"
  year: number | null;
  make: string;
  model: string;
  mileage: number | null;
  mileageUnit: string;
  priceEur: number | null;  // the seller's asking price, or null = "price on application"
  area: string;             // eircode routing area, e.g. "D18"
  nct: string;
  serviceHistory: string;
  damage: string;
  trim?: string;
  photos: string[];         // public URLs, buyer order
  listedAt: string;
}

function area(eircode?: string | null): string {
  const e = (eircode || "").replace(/\s+/g, "").toUpperCase();
  return e.length >= 3 ? e.slice(0, 3) : "";
}

async function photoUrls(draftId: string): Promise<string[]> {
  let files: string[] = [];
  try {
    files = (await readdir(path.join(PHOTO_ROOT, draftId))).filter((f) => f.endsWith(".jpg"));
  } catch {
    return [];
  }
  const slots = files.map((f) => f.replace(/\.jpg$/, ""))
    .filter((s) => s !== "vlc_cert" && s !== "owner_id");
  slots.sort((a, b) => {
    const ia = PHOTO_ORDER.indexOf(a), ib = PHOTO_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return slots.map((s) => `/api/tradein-photo?draftId=${encodeURIComponent(draftId)}&slot=${encodeURIComponent(s)}`);
}

function toListing(d: Deal, photos: string[]): IrishListing {
  const t = d.tradeIn;
  const v = (d.valuation || {}) as { trimApplied?: string };
  return {
    id: d.id,
    title: `${t.year ? t.year + " " : ""}${t.make} ${t.model}`.trim(),
    year: t.year ?? null,
    make: t.make,
    model: t.model,
    mileage: t.mileage ?? null,
    mileageUnit: t.mileageUnit || "km",
    priceEur: d.targetEur ?? null,
    area: area(d.buyer?.eircode),
    nct: t.nct || "",
    serviceHistory: t.serviceHistory || "",
    damage: t.damage || "",
    trim: v.trimApplied,
    photos,
    listedAt: d.createdAt,
  };
}

/** Every live Above Board Cars car, newest first. */
export async function irishListings(): Promise<IrishListing[]> {
  const deals = await readOnly((db) =>
    db.deals.filter((d) => d.tradeIn?.route === "privateproof" && LIVE_STATUSES.has(d.status)),
  );
  const out: IrishListing[] = [];
  for (const d of deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    out.push(toListing(d, await photoUrls(d.draftId)));
  }
  return out;
}

export async function irishListing(id: string): Promise<IrishListing | null> {
  const d = await readOnly((db) =>
    db.deals.find((x) => x.id === id && x.tradeIn?.route === "privateproof" && LIVE_STATUSES.has(x.status)) ?? null,
  );
  if (!d) return null;
  return toListing(d, await photoUrls(d.draftId));
}

export async function irishCount(): Promise<number> {
  return readOnly((db) =>
    db.deals.filter((d) => d.tradeIn?.route === "privateproof" && LIVE_STATUSES.has(d.status)).length,
  );
}
