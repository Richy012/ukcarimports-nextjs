/**
 * Deal Builder store — staging.
 *
 * JSON-file storage with atomic writes (tmp + rename), deliberately zero new
 * dependencies: no native modules, no DB server, survives pm2 restarts, and
 * volumes here are tens of deals, not thousands. If this ever ships to
 * production it moves to MySQL; the API shape below is the contract that makes
 * that swap invisible to every page.
 *
 * THE HARD RULE FROM DEAL_BUILDER_PROCESS.md, ENFORCED HERE AND NOT IN THE UI:
 * the dealer serializer never emits buyer identity, and the buyer serializer
 * never emits dealer identity, until the deal is MATCHED (both deposits in).
 * The cost stack never exists in this store at all — only the all-in price.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "dealbuilder.json");

// ---------- types ----------

export type DealStatus =
  | "submitted"        // buyer finished the flow; awaiting staff approval
  | "live"             // visible to approved dealers, open for bids
  | "accepted"         // buyer accepted a bid; deposit gate open
  | "matched"          // BOTH deposits marked; identities revealed
  | "completed"        // handover done; €500 invoice due
  | "paused_car"       // the UKCI car became unavailable; buyer picking another
  | "declined"         // staff declined (unrealistic target / can't help)
  | "withdrawn"        // buyer pulled out before acceptance
  | "expired"          // no bids / no acceptance in the window; staff closed it
  | "collapsed_dealer" // winning dealer walked after acceptance
  | "collapsed_buyer"; // buyer walked after acceptance

export type BidStatus = "open" | "superseded" | "withdrawn" | "accepted" | "lost";

export interface TradeInDetails {
  reg: string;
  mileage: number | null;
  mileageUnit: "km" | "miles";
  make: string;
  model: string;
  year: number | null;
  lookupSource: "nvf" | "manual";
  financeOutstanding: "yes" | "no" | "";
  settlementEur: number;
  nct: string;
  serviceHistory: string;
  damage: string;
  damageNote: string;
  adLink: string;
  // Whose name is on the VRC — declared UP FRONT, so a name mismatch at the
  // staff check is expected (spouse/company cars are normal). The undeclared
  // mismatch is the fraud tell (owner, 20 Aug).
  vrcHolder: "me" | "spouse" | "other" | "";
  vrcHolderName: string;       // gated from dealers pre-match, like adLink
  ownerConsent: boolean;
  // Full condition disclosure set (2026-08-31). Keys are the question ids in
  // trade-ins/page.tsx DISCLOSURES; values are "yes"/"no". disclosureNotes holds
  // the free-text follow-ups (diagnostic read, body-repair description, etc).
  // Optional so every deal written before this shipped still parses.
  disclosures?: Record<string, string>;
  disclosureNotes?: Record<string, string>;
  // Which pathway the seller chose at step 1 of the flow (owner's spec, 31 Aug):
  // "tradein" = an allowance credited against an import, priced by hand for now;
  // "privateproof" = they stay the seller and we put escrow, inspection and
  // warranty behind a private sale. "" only on deals written before this
  // shipped. It decides how the car is processed, so it is not cosmetic.
  route?: "tradein" | "privateproof" | "";
  // Owner, 6 Sep: does the buyer need finance for the import, and from whom?
  // AIB, BOI and PTSB will work with us; finance houses will not, so a
  // finance-house deal goes straight to a dealer who can arrange it.
  financeNeed?: "none" | "bank" | "finance_house" | "";
  // The seller ticked the opt-out under the two choices: do NOT offer this
  // trade-in and import purchase on to a third-party Irish garage.
  thirdPartyOptOut?: boolean;
}

export interface WantedCar {
  carId: string | null;   // UKCI car_id when they came from a car page
  title: string;
  detail: string;
  landedEur: number;      // the all-in price — the ONLY price this store holds
}

export interface Valuation {
  estimateEur: number | null;
  comparables: number;
  segment: string;            // "make model year" — the frozen unit
  bandLowEur: number | null;  // indicative trade-in band
  bandHighEur: number | null;
  note: string;               // "not enough Irish evidence" etc.
  // v3 (2026-09-04) — present only when a mileage was supplied and the
  // measured model in data/tradein_model.json could price it. Optional so
  // every deal written before this date still parses.
  floorLowEur?: number | null;   // same band computed incl. lots that did not
  floorHighEur?: number | null;  // meet reserve — what the room actually bid
  tradePctSold?: number;         // central % of retail, cars that sold
  tradePctFloor?: number;        // central % of retail, all lots
  tradeBasis?: "cell" | "band" | "global";
  tradeObservations?: number;    // trade sales behind the figure
  // v4 (2026-09-05) — the trim actually priced, and whether it sits far enough
  // from its segment median to be worth real money. `trimNeedsReview` is the
  // flag that a person should see this quote before it goes out: those are the
  // cars where being wrong costs EUR 1,000+.
  trimApplied?: string;
  trimRatio?: number;
  trimNeedsReview?: boolean;
}

export interface Bid {
  id: string;
  dealId: string;
  dealerId: string;
  allowanceEur: number;        // trade-in allowance offered
  atUkciPrice: boolean;        // will do the deal at the shown all-in price
  adjustedTotalEur: number | null; // only when atUkciPrice=false
  conditions: string;
  status: BidStatus;
  placedAt: string;
  updatedAt: string;
  // every bid is indicative until inspection — stamped on the record so the
  // serializers never have to remember to say it
  subjectToInspection: true;
}

/**
 * Renegotiation-first (19 Aug, prior art: most "not as described" cars
 * complete at an agreed chip, not a collapse). Proposed by the winning
 * dealer at inspection with what he found; the buyer is always free to
 * decline. If the description was accurate the price does not change.
 */
export interface Renegotiation {
  originalAllowanceEur: number;
  allowanceEur: number;        // the revised figure proposed
  note: string;                // what was found — judged against the buyer's own pack
  proposedAt: string;
  status: "proposed" | "accepted" | "declined";
  respondedAt: string | null;
}

/** The only items the €500 description guarantee can ever trigger on. */
export const MISDESCRIPTION_CHECKLIST = [
  "accident_damage",
  "warning_lights",
  "mileage_discrepancy",
  "finance_undisclosed",
  "non_runner",
] as const;

export type CancelCategory =
  | "misdescription"    // substantive undisclosed checklist item — guarantee territory
  | "changed_mind"
  | "car_unavailable"
  | "logistics"
  | "other";

export interface Cancellation {
  by: "dealer" | "buyer";
  dealerId: string | null;         // the winning dealer at claim time — credit follows HIM
  category: CancelCategory;
  checklistItems: string[];    // subset of MISDESCRIPTION_CHECKLIST
  detail: string;              // the account given; attaches to the pack on relist
  at: string;
  // misdescription only: buyer has 48h to accept or contest before staff resolve
  buyerResponse: "" | "accepted" | "contested";
  buyerRespondedAt: string | null;
  resolution: "" | "guarantee_applied" | "no_fault" | "dismissed";
  resolvedAt: string | null;
  vrmWatchUntil: string | null; // 90-day Carzone/DoneDeal watch on the trade-in's reg
}

export interface Dealer {
  id: string;
  vat: string;
  email: string;
  name: string;                // trading name, given at registration
  county: string;
  approved: boolean;
  approvedAt: string | null;
  token: string;               // magic-link auth; rotates on demand
  createdAt: string;
  notes: string;               // staff verification notes (CRO/VIES/Carzone)
  banned: boolean;
  creditEur: number;           // next-deal credit ledger (misdescription make-whole)
  // Real-time VIES check at registration (owner, 20 Aug): validity + the
  // registered entity name straight from the EU service. SOFT — VIES has
  // outages, so a failed check never blocks registration; staff see the
  // verdict at approval. valid null = service unavailable at the time.
  vies: { checkedAt: string; valid: boolean | null; name: string; address: string } | null;
  takesTradeIns: "yes" | "sometimes" | "no" | "";  // the one qualifying question (owner, 20 Aug)
}

/**
 * Signed at submission (owner, 20 Aug): the seller either declares ownership
 * or declares the registered owner's authorisation. Typed-name signature,
 * timestamped, IP recorded. The canonical wording is built SERVER-side so the
 * record always holds exactly what was agreed. The registered owner still
 * physically signs the change of ownership at collection — this covers the
 * platform stage.
 */
export interface Declaration {
  kind: "owner" | "authorised";
  text: string;
  signedName: string;
  signedAt: string;
  ip: string;
}

/**
 * THE MODEL'S SUGGESTION — STAFF ONLY, NEVER SHOWN TO THE CUSTOMER (owner,
 * 5 Sep, second ruling: "I will need to view the data and photos on the
 * trade-in in order to offer a price. So the 'You' page must not contain an
 * offer of any sort"). Computed server-side at submission from the answers
 * and the condition range (lib/conditionOffer.ts) as a starting point for
 * the person pricing the car. dealForBuyer must never emit it.
 */
export interface Suggestion {
  eur: number;
  lowEur: number;              // the condition range the car was placed in
  highEur: number;
  position: number;            // 0 = perfect car (top), 1 = bottom
  deductions: { id: string; label: string; eur: number }[];
  madeAt: string;
}

/** THE OFFER — made by a person, after looking at the photos and the
 *  answers, through the staff console's make_offer action. This is the only
 *  figure a trade-in customer ever sees. */
export interface StaffOffer {
  eur: number;
  note: string;                // the line that goes in the customer's email
  madeAt: string;
  by: "staff";
}

/** The two condition ranges the customer was shown at the "how to sell"
 *  step, kept on the record so the status page can repeat them. */
export interface RangesShown {
  trade: { lowEur: number; highEur: number } | null;
  private: { lowEur: number; highEur: number } | null;
}

export interface Deal {
  id: string;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  draftId: string;             // links to uploads/tradein/<draftId> photos
  tradeIn: TradeInDetails;
  wanted: WantedCar;
  valuation: Valuation;
  suggestion?: Suggestion | null;  // 5 Sep; model figure, staff eyes only
  offer?: StaffOffer | null;       // 5 Sep; the person's figure, once made
  ranges?: RangesShown | null;     // 5 Sep; what the customer was shown
  targetEur: number | null;    // what the buyer wants for it (0 = "tell me")
  wantFinanceQuotes: boolean;
  buyer: { email: string; phone: string; eircode: string; name: string };
  buyerToken: string;          // status-page auth
  acceptedBidId: string | null;
  buyerDepositPaid: boolean;
  dealerDepositPaid: boolean;  // the dealer side is the introduction fee (config.dealerFeeEur)
  renegotiation: Renegotiation | null;
  cancellations: Cancellation[];
  declaration: Declaration | null;
  marginNote: string;          // staff-set, per deal — never a fixed rule
  staffNote: string;
  history: { at: string; event: string; detail: string }[];
}

export interface Notification {
  id: string;
  at: string;
  audience: "staff" | "dealer" | "buyer";
  dealerId: string | null;
  dealId: string | null;
  kind: string;
  subject: string;
  body: string;
  emailedTo: string | null;    // where the email actually went (staging: info@)
  intendedFor: string | null;  // who it would go to in production
}

interface Db {
  deals: Deal[];
  dealers: Dealer[];
  bids: Bid[];
  notifications: Notification[];
  config: {
    adminKey: string;
    mailMode: "log" | "staff-only" | "live";
    // % of retail: velocity-tiered trade-in bands. Owner's priors (19 Aug):
    // fast movers 70-85, ordinary ~70, auction-bound 60-65 — recalibrated
    // from every real bid received.
    bandTiers: { fast: [number, number]; ordinary: [number, number]; slow: [number, number] };
    // two-week gone-% thresholds (measured, velocity.json) that pick the tier
    tierFastPct: number;
    tierSlowPct: number;
    bidWindowHours: number;
    dealerFeeEur: number;      // introduction fee, charged at bid acceptance, before identities
    buyerGuaranteeEur: number; // description guarantee — objective checklist items only
    dealerCreditEur: number;   // next-deal credit to the dealer on a proven misdescription
  };
}

// ---------- storage ----------

const EMPTY: Db = {
  deals: [], dealers: [], bids: [], notifications: [],
  config: {
    adminKey: "",
    mailMode: "staff-only",
    bandTiers: { fast: [0.7, 0.85], ordinary: [0.65, 0.72], slow: [0.58, 0.65] },
    tierFastPct: 40,
    tierSlowPct: 15,
    bidWindowHours: 48,
    dealerFeeEur: 900,
    buyerGuaranteeEur: 500,
    dealerCreditEur: 400,
  },
};

let lock: Promise<unknown> = Promise.resolve();

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const db = JSON.parse(raw) as Db;
    for (const d of db.deals ?? []) {
      if (d.renegotiation === undefined) d.renegotiation = null;
      if (!Array.isArray(d.cancellations)) d.cancellations = [];
      for (const c of d.cancellations) if (c.dealerId === undefined) c.dealerId = null;
      if (d.tradeIn.vrcHolder === undefined) d.tradeIn.vrcHolder = "";
      if (d.tradeIn.vrcHolderName === undefined) d.tradeIn.vrcHolderName = "";
      if (d.tradeIn.ownerConsent === undefined) d.tradeIn.ownerConsent = false;
      if (d.declaration === undefined) d.declaration = null;
      if (d.offer === undefined) d.offer = null;
      if (d.suggestion === undefined) d.suggestion = null;
      if (d.ranges === undefined) d.ranges = null;
    }
    for (const dl of db.dealers ?? []) {
      if (typeof dl.creditEur !== "number") dl.creditEur = 0;
      if (dl.vies === undefined) dl.vies = null;
      if (dl.takesTradeIns === undefined) dl.takesTradeIns = "";
    }
    return { ...EMPTY, ...db, config: { ...EMPTY.config, ...db.config } };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = FILE + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 1), "utf8");
  await fs.rename(tmp, FILE);
}

/** Serialized read-modify-write. Single pm2 fork, so an in-process mutex is enough. */
export async function withDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = lock.then(async () => {
    const db = await readDb();
    const out = await fn(db);
    await writeDb(db);
    return out;
  });
  lock = run.catch(() => {});
  return run;
}

export async function readOnly<T>(fn: (db: Db) => T): Promise<T> {
  const db = await readDb();
  return fn(db);
}

/**
 * True once a draftId is attached to a submitted deal. The photo endpoint uses
 * this to FREEZE a draft: during capture no deal exists so uploads/deletes work,
 * but once the buyer has submitted, the photos are evidence and no one — not the
 * dealers who can now see the draftId, not a stray old browser tab — may mutate
 * them. Read-only, so it is safe on the hot photo-serving path.
 */
export async function isDraftSealed(draftId: string): Promise<boolean> {
  if (!draftId) return false;
  return readOnly((db) => db.deals.some((d) => d.draftId === draftId));
}

export const newId = (p: string) => p + "_" + crypto.randomBytes(6).toString("hex");
export const newToken = () => crypto.randomBytes(18).toString("base64url");
export const nowIso = () => new Date().toISOString();

// ---------- state machine ----------

const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  submitted:      ["live", "declined", "withdrawn"],
  live:           ["accepted", "withdrawn", "expired", "paused_car", "declined"],
  paused_car:     ["live", "withdrawn", "expired"],
  accepted:       ["matched", "collapsed_dealer", "collapsed_buyer", "live"],
  matched:        ["completed", "collapsed_dealer", "collapsed_buyer"],
  completed:      [],
  declined:       [],
  withdrawn:      [],
  expired:        ["live"],           // staff can relist an expired deal
  collapsed_dealer: ["live"],         // dealer walked → relist, bids reset
  collapsed_buyer: ["live"],          // resolved misdescription -> corrected pack relists
};

export function canMove(from: DealStatus, to: DealStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function moveDeal(deal: Deal, to: DealStatus, detail: string): void {
  if (!canMove(deal.status, to)) {
    throw new Error(`illegal transition ${deal.status} -> ${to}`);
  }
  deal.history.push({ at: nowIso(), event: `${deal.status} -> ${to}`, detail });
  deal.status = to;
  deal.updatedAt = nowIso();
}

// ---------- serializers: the identity gate lives HERE ----------

/** Letter the dealers see instead of each other / instead of the buyer. */
export function dealerAlias(dealId: string, dealerId: string, db: Db): string {
  const ids = Array.from(new Set(db.bids.filter(b => b.dealId === dealId).map(b => b.dealerId)));
  const i = ids.indexOf(dealerId);
  return "Dealer " + String.fromCharCode(65 + (i < 0 ? ids.length : i));
}

/** What a DEALER may see of a deal. Buyer identity only after matched. */
export function dealForDealer(deal: Deal, dealer: Dealer, db: Db) {
  const mine = db.bids.filter(b => b.dealId === deal.id && b.dealerId === dealer.id);
  const won = deal.acceptedBidId !== null && mine.some(b => b.id === deal.acceptedBidId);
  const revealed = won && deal.status === "matched" || won && deal.status === "completed";
  return {
    id: deal.id,
    status: deal.status,
    createdAt: deal.createdAt,
    // adLink is the seller's OWN classified ad — their name and phone one
    // click away. It reaches the winning dealer at matched, never the panel
    // (review HIGH: pre-match it is a gift-wrapped €900 bypass).
    tradeIn: {
      ...deal.tradeIn,
      adLink: revealed ? deal.tradeIn.adLink : "",
      // the registered owner's name is identity — winner at matched only
      vrcHolderName: revealed ? deal.tradeIn.vrcHolderName : "",
    },
    wanted: { ...deal.wanted },          // all-in price only; no cost stack exists here
    valuation: { ...deal.valuation },
    targetEur: deal.targetEur,
    wantFinanceQuotes: deal.wantFinanceQuotes,
    eircodeArea: deal.buyer.eircode ? deal.buyer.eircode.trim().slice(0, 3).toUpperCase() : "",
    photos: deal.draftId,
    myBids: mine.map(b => ({ ...b })),
    bidCount: db.bids.filter(b => b.dealId === deal.id && b.status === "open").length,
    won,
    renegotiation: won && deal.renegotiation ? { ...deal.renegotiation } : null,
    // owner rule 19 Aug: future bidders see that a previous deal on this car
    // died over undisclosed checklist items — category + items, no identities
    priorIssues: (deal.cancellations ?? [])
      .filter(c => c.category === "misdescription" && c.resolution === "guarantee_applied")
      .map(c => ({ at: c.at, checklistItems: [...c.checklistItems], detail: c.detail.slice(0, 300) })),
    introFeeEur: db.config.dealerFeeEur,
    // identity: null until BOTH deposits are in. This is the business model.
    buyer: revealed
      ? { name: deal.buyer.name, email: deal.buyer.email, phone: deal.buyer.phone, eircode: deal.buyer.eircode }
      : null,
    depositGate: won ? { yours: deal.dealerDepositPaid, buyers: deal.buyerDepositPaid } : null,
  };
}

/** What the BUYER may see. Dealer identity only after matched. */
export function dealForBuyer(deal: Deal, db: Db) {
  const bids = db.bids
    .filter(b => b.dealId === deal.id && (b.status === "open" || b.status === "accepted"))
    .sort((a, b) => b.allowanceEur - a.allowanceEur);
  const revealed = deal.status === "matched" || deal.status === "completed";
  return {
    id: deal.id,
    status: deal.status,
    tradeIn: { ...deal.tradeIn },
    wanted: { ...deal.wanted },
    valuation: { ...deal.valuation },
    // the person's offer only — the model suggestion NEVER reaches a buyer
    offer: deal.offer ? { ...deal.offer } : null,
    ranges: deal.ranges
      ? { trade: deal.ranges.trade ? { ...deal.ranges.trade } : null, private: deal.ranges.private ? { ...deal.ranges.private } : null }
      : null,
    targetEur: deal.targetEur,
    buyerDepositPaid: deal.buyerDepositPaid,
    dealerDepositPaid: deal.dealerDepositPaid,
    renegotiation: deal.renegotiation ? { ...deal.renegotiation } : null,
    cancellation: (deal.cancellations ?? []).length
      ? { ...deal.cancellations[deal.cancellations.length - 1] }
      : null,
    guaranteeEur: db.config.buyerGuaranteeEur,
    bids: bids.map(b => {
      const dealer = db.dealers.find(d => d.id === b.dealerId);
      return {
        id: b.id,
        alias: dealerAlias(deal.id, b.dealerId, db),
        county: dealer?.county ?? "",
        allowanceEur: b.allowanceEur,
        atUkciPrice: b.atUkciPrice,
        adjustedTotalEur: b.adjustedTotalEur,
        conditions: b.conditions,
        status: b.status,
        accepted: deal.acceptedBidId === b.id,
        subjectToInspection: true,
        // the dealer behind the accepted bid, revealed only once matched
        dealer: revealed && deal.acceptedBidId === b.id && dealer
          ? { name: dealer.name, email: dealer.email, county: dealer.county }
          : null,
      };
    }),
    history: deal.history.slice(-12),
  };
}

/** Staff see everything. */
export function dealForStaff(deal: Deal, db: Db) {
  return {
    ...deal,
    bids: db.bids
      .filter(b => b.dealId === deal.id)
      .map(b => ({ ...b, dealer: db.dealers.find(d => d.id === b.dealerId) ?? null })),
  };
}
