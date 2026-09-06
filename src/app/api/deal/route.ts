import { NextRequest, NextResponse } from "next/server";
import {
  withDb,
  readOnly,
  newId,
  newToken,
  nowIso,
  dealForBuyer,
  type Deal,
  type TradeInDetails,
  type WantedCar,
} from "../../../lib/dealstore";
import { notify, lines, eur } from "../../../lib/dealnotify";
import { valueTradeIn } from "../../../lib/valuation";
import { toKm } from "../../../lib/tradeinModel";
import { readdir } from "fs/promises";
import path from "path";

// Owner, 6 Sep: "How can I value the car without photos and service history
// etc. I am not going to offer anything unless all those questions are
// completed." So the guided photo set and every applicable answer are
// required to SUBMIT. The VRC and photo-ID uploads stay at approval.
const REQUIRED_SHOTS = ["out_front","out_front_pass","out_roof","out_front_pass_close","out_side_pass",
  "out_rear_pass","out_rear","out_rear_driver","out_side_driver","out_front_driver",
  "wheel_fd","wheel_fp","wheel_rd","wheel_rp",
  "in_dash","in_front_seats","in_rear_seats","in_boot","in_screen","in_console","in_seat_wear",
  "doc_keys","doc_service","doc_discs"];
const PHOTO_ROOT = `${process.cwd()}/uploads/tradein`;
// every disclosure, with the condition under which a child question applies —
// mirrors DISCLOSURES in trade-ins/page.tsx; keep the two in step
const REQUIRED_DISCLOSURES: [string, ((d: Record<string, string>) => boolean) | null][] = [
  ["keys", null], ["cold_noise", null], ["cold_noise_clears", (d) => d.cold_noise === "yes"],
  ["clutch", null], ["gearbox", null], ["warning_lights", null],
  ["warning_diagnosed", (d) => d.warning_lights === "yes"],
  ["aircon", null], ["electronics", null],
  ["windscreen", null], ["interior_damage", null], ["body_repair", null], ["odours", null],
  ["retail_ready", null], ["serviced", (d) => d.retail_ready === "yes"], ["valeted", (d) => d.retail_ready === "yes"],
];
import { priceRoutes } from "../../../lib/routePricing";
import { makeOffer } from "../../../lib/conditionOffer";
import type { Suggestion, RangesShown } from "../../../lib/dealstore";

// POST — the buyer finishes the trade-in flow: creates the deal as
// "submitted" (staff approve before any dealer sees it) and hands back the
// status-page token. GET ?token= — the buyer's own view via dealForBuyer,
// the ONLY serializer allowed to speak to a buyer (hard rule 1).

export const runtime = "nodejs";

const SAFE_DRAFT = /^[A-Za-z0-9_-]{6,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  if (!token) return bad("token is required");

  const deal = await readOnly((db) => {
    const d = db.deals.find((x) => x.buyerToken === token);
    return d ? dealForBuyer(d, db) : null;
  });
  if (!deal) return bad("not found", 404);
  return NextResponse.json({ ok: true, deal });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = obj(await req.json());
  } catch {
    return bad("invalid JSON body");
  }

  const draftId = str(body.draftId, 64);
  if (!SAFE_DRAFT.test(draftId)) return bad("bad draft id");

  const t = obj(body.tradeIn);
  const mileage = num(t.mileage);
  const yearRaw = num(t.year);
  const tradeIn: TradeInDetails = {
    reg: str(t.reg, 20).toUpperCase(),
    mileage: mileage != null && mileage >= 0 ? Math.round(mileage) : null,
    mileageUnit: t.mileageUnit === "miles" ? "miles" : "km",
    make: str(t.make, 60),
    model: str(t.model, 60),
    year:
      yearRaw != null && Number.isInteger(yearRaw) && yearRaw >= 1980 && yearRaw <= 2035
        ? yearRaw
        : null,
    lookupSource: t.lookupSource === "nvf" ? "nvf" : "manual",
    financeOutstanding:
      t.financeOutstanding === "yes" ? "yes" : t.financeOutstanding === "no" ? "no" : "",
    financeNeed:
      t.financeNeed === "none" ? "none" : t.financeNeed === "bank" ? "bank"
        : t.financeNeed === "finance_house" ? "finance_house" : "",
    settlementEur: Math.max(0, Math.round(num(t.settlementEur) ?? 0)),
    nct: str(t.nct, 40),
    serviceHistory: str(t.serviceHistory, 40),
    damage: str(t.damage, 60),
    damageNote: str(t.damageNote, 1000),
    adLink: str(t.adLink, 500),
    vrcHolder: (["me", "spouse", "other"] as const).find((x) => x === t.vrcHolder) ?? "",
    vrcHolderName: str(t.vrcHolderName, 120),
    ownerConsent: t.ownerConsent === true,
    // Which pathway the customer picked at step 1 (owner's spec, 31 Aug). This
    // is what decides how the car is processed, so it has to survive the
    // submission - it was being sent by the page and silently dropped here.
    route: t.route === "privateproof" ? "privateproof" : t.route === "tradein" ? "tradein" : "",
    // The third-party-garage opt-out shown under both choices. Default false =
    // permission given; true = the customer has withheld it.
    thirdPartyOptOut: t.thirdPartyOptOut === true,
    // Full disclosure set (2026-08-31). Sanitised to plain yes/no strings and
    // capped free text - this record is what answers a later misdescription claim.
    // NOTE: these arrive nested in body.tradeIn, which is where the page has
    // always put them. Reading them off the body root (as this did until 31 Aug)
    // silently produced an empty record on every single submission.
    disclosures: (() => {
      const out: Record<string, string> = {};
      const src = t.disclosures;
      if (src && typeof src === "object") {
        for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
          if (/^[a-z_]{2,32}$/.test(k) && (v === "yes" || v === "no")) out[k] = v;
        }
      }
      return out;
    })(),
    disclosureNotes: (() => {
      const out: Record<string, string> = {};
      const src = t.disclosureNotes;
      if (src && typeof src === "object") {
        for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
          if (/^[a-z_]{2,32}$/.test(k) && typeof v === "string" && v.trim()) out[k] = str(v, 1000);
        }
      }
      return out;
    })(),
  };
  if (!tradeIn.reg && !(tradeIn.make && tradeIn.model)) {
    return bad("tell us the reg, or the make and model");
  }
  // Owner, 6 Sep: mileage is compulsory. Without it the measured model cannot
  // run and the record silently falls back to the old assumed tiers - his own
  // test submission did exactly that. Enforced here so no client path can
  // slip round the step-1 check.
  if (tradeIn.mileage == null || tradeIn.mileage <= 0) {
    return bad("tell us the mileage");
  }
  if (!tradeIn.financeNeed) return bad("tell us whether you will need finance for the import");
  // a finance-house deal cannot go the private route: it goes to a dealer
  if (tradeIn.financeNeed === "finance_house") tradeIn.route = "tradein";
  // the four paperwork/condition answers
  if (!tradeIn.financeOutstanding) return bad("tell us whether there is finance outstanding");
  if (!tradeIn.nct) return bad("tell us when the NCT is due");
  if (!tradeIn.serviceHistory) return bad("tell us about the service history");
  if (!tradeIn.damage) return bad("tell us about any bodywork damage");
  // every applicable disclosure
  {
    const d = tradeIn.disclosures || {};
    const missing = REQUIRED_DISCLOSURES.filter(([id, when]) => (!when || when(d)) && !d[id]).map(([id]) => id);
    if (missing.length) return bad(`answer every condition question (${missing.length} left)`);
  }
  // the full guided photo set
  {
    let have: string[] = [];
    try { have = (await readdir(path.join(PHOTO_ROOT, draftId))).map((f) => f.replace(/\.jpg$/, "")); } catch {}
    const missing = REQUIRED_SHOTS.filter((s) => !have.includes(s));
    if (missing.length) return bad(`take every guided photo (${missing.length} of ${REQUIRED_SHOTS.length} still to do)`);
  }
  if (
    (tradeIn.vrcHolder === "spouse" || tradeIn.vrcHolder === "other") &&
    (!tradeIn.vrcHolderName || !tradeIn.ownerConsent)
  ) {
    return bad("give the registered owner's name and confirm they agree to the sale");
  }
  if (tradeIn.vrcHolder === "") {
    return bad("tell us whose name is on the VRC");
  }
  const declarationName = str(body.declarationName, 120);
  if (declarationName.replace(/\s+/g, " ").trim().length < 5 || !/\s/.test(declarationName.trim())) {
    return bad("sign the declaration by typing your full name");
  }
  const regLabel = tradeIn.reg || `${tradeIn.make} ${tradeIn.model}`.trim();
  const declaration = {
    kind: (tradeIn.vrcHolder === "me" ? "owner" : "authorised") as "owner" | "authorised",
    text:
      tradeIn.vrcHolder === "me"
        ? `I declare that I am the registered owner of this vehicle (${regLabel}) and that I am entitled to sell it.`
        : `I declare that ${tradeIn.vrcHolderName}, the registered owner of this vehicle (${regLabel}), has authorised me to offer it for sale, and that they will sign the change of ownership at collection.`,
    signedName: declarationName,
    signedAt: new Date().toISOString(),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
  };

  // The import car is OPTIONAL from 31 Aug. A Above Board Cars seller may not be
  // buying anything from us at all, and until today the page sent a placeholder
  // Kia Sportage on every submission - so a seller who never picked a car
  // appeared in the admin wanting one. When there is no real car we record a
  // neutral placeholder rather than a lie; every consumer still gets an object
  // with a title and a number, so nothing downstream has to handle null.
  const w = obj(body.wanted);
  const landed = num(w.landedEur);
  const wantedTitle = str(w.title, 120);
  const wanted: WantedCar =
    wantedTitle && landed != null && landed > 0
      ? {
          carId: str(w.carId, 40) || null,
          title: wantedTitle,
          detail: str(w.detail, 200),
          landedEur: Math.round(landed),
        }
      : { carId: null, title: "No import selected yet", detail: "", landedEur: 0 };

  const b = obj(body.buyer);
  const buyer = {
    email: str(b.email, 120).toLowerCase(),
    phone: str(b.phone, 40),
    name: str(b.name, 120),
    eircode: str(b.eircode, 10).toUpperCase(),
  };
  if (!EMAIL_RE.test(buyer.email)) return bad("a valid email address is required");
  if (!buyer.name) return bad("your name is required");

  const target = num(body.targetEur);
  const targetEur = target != null && target >= 0 ? Math.round(target) : null;

  const km = toKm(tradeIn.mileage, tradeIn.mileageUnit);
  const trimSent = str(t.trim, 40).toUpperCase() || null;
  const valuation = await valueTradeIn(tradeIn.make, tradeIn.model, tradeIn.year, km, trimSent);

  // NO OFFER IS MADE HERE (owner, 5 Sep: he prices the car himself after
  // seeing the photos and answers). What is kept: the two ranges the customer
  // was shown, so the status page can repeat them, and — for the trade route
  // only — the model's placing of the car inside its range as a STAFF-ONLY
  // starting point (lib/conditionOffer.ts). dealForBuyer never emits it.
  let suggestion: Suggestion | null = null;
  let ranges: RangesShown | null = null;
  const pricing = await priceRoutes(
    tradeIn.make, tradeIn.model, tradeIn.year, km, valuation.estimateEur, valuation.comparables,
  );
  if (pricing) {
    const tr = pricing.routes.find((x) => x.route === "trade");
    const pv = pricing.routes.find((x) => x.route === "private");
    ranges = {
      trade: tr ? { lowEur: tr.conditionLowEur, highEur: tr.conditionHighEur } : null,
      private: pv ? { lowEur: pv.conditionLowEur, highEur: pv.conditionHighEur } : null,
    };
    if (tradeIn.route === "tradein" && tr) {
      // anchor = the trade route's median (owner, 6 Sep); the range = the
      // condition range shown on the card, and the offer never leaves it
      const o = makeOffer(tr.conditionLowEur, tr.conditionHighEur, {
        serviceHistory: tradeIn.serviceHistory,
        damage: tradeIn.damage,
        nct: tradeIn.nct,
        disclosures: tradeIn.disclosures ?? {},
      }, tr.medianEur ?? tr.typicalEur);
      suggestion = { ...o, madeAt: nowIso() };
    }
  }

  const deal: Deal = {
    id: newId("deal"),
    status: "submitted",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    draftId,
    tradeIn,
    wanted,
    valuation,
    suggestion,
    offer: null,
    ranges,
    targetEur,
    wantFinanceQuotes: body.wantFinanceQuotes === true,
    buyer,
    buyerToken: newToken(),
    acceptedBidId: null,
    buyerDepositPaid: false,
    dealerDepositPaid: false,
    renegotiation: null,
    cancellations: [],
    declaration,
    marginNote: "",
    staffNote: "",
    history: [{ at: nowIso(), event: "submitted", detail: "buyer completed the trade-in flow" }],
  };

  await withDb((db) => {
    db.deals.push(deal);
  });

  const label =
    [tradeIn.year, tradeIn.make, tradeIn.model].filter(Boolean).join(" ") ||
    tradeIn.reg ||
    "trade-in";

  // The pathway leads the subject line: the owner processes these by route, and
  // for now the trade-in route is handled by him personally.
  const routeLabel =
    tradeIn.route === "privateproof"
      ? "Above Board Cars"
      : tradeIn.route === "tradein"
        ? "Trade-in"
        : "route not recorded";

  await notify({
    audience: "staff",
    to: null,
    dealId: deal.id,
    kind: "deal_submitted",
    subject: `New ${routeLabel} deal: ${label}${wanted.carId ? ` → ${wanted.title}` : ""}`,
    body: lines(
      `Deal ${deal.id} is awaiting approval.`,
      `Pathway chosen: ${routeLabel}.`,
      tradeIn.thirdPartyOptOut &&
        `OPTED OUT of third-party garages — do not offer this deal on.`,
      `Trade-in: ${label}${tradeIn.reg ? ` (${tradeIn.reg})` : ""}, ${
        tradeIn.mileage != null
          ? tradeIn.mileage.toLocaleString("en-IE") + " " + tradeIn.mileageUnit
          : "mileage not given"
      }.`,
      wanted.carId
        ? `Wanted: ${wanted.title} at ${eur(wanted.landedEur)} all-in.`
        : `Wanted: no import car selected.`,
      `Valuation: ${
        valuation.estimateEur != null
          ? `${eur(valuation.estimateEur)} retail median, trade band ${eur(valuation.bandLowEur)}–${eur(valuation.bandHighEur)} (${valuation.comparables} ads)`
          : valuation.note
      }.`,
      ranges?.trade
        ? `Ranges shown to the customer: trade ${eur(ranges.trade.lowEur)}–${eur(ranges.trade.highEur)}${ranges.private ? `, private ${eur(ranges.private.lowEur)}–${eur(ranges.private.highEur)}` : ""}.`
        : `No ranges shown: the car could not be priced (${valuation.note}).`,
      suggestion
        ? `MODEL SUGGESTION (staff only, NOT shown to the customer): ${eur(suggestion.eur)}${
            suggestion.deductions.length
              ? ` after ${suggestion.deductions.map((d) => `${d.label} ${d.eur < 0 ? "+" : "−"}${eur(Math.abs(d.eur))}`).join(", ")}`
              : " — perfect-car answers, top of range"
          }. Make the real offer from the console once you have seen the photos.`
        : false,
      `Buyer target: ${targetEur != null ? eur(targetEur) : "none given"}.`,
      `Buyer: ${buyer.name}, ${buyer.email}${buyer.phone ? ", " + buyer.phone : ""}.`,
      tradeIn.financeOutstanding === "yes" &&
        `Finance outstanding: ${eur(tradeIn.settlementEur)} to settle.`,
      tradeIn.damage === "Something to mention" &&
        tradeIn.damageNote &&
        `Damage note: ${tradeIn.damageNote}`,
      `Approve or decline in the staff console.`,
    ),
  });

  return NextResponse.json({
    ok: true,
    dealId: deal.id,
    buyerToken: deal.buyerToken,
    statusUrl: `/trade-ins/status/${deal.buyerToken}`,
  });
}
