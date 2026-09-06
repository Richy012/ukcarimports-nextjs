"use client";

import DraftBanner from "@/app/components/DraftBanner";

/**
 * Trade-ins — STAGING, client (buyer) side.
 *
 * Sales rules this layout follows:
 *  - The number is always on screen and always updating. It is the reason
 *    anyone keeps going.
 *  - Ask for nothing until the stage earns it. Valuation is free; the VLC
 *    buys access to dealers; ID and deposit only when a deal is agreed.
 *  - The awkward questions (outstanding finance, NCT, damage) are framed as
 *    "this is what makes your offer stick", because a surprise at handover
 *    is a haggle, and a haggle is a lost deal.
 *  - The reg does the typing: /api/reg-lookup reads make/model from the
 *    national vehicle file (motortax.ie) and the year from the reg itself.
 *  - Photos are the negotiation, done in advance: 22 guided shots plus
 *    unlimited damage close-ups. What a dealer has already seen, he cannot
 *    use to cut the price on the day.
 *
 * Wiring (Deal Builder): ?car= loads the real UKCI car via /api/ukci-car;
 * the valuation aside is fed by /api/tradein-valuation after the reg lookup
 * (13200 stays ONLY as the fallback when that route fails); the final step
 * POSTs the whole thing to /api/deal and moves to the buyer status page.
 * The dealer mockup that used to live in this file is replaced by a link to
 * the real portal at /deal-builder.
 */

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PhotoCapture, { type ShotGroup } from "./PhotoCapture";
import L from "./tradein_layout.module.css";

/** Whole euro, no cents. Every figure on this page is an estimate; showing
 *  cents on an estimate implies a precision that does not exist. */
const eur = (n: number) => "\u20ac" + Math.round(n).toLocaleString("en-IE");

/** The national vehicle file shouts ("TOYOTA YARIS"); the page should not.
 *  Short badge-style makes stay as they are (BMW, MG, DS). */
const KEEP_CAPS = new Set(["BMW", "MG", "DS", "VW", "GT", "GTI", "GTD", "RS", "AMG", "SRT", "STI"]);
function carCase(s: string): string {
  return (s || "")
    .trim()
    .split(/\s+/)
    .map((w) =>
      w
        .split("-")
        .map((p) => (KEEP_CAPS.has(p.toUpperCase()) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
        .join("-"),
    )
    .join(" ");
}

interface WantedState {
  carId: string | null;
  title: string;
  detail: string;
  landed: number;
}

const FALLBACK_CAR: WantedState = {
  carId: null,
  title: "2022 Kia Sportage GT-Line",
  detail: "41,000 km · diesel · automatic",
  landed: 28450,
};

const SHOT_GROUPS: ShotGroup[] = [
  {
    // These ten mirror the reference capture flow's exterior sequence exactly,
    // in its own order, so every one of them has a real framing template behind
    // it. Ireland is right-hand drive: the car's LEFT is the PASSENGER side and
    // its RIGHT is the DRIVER side. Getting that the wrong way round would walk
    // every seller around the wrong side of their own car.
    name: "Outside",
    shots: [
      { id: "out_front", label: "Front, low", hint: "Crouch a little. Both front wheels in, registration readable." },
      { id: "out_front_pass", label: "Front 3/4, passenger side", hint: "Stand at the front corner so the front and the passenger side are both in." },
      { id: "out_roof", label: "Roofline and glass", hint: "Along the roof from the front corner - chips and scratches live here." },
      { id: "out_front_pass_close", label: "Front, passenger side", hint: "Closer in on the front wing and door, square to the car." },
      { id: "out_side_pass", label: "Passenger side, full length", hint: "Bumper to bumper, roof to tyres, nothing cropped." },
      { id: "out_rear_pass", label: "Rear 3/4, passenger side", hint: "Back corner, showing the rear and the passenger side together." },
      { id: "out_rear", label: "Rear, low", hint: "Both rear lights and the plate in frame." },
      { id: "out_rear_driver", label: "Rear 3/4, driver side", hint: "The same shot from the other back corner." },
      { id: "out_side_driver", label: "Driver side, full length", hint: "Bumper to bumper again from the driver's side." },
      { id: "out_front_driver", label: "Front 3/4, driver side", hint: "Back to the front, at the driver-side corner." },
    ],
  },
  {
    name: "Wheels and tyres",
    shots: [
      { id: "wheel_fd", label: "Front driver wheel", hint: "Close enough to see the tyre tread and any kerbing on the alloy." },
      { id: "wheel_fp", label: "Front passenger wheel", hint: "Same again." },
      { id: "wheel_rd", label: "Rear driver wheel", hint: "Same again." },
      { id: "wheel_rp", label: "Rear passenger wheel", hint: "Same again." },
    ],
  },
  {
    name: "Inside",
    shots: [
      { id: "in_dash", label: "Dash with the engine running", hint: "Engine ON so the mileage and any warning lights are lit and readable." },
      { id: "in_front_seats", label: "Front seats", hint: "Driver's door open, both front seats in frame." },
      { id: "in_rear_seats", label: "Rear seats", hint: "Rear door open, seats and floor visible." },
      { id: "in_boot", label: "Boot, floor lifted", hint: "Lift the boot floor so the spare or the repair kit is visible." },
      { id: "in_screen", label: "Infotainment screen, on", hint: "Screen powered up - a dead screen is an expensive assumption." },
      { id: "in_console", label: "Centre console and gearstick", hint: "The area that shows real wear." },
      { id: "in_seat_wear", label: "Driver's seat bolster", hint: "The outer edge of the driver's seat - the first thing to wear." },
    ],
  },
  {
    name: "Paperwork and keys",
    shots: [
      { id: "doc_keys", label: "All keys together", hint: "Every key you have, in one shot. Two keys is worth real money." },
      { id: "doc_service", label: "Service book or history", hint: "Open at the stamps, or a photo of the digital record." },
      { id: "doc_discs", label: "Windscreen discs", hint: "Tax and NCT discs, close enough to read the dates." },
    ],
  },
];

const SHOT_COUNT = SHOT_GROUPS.reduce((n, g) => n + g.shots.length, 0);

// Same shape the photo route enforces on draft ids. PhotoCapture keeps its
// draft id in localStorage; we don't know its exact key from here, so at
// submit time we take "tradein_draft_id" if present, else the first key
// matching /draft/i whose value looks like a draft id, else "unknown".
const SAFE_ID = /^[A-Za-z0-9_-]{6,64}$/;

function readDraftId(): string {
  try {
    // PhotoCapture.tsx stores its draft id under "tradein_draft" (verified in
    // its source, line 410) — that key first, so photos and deal always share
    // one draft.
    const direct =
      window.localStorage.getItem("tradein_draft") ||
      window.localStorage.getItem("tradein_draft_id");
    if (direct && SAFE_ID.test(direct)) return direct;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !/draft/i.test(k)) continue;
      const v = window.localStorage.getItem(k);
      if (v && SAFE_ID.test(v)) return v;
    }
  } catch {
    /* storage unavailable — fall through */
  }
  return "unknown";
}

// The disclosure set, transcribed from the TradeBid uploader (owner's screenshots,
// 2026-08-31). Parent questions are answered Yes/No; children appear only when the
// parent's answer makes them relevant, which is what keeps the form short while
// still capturing the detail a dispute turns on.
type DQ = {
  id: string;
  label: string;
  child?: boolean;
  showIf?: (d: Record<string, string>) => boolean;
  text?: { showIf: (d: Record<string, string>) => boolean; placeholder: string };
};
const DISCLOSURES: { group: string; items: DQ[] }[] = [
  {
    group: "Mechanical",
    items: [
      { id: "keys", label: "Two or more keys present?" },
      { id: "cold_noise", label: "Does the engine make a rattling or knocking sound when you first start it cold, before it warms up?" },
      { id: "cold_noise_clears", label: "Does the noise go away once the engine warms up?", child: true,
        showIf: (d) => d.cold_noise === "yes" },
      { id: "clutch", label: "Has the clutch been replaced in the past 12 months / 20,000 km?" },
      { id: "gearbox", label: "Gearbox operating without excessive noise or vibrations?" },
      { id: "warning_lights", label: "Any warning lights on the dash?" },
      { id: "warning_diagnosed", label: "Has the fault been diagnosed?", child: true,
        showIf: (d) => d.warning_lights === "yes",
        text: { showIf: (d) => d.warning_lights === "yes", placeholder: "What light is on, and what is the diagnostic?" } },
      // Service history is asked ONCE, in the paperwork block above this set
      // (Full / Partial / None). The four TradeBid history questions that used
      // to sit here duplicated it (owner, 5 Sep: "you have asked some of the
      // same questions twice") and are gone.
      { id: "aircon", label: "Does the vehicle have air conditioning?" },
      { id: "electronics", label: "All electronics working correctly?" },
    ],
  },
  {
    group: "Condition",
    items: [
      // Bodywork damage is the three-way question in the same block (Nothing /
      // Minor marks / Something to mention); these are the specifics.
      { id: "windscreen", label: "Windscreen damage?" },
      { id: "interior_damage", label: "Visible rips, tears or damage to seats and panels?",
        text: { showIf: (d) => d.interior_damage === "yes", placeholder: "Where, and how bad?" } },
      { id: "body_repair", label: "To the best of your knowledge, can you see evidence of previous paint or body repair?",
        text: { showIf: (d) => d.body_repair === "yes", placeholder: "Please describe the paint or body repair work" } },
      { id: "odours", label: "Free from any interior odours?" },
      { id: "retail_ready", label: "Prepared to retail-ready condition?" },
      { id: "serviced", label: "Has the vehicle been serviced?", child: true, showIf: (d) => d.retail_ready === "yes" },
      { id: "valeted", label: "Has the vehicle been valeted?", child: true, showIf: (d) => d.retail_ready === "yes" },
    ],
  },
];

/**
 * The two ways to sell — owner's spec, 31 Aug (evening):
 *   "Give them the 2 options - straight trade in or a slower but better return
 *    Above Board Cars pathway. Once they pick their preference we get them to submit
 *    the details of the car and their own."
 *
 * THE CHOICE COMES FIRST, before one detail is asked for. It is a preference
 * question - money against effort - not a price question, so it does not need a
 * valuation behind it.
 *
 * AND NO FIGURE APPEARS ANYWHERE IN THIS FLOW. On the trade-in route the owner
 * prices the car himself until the universal estimator is proven ("the car comes
 * to me for the first while ... I'll get back to them with a plan"); on
 * Above Board Cars the only number is the asking price on the seller's own advert.
 * A number shown here is a number that has to be taken back later, which is the
 * doorstep haggle this whole flow exists to remove.
 */
type RouteId = "tradein" | "privateproof";
// The private route's name WILL CHANGE (owner, 5 Sep). Change it here only.
const PRIVATE_ROUTE_NAME = "Sell it privately, protected by Above Board Cars";
const ROUTES: {
  id: RouteId; name: string; when: string; blurb: string; points: string[]; fees?: string[];
}[] = [
  {
    id: "tradein",
    name: "Trade it in against your import",
    when: "Certain today, settled on delivery day",
    blurb:
      "The simple one. The range above runs from a car with no service history and mechanical faults to a perfect one. Send us your photos and answer the condition questions, we go through them, and we come back to you with our offer — the allowance off the price of the car we import for you.",
    points: [
      "You keep driving your car right up to delivery day.",
      "One handover, one appointment, nothing to arrange yourself.",
      "You give up some of what a patient private sale would bring \u2014 that is the price of certainty.",
    ],
  },
  {
    id: "privateproof",
    name: PRIVATE_ROUTE_NAME,
    when: "Usually a few weeks, no guarantee of a sale",
    blurb:
      "The bigger number. You keep the car, you set the price, and you sell it to a private buyer for more than any trade will pay \u2014 with Above Board Cars giving that buyer everything a garage would: an independent inspection, a 12-month warranty and protected payment. The range above is what comparable cars actually sold for privately; where you list within it is your call.",
    points: [
      "More money than any trade will pay. You keep the car, you set the price, you keep the difference.",
      "More buyers, a better price, a quicker sale. Buyers want a private-sale price but are wary of a private seller \u2014 give them a garage\u2019s protection and your ad pulls the buyers a garage\u2019s does.",
      "Their money is protected. The buyer pays into Stripe\u2019s escrow-like transfer account and it is released to you at handover \u2014 and a buyer who has paid in is not a messer.",
      "An independent inspection if they want one, or they bring their own mechanic. The car speaks for itself.",
      "A 12-month warranty on the car. A private buyer has no comeback on a private seller \u2014 the warranty is what gives them one.",
      "Advertised on ukcarimports.ie to people already looking, and you list it on DoneDeal too with our line in the ad.",
    ],
    fees: [
      "Payment protection through Stripe\u2019s escrow-like transfer account: \u20ac195 per sale.",
      "Independent mechanical inspection: \u20ac250\u2013500, depending on where the car is and how detailed a check you want.",
      "12-month warranty: \u20ac395\u2013495 by level of cover \u2014 the five covers are listed below, each with its full policy document.",
      "Typically sellers will include all 3 services to attract more interest and help achieve a better price and a quicker sale.",
    ],
  },
];

/**
 * The suggested line for the seller's own DoneDeal advert - the owner's
 * wording, 31 Aug, kept close to verbatim. It is what makes a private ad read as
 * safe to a stranger, so it is offered ready to copy rather than described.
 */
// Shared with the Above Board Cars pages: src/lib/aboveBoard.ts. Change wording and prices there.
import { AD_LINE, WARRANTIES, WARRANTY_DOC_BASE } from "@/lib/aboveBoard";

/**
 * The third-party opt-out, owner's wording 31 Aug. It sits UNDER the two choices,
 * not inside either of them, because it applies whichever route is picked.
 */
const OPT_OUT_TEXT =
  "ukcarimports may offer this transaction — your trade-in together with your import purchase — to third-party established Irish garages, particularly if you require a finance package from a finance house (not AIB, BOI or PTSB). There is no obligation to accept an offer; however, the fact one has been sent to you means we most likely couldn't or wouldn't be able to take your trade-in ourselves.";

export default function TradeIns() {
  // useSearchParams must sit inside a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <TradeInsFlow />
    </Suspense>
  );
}

function TradeInsFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);

  // THE RANGE (owner, 4 Sep) - reverses the 31 Aug "no numbers" spec, because
  // there is now something to stand over: /api/route-pricing prices both routes
  // off the same Irish dealer median for this exact car. What survives from
  // 31 Aug is the part that mattered - the figure is still confirmed by a
  // person, and the copy says so rather than implying the estimate is an offer.
  // null = not fetched or not priceable; the cards then fall back to the old
  // wording, which is always honest.
  const [pricing, setPricing] = useState<null | {
    retailEur: number;
    comparables: number;
    routes: {
      route: string; lowEur: number; highEur: number; typicalEur: number;
      conditionLowEur: number; conditionHighEur: number;
    }[];
  }>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  // THE TRIM (owner, 5 Sep). Worth EUR 19 on an ordinary car and EUR 750-2,200
  // on the 13% whose spec sits well away from their segment - his catch, and
  // three of my own measurements missed it by averaging it away. A DROPDOWN,
  // never a text box: free text is exactly what makes Carzone's own version
  // field unusable, and a customer typing "amg line prem+" lands back in it.
  const [trims, setTrims] = useState<string[]>([]);
  const [trim, setTrim] = useState("");

  const [finance, setFinance] = useState<"" | "no" | "yes">("");
  const [settle, setSettle] = useState(0);
  const [nct, setNct] = useState("");
  const [history, setHistory] = useState("");
  const [damage, setDamage] = useState("");
  const [damageNote, setDamageNote] = useState("");
  // (finance-quotes tick box removed 6 Sep - owner: "I don't have that facility")
  const [shotsDone, setShotsDone] = useState(0);

  // Which of the two ways to sell the customer picked. Chosen at step 1, BEFORE
  // anything is asked of them - it decides which pathway the car is processed
  // through, so every later step is worded for the route they are actually on.
  const [route, setRoute] = useState<null | RouteId>(null);

  // The third-party-garage opt-out that sits under the two choices. Default is
  // opted IN (false) - it is an opt-OUT, so ticking it withholds permission.
  const [thirdPartyOptOut, setThirdPartyOptOut] = useState(false);

  // Full disclosure set (2026-08-31). One record, so a dealer's later
  // misdescription claim is answered by what the customer actually declared.
  const [disc, setDisc] = useState<Record<string, string>>({});
  const [discText, setDiscText] = useState<Record<string, string>>({});
  const setD = (k: string, v: string) => setDisc((p) => ({ ...p, [k]: v }));
  const setT = (k: string, v: string) => setDiscText((p) => ({ ...p, [k]: v }));

  const [reg, setReg] = useState("");
  const [mileage, setMileage] = useState("");
  const [unit, setUnit] = useState<"km" | "miles">("km");
  // Mileage is REQUIRED (6 Sep): without it the measured model cannot run and
  // the quote silently falls back to the old assumed tiers. The owner's own
  // test went through with no mileage and got the wrong band.
  const [mileageMissing, setMileageMissing] = useState(false);
  // Owner, 6 Sep: asked at the very start. Banks (AIB, BOI, PTSB) work with
  // us; finance houses do not, so a finance-house deal goes straight to a
  // dealer and the private route is not offered.
  const [financeNeed, setFinanceNeed] = useState<"" | "none" | "bank" | "finance_house">("");
  const [financeMissing, setFinanceMissing] = useState(false);
  const [looking, setLooking] = useState(false);
  const [car, setCar] = useState<null | { make: string; model: string; year: number | null }>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [manualMake, setManualMake] = useState("");
  const [manualModel, setManualModel] = useState("");

  // the wanted car — the real UKCI car when we arrived from a car page (?car=),
  // the Sportage example otherwise
  const [wanted, setWanted] = useState<WantedState>(FALLBACK_CAR);

  const [target, setTarget] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerEircode, setBuyerEircode] = useState("");
  const [adLink, setAdLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [vlcStatus, setVlcStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const vlcInput = useRef<HTMLInputElement | null>(null);
  const [idStatus, setIdStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const idInput = useRef<HTMLInputElement | null>(null);
  const [vrcHolder, setVrcHolder] = useState<"" | "me" | "spouse" | "other">("");
  const [vrcHolderName, setVrcHolderName] = useState("");
  const [ownerConsent, setOwnerConsent] = useState(false);
  const [declName, setDeclName] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  // ---------------------------------------------------------------- AUTOSAVE
  // Owner, 6 Sep: the form is long and people will not have everything to
  // hand. Photos already survive a reload (server, by draft id); now the
  // answers do too. Everything below is posted to /api/tradein-draft as it
  // changes and read back on load — same browser, or any device via the
  // emailed resume link. Nothing is saved until we have restored, so a fresh
  // load can never overwrite a saved draft with empty state.
  const [restored, setRestored] = useState(false);
  // readDraftId() hands back the literal "unknown" when nothing is stored -
  // only a real id (same shape the photo and draft routes accept) counts here
  const draftIdOk = () => { const id = readDraftId(); return /^[a-z0-9]{12,32}$/.test(id) ? id : ""; };
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [resumeEmail, setResumeEmail] = useState("");
  const [resumeState, setResumeState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const answerState = () => ({
    step, reg, mileage, unit, car, manualMake, manualModel, trim, route, thirdPartyOptOut, financeNeed,
    finance, settle, nct, history, damage, damageNote, disc, discText, adLink,
    vrcHolder, vrcHolderName, ownerConsent, declName, target,
    buyerName, buyerPhone, buyerEmail, buyerEircode,
  });

  function applyAnswers(a: Record<string, unknown>) {
    const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
    const b = (k: string) => a[k] === true;
    setReg(s("reg")); setMileage(s("mileage")); setUnit(a.unit === "miles" ? "miles" : "km");
    if (a.car && typeof a.car === "object") setCar(a.car as { make: string; model: string; year: number | null });
    setManualMake(s("manualMake")); setManualModel(s("manualModel")); setTrim(s("trim"));
    if (a.route === "tradein" || a.route === "privateproof") setRoute(a.route);
    if (a.financeNeed === "none" || a.financeNeed === "bank" || a.financeNeed === "finance_house") setFinanceNeed(a.financeNeed);
    setThirdPartyOptOut(b("thirdPartyOptOut"));
    if (a.finance === "yes" || a.finance === "no") setFinance(a.finance);
    setSettle(typeof a.settle === "number" ? a.settle : 0);
    setNct(s("nct")); setHistory(s("history")); setDamage(s("damage")); setDamageNote(s("damageNote"));
    if (a.disc && typeof a.disc === "object") setDisc(a.disc as Record<string, string>);
    if (a.discText && typeof a.discText === "object") setDiscText(a.discText as Record<string, string>);
    setAdLink(s("adLink"));
    if (a.vrcHolder === "me" || a.vrcHolder === "spouse" || a.vrcHolder === "other") setVrcHolder(a.vrcHolder);
    setVrcHolderName(s("vrcHolderName")); setOwnerConsent(b("ownerConsent")); setDeclName(s("declName"));
    setTarget(s("target")); setBuyerName(s("buyerName")); setBuyerPhone(s("buyerPhone"));
    setBuyerEmail(s("buyerEmail")); setBuyerEircode(s("buyerEircode"));
    const st = typeof a.step === "number" ? a.step : 1;
    // never drop someone back onto step 1 with a car already known
    setStep(a.car && st < 2 ? 2 : st);
    if (a.car && typeof a.car === "object") {
      const c = a.car as { make: string; model: string; year: number | null };
      const kmv = (() => { const n = Number(s("mileage").replace(/[^0-9.]/g, "")); return n > 0 ? Math.round(a.unit === "miles" ? n * 1.609 : n) : null; })();
      void priceIt(c, kmv, s("trim"));
      void (async () => {
        try {
          const q = new URLSearchParams({ make: c.make, model: c.model });
          const t = await fetch(`/api/trims?${q}`); const j = await t.json();
          setTrims(Array.isArray(j?.trims) ? j.trims : []);
        } catch { setTrims([]); }
      })();
    }
  }

  // restore: a resume link first (it REPLACES the browser's draft), else the
  // browser's own draft
  useEffect(() => {
    (async () => {
      try {
        const rt = new URLSearchParams(window.location.search).get("resume");
        if (rt) {
          const r = await fetch(`/api/tradein-resume?t=${encodeURIComponent(rt)}`);
          const j = await r.json();
          if (j?.ok && j.draftId) {
            try { window.localStorage.setItem("tradein_draft", j.draftId); } catch {}
            window.history.replaceState(null, "", "/trade-ins");
          }
        }
        const id = draftIdOk();
        if (id) {
          const r = await fetch(`/api/tradein-draft?draftId=${encodeURIComponent(id)}`);
          const j = await r.json();
          if (j?.ok && j.answers && !j.sealed) { applyAnswers(j.answers); setSavedAt(j.savedAt || null); }
        }
      } catch { /* a failed restore must never block a fresh start */ }
      // Mint the draft id NOW if there is none, so the answers autosave from
      // step 1 and the resume link has something to point at. PhotoCapture
      // reads "tradein_draft" first, so the photos attach to the same draft.
      try {
        if (!draftIdOk()) {
          const id = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
          window.localStorage.setItem("tradein_draft", id);
        }
      } catch {}
      setRestored(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // save, debounced, once restored
  useEffect(() => {
    if (!restored) return;
    const id = draftIdOk();
    if (!id) return;
    const h = setTimeout(() => {
      fetch("/api/tradein-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: id, answers: answerState() }),
      }).then((r) => r.json()).then((j) => { if (j?.ok) setSavedAt(j.savedAt); }).catch(() => {});
    }, 800);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, step, reg, mileage, unit, car, manualMake, manualModel, trim, route, thirdPartyOptOut, financeNeed,
      finance, settle, nct, history, damage, damageNote, disc, discText, adLink,
      vrcHolder, vrcHolderName, ownerConsent, declName, target, buyerName, buyerPhone, buyerEmail, buyerEircode]);

  async function sendResumeLink() {
    const email = (resumeEmail || buyerEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setResumeState("error"); return; }
    setResumeState("sending");
    try {
      const id = draftIdOk();
      const carName = car ? `${car.year ? car.year + " " : ""}${car.make} ${car.model}` : "your car";
      const r = await fetch("/api/tradein-resume", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: id, email, car: carName }),
      });
      const j = await r.json();
      setResumeState(j?.ok ? "sent" : "error");
    } catch { setResumeState("error"); }
  }

  // ---------------------------------------------------------- WHAT IS MISSING
  // Owner, 6 Sep: no offer without the photos and every answer. The button
  // stays off until this list is empty, and the list says exactly what is left.
  const stillNeeded = (): string[] => {
    const out: string[] = [];
    if (shotsDone < SHOT_COUNT) out.push(`${SHOT_COUNT - shotsDone} of the ${SHOT_COUNT} guided photos`);
    if (!financeNeed) out.push("whether you will need finance for the import");
    if (!finance) out.push("whether there is finance outstanding");
    if (!nct) out.push("when the NCT is due");
    if (!history) out.push("the service history");
    if (!damage) out.push("the bodywork question");
    const qs = DISCLOSURES.flatMap((g) => g.items).filter((q) => (!q.showIf || q.showIf(disc)) && !disc[q.id]);
    if (qs.length) out.push(`${qs.length} of the condition questions`);
    if (!vrcHolder) out.push("whose name is on the VRC");
    if ((vrcHolder === "spouse" || vrcHolder === "other") && (!vrcHolderName.trim() || !ownerConsent)) out.push("the registered owner's name and their consent");
    if (declName.trim().split(/\s+/).length < 2) out.push("the signed declaration (your full name)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) out.push("a valid email");
    if (!buyerName.trim()) out.push("your name");
    return out;
  };

  const SaveForLater = () => (
    <div style={{ marginTop: 14, padding: "10px 12px", border: "1px dashed #cbd5e1", borderRadius: 10, background: "#fafafa" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        Not everything to hand? Finish later.
        {savedAt && <span style={{ fontWeight: 400, color: "#6b7280" }}> &nbsp;Saved.</span>}
      </div>
      <div style={{ fontSize: 12.5, color: "#475569", margin: "2px 0 8px" }}>
        Your photos and answers are kept. We can email you a link that brings you straight back here, on any phone or computer.
      </div>
      {resumeState === "sent" ? (
        <div style={{ fontSize: 13, color: "#0a7d33" }}>Sent &mdash; check your inbox.</div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ flex: 1, minWidth: 200, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
            placeholder="your email" value={resumeEmail || buyerEmail}
            onChange={(e) => setResumeEmail(e.target.value)}
          />
          <button type="button" style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "#111827", color: "#fff", fontWeight: 600 }}
                  disabled={resumeState === "sending"} onClick={sendResumeLink}>
            {resumeState === "sending" ? "Sending…" : "Email me a link"}
          </button>
          {resumeState === "error" && <div style={{ fontSize: 12.5, color: "#b91c1c", width: "100%" }}>Enter a valid email address.</div>}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    const id = searchParams.get("car");
    if (!id) return;
    let gone = false;
    (async () => {
      try {
        const r = await fetch(`/api/ukci-car?id=${encodeURIComponent(id)}`);
        const j = await r.json();
        if (!gone && j && j.ok && j.car) {
          setWanted({
            carId: j.car.carId ?? id,
            title: String(j.car.title),
            detail: String(j.car.detail),
            landed: Number(j.car.landedEur) || FALLBACK_CAR.landed,
          });
        }
      } catch {
        /* fallback car stays */
      }
    })();
    return () => {
      gone = true;
    };
  }, [searchParams]);

  /** whatever the customer typed, in km - the engine measures in km */
  function kmNow(): number | null {
    const n = Number(mileage.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(unit === "miles" ? n * 1.609 : n);
  }

  async function findCar() {
    if (!kmNow()) {
      setMileageMissing(true);
      return;
    }
    setMileageMissing(false);
    if (!financeNeed) {
      setFinanceMissing(true);
      return;
    }
    setFinanceMissing(false);
    const cleaned = reg.replace(/[\s-]/g, "");
    if (!cleaned) {
      setStep(2);
      return;
    }
    setLooking(true);
    try {
      const r = await fetch(`/api/reg-lookup?reg=${encodeURIComponent(cleaned)}`);
      const j = await r.json();
      if (j.found) {
        const found = { make: carCase(String(j.make)), model: carCase(String(j.model)), year: j.year };
        setCar(found);
        setLookupFailed(false);
        void priceIt(found, kmNow(), "");
        void (async () => {
          try {
            const q = new URLSearchParams({ make: found.make, model: found.model });
            const t = await fetch(`/api/trims?${q}`);
            const j = await t.json();
            setTrims(Array.isArray(j?.trims) ? j.trims : []);
          } catch { setTrims([]); }
        })();
      } else {
        setCar(null);
        setLookupFailed(true);
      }
    } catch {
      setCar(null);
      setLookupFailed(true);
    }
    setLooking(false);
    setStep(2);
  }

  /**
   * Price both routes as soon as we know the car. Failure is silent on purpose:
   * a missing figure falls back to the old "we'll come back to you" wording,
   * which is never wrong. A wrong figure on this page would be.
   */
  async function priceIt(
    c: { make: string; model: string; year: number | null } | null,
    km: number | null,
    trimNow?: string,
  ) {
    if (!c || !c.make || !c.model || !c.year || !km) { setPricing(null); return; }
    setPricingBusy(true);
    try {
      const qs = new URLSearchParams({
        make: c.make, model: c.model, year: String(c.year), km: String(km),
      });
      const tv = trimNow !== undefined ? trimNow : trim;
      if (tv) qs.set("trim", tv);
      const r = await fetch(`/api/route-pricing?${qs}`);
      const j = await r.json();
      setPricing(j?.priced ? j.pricing : null);
    } catch {
      setPricing(null);
    }
    setPricingBusy(false);
  }

  // The VLC goes through the same photo endpoint but into the protected
  // "vlc" slot: excluded from the dealer-visible listing, staff-key required
  // to view. Canvas re-encode strips EXIF the same way the guided shots do.
  async function uploadDoc(
    file: File,
    slot: "vlc_cert" | "owner_id",
    set: (s: "idle" | "working" | "done" | "error") => void,
  ) {
    set("working");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      if (!blob) throw new Error("encode failed");
      const fd = new FormData();
      fd.append("draftId", readDraftId());
      fd.append("slot", slot);
      fd.append("photo", new File([blob], slot + ".jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/tradein-photo", { method: "POST", body: fd });
      const j = (await r.json()) as { ok: boolean };
      set(j.ok ? "done" : "error");
    } catch {
      set("error");
    }
  }

  async function submitDeal() {
    setSubmitErr("");
    setSubmitting(true);
    try {
      const body = {
        draftId: readDraftId(),
        tradeIn: {
          reg: reg.replace(/[\s-]/g, "").toUpperCase(),
          mileage: Number(mileage.replace(/\D/g, "")) || null,
          mileageUnit: unit,
          make: car ? car.make : manualMake.trim(),
          model: car ? car.model : manualModel.trim(),
          year: car ? car.year : null,
          lookupSource: car ? "nvf" : "manual",
          financeOutstanding: finance,
          financeNeed,
          settlementEur: finance === "yes" ? settle : 0,
          nct,
          serviceHistory: history,
          damage,
          damageNote: damage === "Something to mention" ? damageNote.trim() : "",
          route,
          trim,
          thirdPartyOptOut,
          disclosures: disc,
          disclosureNotes: discText,
          adLink: adLink.trim(),
          vrcHolder,
          vrcHolderName: vrcHolder === "me" || vrcHolder === "" ? "" : vrcHolderName.trim(),
          ownerConsent: vrcHolder === "me" ? true : ownerConsent,
        },
        // Only send an import car when a REAL one arrived via ?car=. The
        // placeholder Sportage used to travel on every submission, so a seller
        // who never picked a car showed up in the admin wanting one (owner,
        // 31 Aug: "what the fuck is that in the red box"). The API fills in a
        // neutral "no import selected yet" record when this is null.
        wanted: wanted.carId
          ? {
              carId: wanted.carId,
              title: wanted.title,
              detail: wanted.detail,
              landedEur: wanted.landed,
            }
          : null,
        declarationName: declName.trim(),
        targetEur: target.trim() ? Number(target.replace(/\D/g, "")) || null : null,
        wantFinanceQuotes: false,
        buyer: {
          email: buyerEmail.trim(),
          phone: buyerPhone.trim(),
          name: buyerName.trim(),
          eircode: buyerEircode.trim(),
        },
      };
      const r = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j && j.ok) {
        // The draft is now sealed to a submitted deal. Clear the browser's draft
        // pointer so the NEXT trade-in from this device starts a fresh photo set
        // instead of re-attaching this car's photos (review finding, 2026-08-18).
        try {
          window.localStorage.removeItem("tradein_draft");
          window.localStorage.removeItem("tradein_draft_id");
        } catch {
          /* storage unavailable — the seal on the server still protects it */
        }
        router.push(j.statusUrl || `/trade-ins/status/${j.buyerToken}`);
        return; // keep the button in its busy state while we navigate
      }
      setSubmitErr((j && j.error) || "Something went wrong sending your car in. Try again.");
    } catch {
      setSubmitErr("Could not reach the server. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  // "Start again" must clear EVERY field, not just role/step — otherwise the
  // step-1 inputs render blank (they are uncontrolled and remount) while the old
  // reg/mileage/buyer values silently persist in state and drive the next lookup
  // and submission (review finding, 2026-08-18).
  function resetAll() {
    setStep(1);
    setRoute(null);
    setThirdPartyOptOut(false);
    setDisc({});
    setDiscText({});
    setFinance("");
    setSettle(0);
    setNct("");
    setHistory("");
    setDamage("");
    setDamageNote("");
    setShotsDone(0);
    setReg("");
    setMileage("");
    setUnit("km");
    setLooking(false);
    setCar(null);
    setLookupFailed(false);
    setManualMake("");
    setManualModel("");
    setWanted(FALLBACK_CAR);
    setTarget("");
    setBuyerName("");
    setBuyerPhone("");
    setBuyerEmail("");
    setBuyerEircode("");
    setAdLink("");
    setSubmitErr("");
  }

  // The "I'm a motor dealer" gate that used to sit here is GONE (owner, 31 Aug:
  // "don't show anything to do with a motor dealer" - this is the trade-in
  // customer's page). Do not put it back; the dealer front door is the Dealers
  // menu item pointing at /deal-builder. resetAll used to set role to null and
  // bring the gate back, which is why the state is removed entirely rather than
  // just hidden.

  return (
    <main className={L.page} style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — nothing here is agreed. Ideas only, example figures.</DraftBanner>
      <h1 style={S.h1}>Trade in your car</h1>
      <p style={S.lede}>
        Tell us the reg and the mileage, and we&rsquo;ll show you a range for your car two
        different ways &mdash; traded in against your import, or sold privately. Then your photos
        and the condition questions, and a person comes back with the offer.
      </p>

      <div className={L.split} style={S.split}>
        <div style={S.main}>
          <Steps step={step} go={setStep} />

          {step === 2 && (
            <Panel
              title="How would you like to sell your car?"
              sub="Two ways to sell it, each with a range for your exact car and mileage. Pick the one that suits you; nothing is committed by choosing."
            >
              {/* WHICH CAR WE FOUND, on the page where a wrong lookup costs most
                  (field test, 5 Sep): the confirmation used to appear only on the
                  Photos step, after the ranges had already been read. */}
              {car ? (
                <div style={{ ...S.found, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>
                    ✓ {reg.replace(/[\s-]/g, "").toUpperCase()} &mdash; {car.year ? `${car.year} ` : ""}{car.make} {car.model}
                    {kmNow() ? `, ${kmNow()!.toLocaleString("en-IE")} km` : ""}
                  </span>
                  <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#1a5fb4", textDecoration: "underline", fontSize: 12.5, cursor: "pointer", padding: 0, font: "inherit" }}>
                    Not your car? Change it
                  </button>
                </div>
              ) : lookupFailed ? (
                <div style={S.notfound}>
                  <b>We couldn&rsquo;t read that reg from the national file</b> &mdash; you can tell us the make and
                  model on the Photos step, but we cannot show a range without it.{" "}
                  <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#1a5fb4", textDecoration: "underline", fontSize: 12.5, cursor: "pointer", padding: 0, font: "inherit" }}>
                    Try the reg again
                  </button>
                </div>
              ) : null}
              {/*
                A card is a DIV, not a button, for two reasons the first version
                got wrong: a <ul> inside a <button> is invalid HTML, and a real
                <button> cannot be nested inside another button - which is what
                the visible "Choose this" control has to be. The whole card is
                still clickable, and Enter/Space work on it for the keyboard.
                OWNER, 31 Aug: "how the fuck do you pick an option and how do you
                go to the next page" - a bordered panel with no visible control
                does not read as a choice, however clickable it happens to be.
              */}
              {trims.length > 0 && (
                <div style={{ margin: "0 0 14px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
                    Which spec is it? <span style={{ fontWeight: 400, color: "#6b7280" }}>
                      (optional, but it can move the figure by a thousand or more)
                    </span>
                  </div>
                  <select
                    value={trim}
                    onChange={(e) => {
                      setTrim(e.target.value);
                      void priceIt(car, kmNow(), e.target.value);
                    }}
                    style={{
                      width: "100%", padding: "10px 12px", fontSize: 15,
                      border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff",
                    }}
                  >
                    <option value="">I&rsquo;m not sure / not listed</option>
                    {trims.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <p style={{ ...(S.sm as React.CSSProperties), marginTop: 0 }}>
                Just looking round? The step pills above open any page without picking anything.
              </p>
              {/* THE YARDSTICK, shown (owner, 5 Sep: "what does Carzone data say this
                  car is worth?"). Every range below is a share of this number, so
                  it has to be on the page or the ranges cannot be judged. */}
              {pricing && (
                <div style={{ border: "1px solid #dcdcdc", background: "#fafaf8", borderRadius: 10, padding: "12px 14px", margin: "0 0 14px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#8a8a8a" }}>
                    What Irish dealers are asking
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "2px 0" }}>{eur(pricing.retailEur)}</div>
                  <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                    The middle asking price of {pricing.comparables} {car?.year ? `${car.year} ` : ""}{car ? `${car.make} ${car.model}` : "matching"} Irish adverts right now{trim ? `, ${trim} spec` : ""}. Both ranges below are shares of this figure.
                  </div>
                </div>
              )}
              {financeNeed === "finance_house" && (
                <div style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13.2, lineHeight: 1.5 }}>
                  <b>Finance through a finance house:</b> this deal goes to one of our partner dealers, who can
                  finance the import and take your trade-in together. Selling privately is not offered on this route.
                </div>
              )}
              {ROUTES.filter((r) => !(financeNeed === "finance_house" && r.id === "privateproof")).map((r) => {
                const pick = () => { setRoute(r.id); setStep(3); };
                const on = route === r.id;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={pick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
                    }}
                    style={{ ...S.routeCard, ...(on ? S.routeCardOn : {}) }}
                  >
                    <div style={S.routeTop}>
                      <span style={S.routeName}>{r.name}</span>
                    </div>
                    <div style={S.routeMeta}>{r.when}</div>
                    {(() => {
                      // The figure, if we have one. A card with no figure keeps
                      // its original wording rather than showing a gap - the
                      // page has to read properly for the ~10% of cars with too
                      // little Irish evidence to price.
                      const rt = pricing?.routes.find(
                        (x) => x.route === (r.id === "tradein" ? "trade" : "private"),
                      );
                      if (!rt) {
                        return pricingBusy ? (
                          <div style={{ fontSize: 13, color: "#6b7280", margin: "10px 0" }}>
                            Working out what your car is worth this way&hellip;
                          </div>
                        ) : null;
                      }
                      return (
                        <div style={{
                          margin: "12px 0 10px", padding: "12px 14px",
                          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
                        }}>
                          {/* BOTH ROUTES LEAD WITH THE CONDITION RANGE - owner, 5 Sep:
                              "from no service history / issues mechanically to
                              perfect car for both routes". The OFFER is placed
                              inside it from the photos and answers at submission
                              (lib/conditionOffer.ts), not shown here. */}
                          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
                            {eur(rt.conditionLowEur)} &ndash; {eur(rt.conditionHighEur)}
                          </div>
                          {/* The two ranges are NOT the same kind of thing (field
                              test, 5 Sep). Trade: real auction outcomes, so the
                              ends are condition. Private: the spread of asking
                              prices on ads that MOVED - its bottom is a car priced
                              to go, not a faulty one, and it must not be labelled
                              as if it were. */}
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                            {r.id === "tradein" ? null : null}
                          </div>
                          <div style={{ fontSize: 12.5, color: "#475569", marginTop: 6 }}>
                            {r.id === "tradein"
                              ? "we go through your photos and your answers and come back with our offer, credited off your import on delivery day"
                              : "list it wherever you like within this range \u2014 that is your call; private buyers settle a little under the asking price"}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={S.routeBlurb}>{r.blurb}</div>
                    {r.id === "privateproof" && (
                      // the card itself is a button (click = choose this route), so the link must not bubble
                      <a href="/trade-ins/above-board-cars" onClick={(e) => e.stopPropagation()} style={S.routeMore}>
                        How Above Board Cars works &rarr;
                      </a>
                    )}
                    <ul style={S.routePoints}>
                      {r.points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                    {r.fees && (
                      <div style={S.routeFees}>
                        <div style={S.routeFeesHead}>What it costs</div>
                        <ul style={S.routeFeesList}>
                          {r.fees.map((f) => <li key={f}>{f}</li>)}
                        </ul>
                        {r.id === "privateproof" && (
                          <div style={S.routeWarr}>
                            <div style={S.routeFeesHead}>12-month warranties</div>
                            <ul style={S.routeFeesList}>
                              {WARRANTIES.map((w) => (
                                <li key={w.doc}>
                                  {w.label} &mdash; &euro;{w.price}{" "}
                                  <a href={`${WARRANTY_DOC_BASE}${w.doc}.pdf`} target="_blank" rel="noreferrer" style={S.routeWarrLink}>
                                    full cover details (PDF)
                                  </a>
                                </li>
                              ))}
                            </ul>
                            <div style={S.routeAdHead}>
                              Tell all your potential buyers on DoneDeal about the garage-like protection Above Board Cars offers &mdash; put this line in your ad:
                            </div>
                            <div style={S.routeAdLine}>&ldquo;{AD_LINE}&rdquo;</div>
                            <button
                              type="button"
                              style={S.routeAdCopy}
                              onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(AD_LINE); (e.currentTarget as HTMLButtonElement).textContent = "Copied"; }}
                            >
                              Copy the line
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={pick} style={S.routeCta}>
                      Choose this &rarr;
                    </button>
                  </div>
                );
              })}

              {/*
                THE MANUAL-CONFIRMATION PROMISE. This is the half of the owner's
                31 Aug spec that survives the 4 Sep reversal: a figure may now be
                shown, but it is an estimate and a person still sets the real
                one. Written plainly and placed with the numbers, not in small
                print underneath them, because a customer who feels a figure was
                walked back is a customer who haggles at handover - which is the
                single thing this whole flow exists to prevent.
              */}
              {pricing && (
                <div style={{
                  margin: "4px 0 16px", padding: "12px 14px", borderRadius: 10,
                  background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13.2,
                  lineHeight: 1.5, color: "#3f3f46",
                }}>
                  <b>These are ranges, measured from real sales, not offers.</b> The trade-in
                  range runs from a car with no service history and mechanical faults to a
                  perfect one; the private range is where comparable private ads that sold were
                  priced. What no data can see is your car itself &mdash; its history, its
                  condition, how it has been kept. That is what the photos and the condition
                  questions are for: <b>a person goes through them and comes back with the
                  offer</b>, usually the same working day, and it holds at handover as long as
                  the car matches what you declared. Nothing is committed until you accept it.
                </div>
              )}

              <SaveForLater />
              {/* The opt-out sits UNDER both choices - it applies either way. */}
              <div style={S.optOut}>
                <b style={{ fontSize: 13.5 }}>One more thing, whichever you pick</b>
                <p style={{ ...(S.sm as React.CSSProperties), marginTop: 6 }}>{OPT_OUT_TEXT}</p>
                <label style={S.optOutCheck}>
                  <input
                    type="checkbox"
                    checked={thirdPartyOptOut}
                    onChange={(e) => setThirdPartyOptOut(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    No thanks — don&rsquo;t offer my trade-in or my import purchase to third-party
                    garages.
                  </span>
                </label>
              </div>
            </Panel>
          )}

          {step === 1 && (
            <Panel title="What are you driving?" sub="Type the reg — the national vehicle file does the rest. Then we can show you what your car is worth each way.">
              <Field label="Registration" placeholder="191-D-12345" value={reg} onChange={setReg} />
              <Field
                label={unit === "km" ? "Mileage (kilometres)" : "Mileage (miles)"}
                placeholder={unit === "km" ? "96,000" : "60,000"}
                value={mileage}
                onChange={setMileage}
              />
              <div style={S.opts}>
                <Opt on={unit === "km"} onClick={() => setUnit("km")}>Kilometres</Opt>
                <Opt on={unit === "miles"} onClick={() => setUnit("miles")}>Miles</Opt>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Will you need finance for the import?</div>
                <div style={S.opts}>
                  <Opt on={financeNeed === "none"} onClick={() => setFinanceNeed("none")}>No</Opt>
                  <Opt on={financeNeed === "bank"} onClick={() => setFinanceNeed("bank")}>Yes, through my bank (AIB, BOI, PTSB)</Opt>
                  <Opt on={financeNeed === "finance_house"} onClick={() => setFinanceNeed("finance_house")}>Yes, through a finance house</Opt>
                </div>
                {financeNeed === "finance_house" && (
                  <p style={{ ...(S.sm as React.CSSProperties), marginTop: 6 }}>
                    Finance houses will not finance a car bought through us, so a deal like this goes straight to
                    one of our partner dealers, who can arrange it. You still get the same trade-in process.
                  </p>
                )}
                {financeMissing && (
                  <p style={{ color: "#b91c1c", fontSize: 13.5, margin: "6px 0 0" }}>
                    Tell us whether you will need finance &mdash; it decides which way we can handle your car.
                  </p>
                )}
              </div>
              {mileageMissing && (
                <p style={{ color: "#b91c1c", fontSize: 13.5, margin: "6px 0 0" }}>
                  We need the mileage &mdash; it is the biggest single thing that decides what your
                  car is worth, and we cannot show you a figure without it.
                </p>
              )}
              <button className={L.cta} style={{ ...S.cta, ...(looking ? S.ctaBusy : {}) }} disabled={looking} onClick={findCar}>
                {looking ? "Reading the national vehicle file…" : "Continue"}
              </button>
              <p style={S.sm}>No sign-up, no obligation, nothing to pay. The ranges on the next page come from real Irish sales; a person makes the offer once your photos and answers are in.</p>
            </Panel>
          )}

          {step === 3 && (
            <Panel
              title="Photograph your car"
              sub={`${SHOT_COUNT} guided shots — we show you where to point for every one. About five minutes with your phone.`}
            >
              {car && (
                <div style={S.found}>
                  ✓ {reg.replace(/[\s-]/g, "").toUpperCase()} — {car.year ? `${car.year} ` : ""}
                  {car.make} {car.model}, read from the national vehicle file.
                </div>
              )}
              {lookupFailed && (
                <div style={S.notfound}>
                  <b>We couldn&rsquo;t read that reg from the national file.</b>
                  <div style={S.sm}>No harm — tell us the make and model yourself:</div>
                  <div style={S.twoCol}>
                    <Field label="Make" placeholder="Toyota" value={manualMake} onChange={setManualMake} />
                    <Field label="Model" placeholder="Yaris" value={manualModel} onChange={setManualModel} />
                  </div>
                </div>
              )}
              <PhotoCapture groups={SHOT_GROUPS} onProgress={(d) => setShotsDone(d)} vehicle={car} />
              <button
                className={L.cta} style={{ ...S.cta, ...(shotsDone === 0 ? S.ctaWait : {}) }}
                onClick={() => setStep(4)}
              >
                {shotsDone >= SHOT_COUNT
                  ? "Continue - all photos done"
                  : shotsDone === 0
                    ? "Continue for now (photos are needed before we can make an offer)"
                    : `Continue with ${shotsDone} of ${SHOT_COUNT} photos (all ${SHOT_COUNT} needed for an offer)`}
              </button>
              <SaveForLater />
              <p style={S.sm}>
                {route === "privateproof"
                  ? "These become your advert — on this site and on DoneDeal. Good photographs are most of what sells a private car."
                  : "Good photos get a better assessment. What a buyer has already seen, he cannot use to cut the price on the day."}
              </p>
            </Panel>
          )}

          {step === 4 && (
            <Panel
              title="About the car"
              sub={
                route === "privateproof"
                  ? "Everything a buyer would ask, asked once. Anything a buyer finds out on the day becomes a haggle; declared up front, it goes on the record attached to your advert and the price you agree is the price you get."
                  : "Everything a buyer would ask, asked once. Anything found on the day becomes a haggle; tell us now and your offer is the figure you get."
              }
            >
              {/* ONE PAGE, NOT TWO (owner, 5 Sep). Paperwork, then the TradeBid
                  mechanical and condition sets. Each thing is asked exactly once:
                  service history is the three-way below, bodywork damage is the
                  three-way in the Condition block, warning lights are in
                  Mechanical. */}
              <div style={S.qlab as React.CSSProperties}>Paperwork</div>
              <div style={S.q}>
                <div style={S.qlab}>Is there finance outstanding on the car?</div>
                <div style={S.opts}>
                  <Opt on={finance === "no"} onClick={() => setFinance("no")}>No</Opt>
                  <Opt on={finance === "yes"} onClick={() => setFinance("yes")}>Yes</Opt>
                </div>
                {finance === "yes" && (
                  <div style={{ marginTop: 8 }}>
                    <Field
                      label="Amount left to settle"
                      placeholder="€8,500"
                      onChange={(v: string) => setSettle(Number(v.replace(/\D/g, "")) || 0)}
                    />
                    <p style={S.sm}>Perfectly normal — it comes off the deal rather than stopping it.</p>
                  </div>
                )}
              </div>

              <div style={S.q}>
                <div style={S.qlab}>When is the NCT due?</div>
                <div style={S.opts}>
                  {["Over 6 months", "Under 6 months", "Expired"].map((o) => (
                    <Opt key={o} on={nct === o} onClick={() => setNct(o)}>{o}</Opt>
                  ))}
                </div>
              </div>

              <div style={S.q}>
                <div style={S.qlab}>Service history</div>
                <div style={S.opts}>
                  {["Full", "Partial", "None"].map((o) => (
                    <Opt key={o} on={history === o} onClick={() => setHistory(o)}>{o}</Opt>
                  ))}
                </div>
                {(history === "Full" || history === "Partial") && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...(S.qlab as React.CSSProperties), fontWeight: 400, paddingLeft: 14, opacity: 0.9 }}>
                      — Do you have the service book or the digital record to hand?
                    </div>
                    <div style={S.opts}>
                      <Opt on={disc.service_log === "yes"} onClick={() => setD("service_log", "yes")}>Yes</Opt>
                      <Opt on={disc.service_log === "no"} onClick={() => setD("service_log", "no")}>No</Opt>
                    </div>
                  </div>
                )}
              </div>

              {DISCLOSURES.map((grp) => (
                <div key={grp.group}>
                  <div style={{ ...(S.qlab as React.CSSProperties), marginTop: 22 }}>{grp.group}</div>
                  {grp.group === "Condition" && (
                    <div style={S.q}>
                      <div style={S.qlab}>Any bodywork damage?</div>
                      <div style={S.opts}>
                        {["Nothing", "Minor marks", "Something to mention"].map((o) => (
                          <Opt key={o} on={damage === o} onClick={() => setDamage(o)}>{o}</Opt>
                        ))}
                      </div>
                      {damage === "Something to mention" && (
                        <div style={{ marginTop: 8 }}>
                          <textarea
                            style={S.textarea}
                            rows={3}
                            placeholder="A sentence is plenty — scraped bumper, dented door, kerbed alloys…"
                            value={damageNote}
                            onChange={(e) => setDamageNote(e.target.value)}
                          />
                          <p style={S.sm}>Telling us now keeps the offer you accept from shrinking on the day.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {grp.items.map((q) => {
                    const shown = !q.showIf || q.showIf(disc);
                    if (!shown) return null;
                    return (
                      <div style={S.q} key={q.id}>
                        <div style={{ ...(S.qlab as React.CSSProperties), fontWeight: q.child ? 400 : 600,
                                      paddingLeft: q.child ? 14 : 0, opacity: q.child ? 0.9 : 1 }}>
                          {q.child ? "— " : ""}{q.label}
                        </div>
                        <div style={S.opts}>
                          <Opt on={disc[q.id] === "yes"} onClick={() => setD(q.id, "yes")}>Yes</Opt>
                          <Opt on={disc[q.id] === "no"} onClick={() => setD(q.id, "no")}>No</Opt>
                        </div>
                        {q.text && q.text.showIf(disc) && (
                          <div style={{ marginTop: 8 }}>
                            <textarea
                              style={S.textarea}
                              rows={3}
                              placeholder={q.text.placeholder}
                              value={discText[q.id] || ""}
                              onChange={(e) => setT(q.id, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div style={S.q}>
                <div style={S.qlab as React.CSSProperties}>Anything else we should know?</div>
                <textarea
                  style={S.textarea}
                  rows={3}
                  placeholder="Optional — anything a buyer would want told up front."
                  value={discText.additional || ""}
                  onChange={(e) => setT("additional", e.target.value)}
                />
              </div>

              {(() => {
                const missing = DISCLOSURES.flatMap((g) => g.items)
                  .filter((q) => (!q.showIf || q.showIf(disc)) && !disc[q.id]);
                return (
                  <>
                    {missing.length > 0 && (
                      <p style={{ ...(S.sm as React.CSSProperties), color: "#b3241f" }}>
                        {`${missing.length} question${missing.length === 1 ? "" : "s"} still to answer — an unanswered question counts for nothing in your offer, so answer them all before you send.`}
                      </p>
                    )}
                    {/* Never disabled (owner, 5 Sep): the pages must be walkable
                        without filling anything in. The Send button on the last
                        page is where the record is checked. */}
                    <button className={L.cta} style={S.cta} onClick={() => setStep(5)}>
                      Continue
                    </button>
                    <button style={S.backLink} onClick={() => setStep(3)}>← Back to the photos</button>
                  </>
                );
              })()}
            </Panel>
          )}

          {/*
            The old steps 3.8 / 4.5 / 4 are GONE. They showed the customer a
            Retail/Trade figure and then asked them to choose a route off it.
            Under the owner's 31 Aug spec the choice happens at step 1 and the
            figure does not exist yet - he assesses the car and comes back with
            a plan. Do not reinstate a price step here.
          */}

          {step === 5 && (
            <Panel
              title={route === "privateproof" ? "Last thing — who you are" : "Last thing before we assess it"}
              sub="So we know the car is yours. It takes a minute."
            >
              {route === "privateproof" && (
                <div style={S.q}>
                  <div style={S.qlab as React.CSSProperties}>What would you like to ask for it?</div>
                  <Field
                    label="Your asking price (leave it blank and we’ll suggest one)"
                    placeholder="€15,000"
                    value={target}
                    onChange={setTarget}
                  />
                </div>
              )}
              <Field label="Your name" placeholder="Pat Murphy" value={buyerName} onChange={setBuyerName} />
              <Field label="Phone" placeholder="087 123 4567" value={buyerPhone} onChange={setBuyerPhone} />
              <Field label="Email address" placeholder="you@example.ie" value={buyerEmail} onChange={setBuyerEmail} />
              <Field label="Eircode" placeholder="T12 AB34" value={buyerEircode} onChange={setBuyerEircode} />
              <p style={S.sm}>Never published. If your deal is ever put to a garage they see the routing area only — the first three characters.</p>
              <Field label="Link to your ad (optional)" placeholder="donedeal.ie or adverts.ie link" value={adLink} onChange={setAdLink} />
              <p style={S.sm}>Already advertising the car yourself? Paste the link and it goes on the file with everything else.</p>
              <div style={S.upload}>
                <b>Photo of your VRC (the logbook)</b>
                <div style={S.sm}>
                  The vehicle registration certificate, showing your name as
                  registered owner. Held securely and seen only by us &mdash; we
                  check it against your details before anything goes further.
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                    Whose name is on the VRC?
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Opt on={vrcHolder === "me"} onClick={() => setVrcHolder("me")}>
                      Mine
                    </Opt>
                    <Opt on={vrcHolder === "spouse"} onClick={() => setVrcHolder("spouse")}>
                      My spouse or partner&rsquo;s
                    </Opt>
                    <Opt on={vrcHolder === "other"} onClick={() => setVrcHolder("other")}>
                      Someone else&rsquo;s
                    </Opt>
                  </div>
                  {(vrcHolder === "spouse" || vrcHolder === "other") && (
                    <div style={{ marginTop: 10 }}>
                      <Field
                        label="Their name, exactly as on the VRC"
                        placeholder="Mary Murphy"
                        value={vrcHolderName}
                        onChange={setVrcHolderName}
                      />
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={ownerConsent}
                          onChange={(e) => setOwnerConsent(e.target.checked)}
                          style={{ marginTop: 3 }}
                        />
                        <span>
                          The registered owner knows about this sale and agrees
                          to it. The dealer pays the registered owner &mdash; or
                          completes with them present &mdash; at collection.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
                <input
                  ref={vlcInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadDoc(f, "vlc_cert", setVlcStatus);
                    e.target.value = "";
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={vlcStatus === "working"}
                    onClick={() => vlcInput.current?.click()}
                    style={{ fontSize: 13, padding: "9px 14px", borderRadius: 6, border: "1px solid #1a1a1a", background: "#1a1a1a", color: "#fff", cursor: "pointer" }}
                  >
                    {vlcStatus === "done"
                      ? "Retake the photo"
                      : vlcStatus === "working"
                        ? "Uploading…"
                        : "Take a photo of the VRC"}
                  </button>
                  {vlcStatus === "done" && (
                    <span style={{ color: "#0a7d33", fontSize: 13, fontWeight: 600 }}>&#10003; received</span>
                  )}
                  {vlcStatus === "error" && (
                    <span style={{ color: "#b60b0c", fontSize: 13 }}>didn&rsquo;t upload — try again</span>
                  )}
                </div>
                <div style={{ marginTop: 16 }}>
                  <b>Photo of your own ID</b>
                  <div style={S.sm}>
                    Driving licence or passport — it confirms you are the
                    person named on the VRC. Held securely, seen only by us,
                    never published and never shown to a buyer.
                  </div>
                  <input
                    ref={idInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadDoc(f, "owner_id", setIdStatus);
                      e.target.value = "";
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={idStatus === "working"}
                      onClick={() => idInput.current?.click()}
                      style={{ fontSize: 13, padding: "9px 14px", borderRadius: 6, border: "1px solid #1a1a1a", background: "#1a1a1a", color: "#fff", cursor: "pointer" }}
                    >
                      {idStatus === "done"
                        ? "Retake the photo"
                        : idStatus === "working"
                          ? "Uploading…"
                          : "Take a photo of your ID"}
                    </button>
                    {idStatus === "done" && (
                      <span style={{ color: "#0a7d33", fontSize: 13, fontWeight: 600 }}>&#10003; received</span>
                    )}
                    {idStatus === "error" && (
                      <span style={{ color: "#b60b0c", fontSize: 13 }}>didn&rsquo;t upload — try again</span>
                    )}
                  </div>
                </div>
                <div style={S.sm}>
                  Not to hand? Send anyway — we&rsquo;ll ask for both before
                  anything goes further.
                </div>
              </div>
              <div style={{ border: "1px solid #dcdcdc", background: "#fafaf8", borderRadius: 8, padding: "12px 14px", margin: "0 0 12px" }}>
                <b style={{ fontSize: 14 }}>Declaration</b>
                <p style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0 10px" }}>
                  {vrcHolder === "spouse" || vrcHolder === "other"
                    ? `I declare that ${vrcHolderName.trim() || "the registered owner"} has authorised me to offer this car for sale, and that they will sign the change of ownership at collection.`
                    : "I declare that I am the registered owner of this car and that I am entitled to sell it."}
                </p>
                <Field
                  label="Type your full name to sign"
                  placeholder="Pat Murphy"
                  value={declName}
                  onChange={setDeclName}
                />
                <p style={S.sm}>
                  Typing your name here acts as your signature — it is recorded
                  with the date and time.
                </p>
              </div>
              <div style={{ border: "1px solid #f0dfae", background: "#fffdf4", color: "#7a5a00", borderRadius: 8, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
                <b>The description guarantee.</b>{" "}
                {route === "privateproof"
                  ? "Your answers are what a private buyer trusts. They travel with the advert as a condition record, and the inspection checks them. If something substantive wasn't disclosed — accident damage, warning lights, mileage, finance owing, or the car not driving — the buyer can withdraw and the escrow returns their money. Honest mistakes about wear and condition never trigger it."
                  : "Your answers are guaranteed, which is what lets a figure be given without haggling over it later. If everything matches when the car is collected, the figure can't change at the door. If something substantive wasn't disclosed — accident damage, warning lights, mileage, finance owing, or the car not driving — a revised figure may be proposed, and it is your choice whether to accept it. Honest mistakes about wear and condition never trigger it."}
              </div>
              {/* NO OFFER ON THIS PAGE (owner, 5 Sep: he prices the car himself
                  after seeing the photos and answers). The private route gets
                  its range back as a reminder - what they list at is their call. */}
              {route === "privateproof" && (() => {
                const rt = pricing?.routes.find((x) => x.route === "private");
                if (!rt) return null;
                return (
                  <div style={{ border: "1px solid #dcdcdc", background: "#fafaf8", borderRadius: 10, padding: "12px 14px", margin: "0 0 14px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#8a8a8a" }}>Your range</div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "2px 0" }}>{eur(rt.conditionLowEur)} &ndash; {eur(rt.conditionHighEur)}</div>
                    <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                      Where comparable private ads that actually sold were priced &mdash; the bottom went quickly, the top waited for the right buyer. What you list it at is your call.
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const need = stillNeeded();
                return need.length ? (
                  <div style={{ margin: "8px 0 12px", padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 13.2, lineHeight: 1.5 }}>
                    <b>Before we can make an offer we still need:</b>
                    <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>{need.map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                ) : null;
              })()}
              {submitErr && <div style={S.err}>{submitErr}</div>}
              <button
                className={L.cta}
                style={{ ...S.cta, ...(submitting || stillNeeded().length ? S.ctaBusy : {}) }}
                disabled={submitting || stillNeeded().length > 0}
                onClick={submitDeal}
              >
                {submitting
                  ? "Sending…"
                  : route === "privateproof"
                    ? "Send it in and get my advert built"
                    : "Send my car in"}
              </button>
              <p style={S.sm}>
                {route === "privateproof"
                  ? "Nothing to pay and nothing committed. Next you list it on DoneDeal — we show you exactly how."
                  : "Nothing to pay and nothing committed. We go through your photos and answers and come back to you with our offer."}
              </p>
              <SaveForLater />
              <button style={S.backLink} onClick={() => setStep(4)}>← Back to the car questions</button>
            </Panel>
          )}

          {/*
            Route is picked at step 1, so from step 2 onward this box is always
            describing the pathway the customer is actually on. The old version
            showed dealer-bidding copy while they were still choosing, which
            pre-empted the choice (owner, 31 Aug).
          */}
          <div style={S.after}>
            <b style={S.afterT}>What happens next</b>
            {route === "privateproof" ? (
              <ol style={S.ol}>
                <li>We build your advert from your photographs and your condition record, and list it here.</li>
                <li>You advertise it on DoneDeal as well, and send anyone who calls the Above Board Cars link.</li>
                <li>The inspection, the warranty and the payment run through us. <b>You stay the seller and you keep driving the car.</b></li>
              </ol>
            ) : route === "tradein" ? (
              <ol style={S.ol}>
                <li>We go through your photographs and your answers.</li>
                <li><b>We come back to you with our offer</b>, usually the same working day. Nothing is committed until you say yes.</li>
                <li>The allowance comes off your import and you hand over the keys on delivery day.</li>
              </ol>
            ) : (
              <ol style={S.ol}>
                <li>The reg and the mileage &mdash; that is all we need to show you a range for each way of selling.</li>
                <li>Pick how you want to sell it, with both ranges in front of you.</li>
                <li>Spec, photographs and the condition questions — about five minutes.</li>
                <li>Trading in: a person goes through it and comes back with the offer. Selling privately: you list it within the range at whatever you choose.</li>
              </ol>
            )}
          </div>
        </div>

        {/* the running number, always visible */}
        {/* the running-valuation sidebar was removed on the owner's instruction, 31 Aug */}
      </div>
      <button style={S.back} onClick={resetAll}>&larr; Start again</button>
    </main>
  );
}

function Steps({ step, go }: { step: number; go: (n: number) => void }) {
  // Six steps. The CAR comes first now (owner, 4 Sep): no route can show a
  // number before we know what the car is, and the whole point of the new
  // order is that the choice is made with the two figures visible. Keep this
  // list in step with the panels above - a breadcrumb that disagrees with the
  // flow is its own kind of broken (owner, 31 Aug).
  // EVERY PILL IS A BUTTON (owner, 5 Sep: "I need to be able to scroll through
  // the pages without fulfilling the criteria") - any step can be opened at
  // any time. Nothing is validated until the final Send, and the server
  // validates that, so walking the pages empty can never submit an empty deal.
  // Five since 5 Sep: "About the car" and "Condition" were one set of questions
  // split over two pages, with the same things asked twice.
  const names = ["Your car", "How to sell", "Photos", "About the car", "You"];
  return (
    <div className={L.steps} style={S.steps}>
      {names.map((n, i) => (
        <button
          key={n}
          type="button"
          onClick={() => go(i + 1)}
          style={{ ...S.stepPill, cursor: "pointer", border: "none", font: "inherit",
                   ...(i + 1 === step ? S.stepOn : i + 1 < step ? S.stepDone : {}) }}
        >
          {i + 1 < step ? "✓ " : ""}{n}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, sub, children }: any) {
  return (
    <div style={S.card}>
      <div style={S.pad}>
        <h2 style={S.h2}>{title}</h2>
        <p style={S.sub}>{sub}</p>
        {children}
      </div>
    </div>
  );
}

// CONTROLLED when a value is passed (field test, 5 Sep): the panels remount
// every time a step pill is pressed, and an uncontrolled input came back
// EMPTY while the state behind it still held the old text - the customer
// re-typed their name, or thought the reg had been lost. Pass the state in
// and the field shows what the record holds.
function Field({ label, placeholder, value, onChange }: { label: string; placeholder?: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <label style={S.field}>
      <span style={S.flab}>{label}</span>
      <input
        style={S.input}
        placeholder={placeholder}
        {...(value !== undefined ? { value } : {})}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

function Opt({ on, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{ ...S.opt, ...(on ? S.optOn : {}) }}>{children}</button>
  );
}

const S: any = {
  // the three plain benefits/costs under each pathway - what makes the choice a
  // real trade-off rather than two adverts
  // listStyle is set explicitly: the site's global reset strips markers, and
  // without them these read as floating lines rather than a list.
  routePoints: { margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "#555",
                 lineHeight: 1.7, listStyle: "disc" },
  // the third-party-garage opt-out. Quiet, under both cards, applies either way.
  optOut: { border: "1px solid #e6e6e6", background: "#fbfbf9", borderRadius: 10,
            padding: "14px 16px", marginTop: 20 },
  optOutCheck: { display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13,
                 lineHeight: 1.5, cursor: "pointer", marginTop: 10 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline",
              fontSize: 16, fontWeight: 700 },
  priceNote: { fontSize: 12, color: "#6a6a6a", marginTop: 2 },
  // The dealer route is deliberately styled DOWN - it is the fallback the owner
  // described ("if these don't work we may approach a dealer"), not a third
  // headline option competing with the customer's own two.
  fallback: { border: "1px dashed #d8d8d8", background: "#fafafa", borderRadius: 10,
              padding: "14px 16px", marginTop: 18 },
  fallbackBtn: { marginTop: 10, background: "none", border: "1px solid #cfcfcf",
                 borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer",
                 font: "inherit", color: "#333" },
  // Whole card is the tap target. On a phone a small radio beside a paragraph is
  // a miss waiting to happen, and this is the one decision the page exists for.
  // But the card ALSO carries a real red button - a tap target you cannot see is
  // the same as no tap target at all (owner, 31 Aug).
  routeCard: { display: "block", width: "100%", textAlign: "left", cursor: "pointer",
               border: "1px solid #e2e2e2", borderRadius: 10, background: "#fff",
               padding: "14px 16px", marginTop: 12, font: "inherit" },
  routeCardOn: { border: "2px solid #b60b0c", background: "#fffafa", padding: "13px 15px" },
  routeFees: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", margin: "2px 0 12px" },
  routeFeesHead: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "#334155", marginBottom: 4 },
  routeFeesList: { margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155", lineHeight: 1.5 },
  routeWarr: { marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" },
  routeWarrLink: { color: "#b60b0c", textDecoration: "underline", whiteSpace: "nowrap" },
  routeMore: { display: "inline-block", margin: "2px 0 10px", color: "#b60b0c", fontWeight: 700, fontSize: 13.5, textDecoration: "underline" },
  routeAdHead: { fontSize: 14, fontWeight: 800, color: "#111", margin: "10px 0 6px", lineHeight: 1.4 },
  routeAdLine: { fontSize: 13, color: "#111", fontStyle: "italic", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "8px 10px", lineHeight: 1.5 },
  routeAdCopy: { marginTop: 6, padding: "6px 12px", border: "1px solid #b60b0c", background: "#fff", color: "#b60b0c", borderRadius: 6, fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  routeCta: { background: "#b60b0c", color: "#fff", border: "none", borderRadius: 6,
              padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              marginTop: 14, fontFamily: "inherit" },
  routeTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline",
              gap: 10, flexWrap: "wrap" },
  routeName: { fontSize: 15.5, fontWeight: 700, color: "#161616" },
  routeMoney: { fontSize: 17, fontWeight: 800, color: "#0a7d33", whiteSpace: "nowrap" },
  routeMeta: { fontSize: 12.5, color: "#6a6a6a", marginTop: 4, fontWeight: 600 },
  routeBlurb: { fontSize: 13.5, color: "#3d3d3d", lineHeight: 1.55, marginTop: 8 },
  valueBox: { border: "1px solid #bfe0c6", background: "#f4faf5", borderRadius: 10,
              padding: "14px 16px", marginBottom: 4 },
  backLink: { display: "block", marginTop: 12, background: "none", border: "none",
              color: "#6a6a6a", fontSize: 13, cursor: "pointer", padding: 0, font: "inherit" },
  page: { maxWidth: 1080, margin: "0 auto", padding: "22px 16px 60px", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#1a1a1a" },
  banner: { background: "#fff8e6", border: "1px solid #f0dfae", color: "#9a6a00", fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 6, marginBottom: 18 },
  h1: { fontSize: 30, margin: "0 0 8px", letterSpacing: "-.6px" },
  lede: { fontSize: 15.5, color: "#555", margin: "0 0 22px", maxWidth: 620, lineHeight: 1.55 },
  choice: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 },
  choiceBtn: { textAlign: "left", border: "1px solid #dcdcdc", background: "#fff", borderRadius: 10, padding: "20px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6, fontSize: 16 },
  // layout lives in tradein_layout.module.css - it needs media queries,
  // which an inline style cannot express. Do not put grid-template back here.
  split: {},
  main: { minWidth: 0 },
  aside: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fafaf8", padding: "16px 18px" },
  asideCar: { fontSize: 13.5, fontWeight: 700, letterSpacing: ".02em", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #e2e2e2" },
  steps: {},
  stepPill: { fontSize: 11.5, padding: "5px 11px", borderRadius: 999, background: "#f0f0ee", color: "#888" },
  stepOn: { background: "#1a1a1a", color: "#fff", fontWeight: 700 },
  stepDone: { background: "#eef4ee", color: "#0a7d33", fontWeight: 600 },
  card: { border: "1px solid #dcdcdc", borderRadius: 10, background: "#fff" },
  pad: { padding: "20px 20px 22px" },
  h2: { fontSize: 20, margin: "0 0 6px", letterSpacing: "-.3px" },
  sub: { fontSize: 13.5, color: "#666", margin: "0 0 16px", lineHeight: 1.55 },
  field: { display: "block", marginBottom: 12 },
  flab: { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  input: { width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", fontSize: 15, fontFamily: "inherit" },
  textarea: { width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical" },
  cta: { background: "#b60b0c", color: "#fff", border: "none", borderRadius: 6, padding: "12px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", marginTop: 6 },
  ctaBusy: { opacity: 0.7, cursor: "wait" },
  sm: { fontSize: 12.5, color: "#6a6a6a", lineHeight: 1.55, marginTop: 8 },
  found: { border: "1px solid #bfe0c6", background: "#f4faf5", color: "#0a7d33", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 },
  notfound: { border: "1px solid #f0dfae", background: "#fffdf4", borderRadius: 8, padding: "12px 14px", fontSize: 13.5, marginBottom: 14 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  shotGroup: { marginBottom: 14 },
  shotGroupLab: { fontSize: 12.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#555", marginBottom: 6 },
  shotCount: { fontWeight: 500, color: "#999", textTransform: "none", letterSpacing: 0, marginLeft: 6 },
  shots: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 4 },
  shot: { border: "1px dashed #c8c8c8", borderRadius: 8, padding: "14px 10px", fontSize: 12.5, textAlign: "center", color: "#777" },
  shotDone: { borderStyle: "solid", borderColor: "#0a7d33", color: "#0a7d33", background: "#f4faf5", fontWeight: 600 },
  ctaWait: { background: "#fff", color: "#555", border: "1px solid #ccc" },
  damageBox: { border: "1px solid #e8c9c9", background: "#fdf7f7", borderRadius: 8, padding: "14px 16px", fontSize: 13.5, margin: "4px 0 10px" },
  q: { borderTop: "1px solid #eee", paddingTop: 14, marginTop: 14 },
  qlab: { fontSize: 14, fontWeight: 600, marginBottom: 8 },
  opts: { display: "flex", gap: 8, flexWrap: "wrap" },
  opt: { border: "1px solid #ccc", background: "#fff", borderRadius: 999, padding: "7px 15px", fontSize: 13, cursor: "pointer" },
  optOn: { background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a", fontWeight: 600 },
  carRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "1px solid #eee", borderRadius: 8, padding: "14px 16px" },
  check: { display: "flex", gap: 9, alignItems: "center", fontSize: 14, margin: "14px 0 4px" },
  upload: { border: "1px dashed #c8c8c8", borderRadius: 8, padding: "16px", marginBottom: 6, marginTop: 8 },
  err: { border: "1px solid #e8b4b4", background: "#fdf3f3", color: "#b60b0c", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, marginTop: 10 },
  after: { marginTop: 18, border: "1px solid #e6e6e6", borderRadius: 10, padding: "16px 18px", background: "#fbfbf9" },
  afterT: { fontSize: 13.5 },
  ol: { margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, color: "#555", lineHeight: 1.75, listStyle: "decimal" },
  lab: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#8a8a8a" },
  big: { fontSize: 30, fontWeight: 700, letterSpacing: "-.8px", margin: "4px 0" },
  hr: { border: "none", borderTop: "1px solid #e2e2e2", margin: "14px 0" },
  row: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" },
  total: { display: "flex", justifyContent: "space-between", borderTop: "1px solid #ddd", marginTop: 8, paddingTop: 8, fontSize: 16, fontWeight: 700 },
  pill: { display: "inline-block", fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: "#eef4ee", color: "#0a7d33", fontWeight: 600, marginTop: 10 },
  back: { background: "none", border: "none", color: "#1a5fb4", textDecoration: "underline", fontSize: 13, marginTop: 18, cursor: "pointer", padding: 0 },
};
