import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { readOnly } from "../../../lib/dealstore";
import { valueTradeIn } from "../../../lib/valuation";
import { priceRoutes } from "../../../lib/routePricing";

/**
 * Valuation REQUESTS for the staff Trade-ins page — owner, 19 Sep 2026:
 * "a section in the trade-ins below actual trade in submissions which lists
 * all the valuation requests".
 *
 * A request is a trade-in draft (uploads/tradein/<id>/answers.json, written
 * by the page's autosave) that carries a reg or a looked-up car and has NOT
 * become a submitted deal — those are listed above as submissions. For each
 * one: when, reg, mileage, the car the lookup returned, how far they got,
 * the route they chose, whether they said the price was fair and what they
 * expected, the import car they arrived from (car-page handoff), and the
 * ranges re-priced now with the same engine the page used.
 *
 * Same staff gate as /api/staff-tradeins; never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = `${process.cwd()}/uploads/tradein`;
const SAFE_DRAFT = /^[a-z0-9]{12,32}$/;
const MAX_ROWS = 300;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "X-Auth-Token",
};

const STEP_LABEL: Record<number, string> = {
  1: "reg entered",
  2: "range shown",
  3: "photos",
  4: "condition",
  5: "details",
};

type Row = {
  draftId: string;
  savedAt: string;
  reg: string;
  km: number | null;
  car: string;
  year: number | null;
  make: string;
  model: string;
  trim: string;
  step: number | null;
  stepLabel: string;
  route: string;
  fair: string;
  fairExpectedEur: number | null;
  wantedCarId: string;
  wantedTitle: string;
  wantedLandedEur: number | null;
  retailEur: number | null;
  comparables: number;
  tradeLowEur: number | null;
  tradeHighEur: number | null;
  tradeMedianEur: number | null;
  privateLowEur: number | null;
  privateHighEur: number | null;
  unpriced: string;
};

const s = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown) => {
  const x = Number(typeof v === "string" ? v.replace(/[^0-9.]/g, "") : v);
  return Number.isFinite(x) && x > 0 ? Math.round(x) : null;
};

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-auth-token") || "";
  if (!token) return NextResponse.json({ ok: false, error: "staff only" }, { status: 401, headers: NO_STORE });

  let staff = false;
  try {
    const r = await fetch("https://api.ukcarimports.ie/public/user/get-leads", {
      headers: { "X-Auth-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    staff = r.status === 200;
  } catch {
    staff = false;
  }
  if (!staff) return NextResponse.json({ ok: false, error: "staff only" }, { status: 403, headers: NO_STORE });

  // drafts that became deals are submissions, listed elsewhere
  const sealed = await readOnly((db) => new Set(db.deals.map((d) => d.draftId)));

  let ids: string[] = [];
  try {
    ids = (await readdir(ROOT)).filter((d) => SAFE_DRAFT.test(d) && !sealed.has(d));
  } catch {
    return NextResponse.json({ ok: true, requests: [] }, { headers: NO_STORE });
  }

  const found: { id: string; mtime: number }[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const st = await stat(path.join(ROOT, id, "answers.json"));
        found.push({ id, mtime: st.mtimeMs });
      } catch {
        /* a photo-only draft with no answers yet */
      }
    }),
  );
  found.sort((a, b) => b.mtime - a.mtime);

  const rows: Row[] = [];
  for (const { id, mtime } of found.slice(0, MAX_ROWS)) {
    let a: Record<string, unknown>;
    let savedAt = new Date(mtime).toISOString();
    try {
      const j = JSON.parse(await readFile(path.join(ROOT, id, "answers.json"), "utf8"));
      a = (j && typeof j.answers === "object" && j.answers) || {};
      if (typeof j.savedAt === "string") savedAt = j.savedAt;
    } catch {
      continue;
    }
    const car = (a.car && typeof a.car === "object" ? (a.car as Record<string, unknown>) : {}) as Record<string, unknown>;
    const reg = s(a.reg, 16).replace(/[\s-]/g, "").toUpperCase();
    const make = s(car.make, 40);
    const model = s(car.model, 40);
    const year = Number.isInteger(car.year) ? (car.year as number) : null;
    if (!reg && !(make && model)) continue; // nothing typed yet

    const rawKm = n(a.mileage);
    const km = rawKm ? (a.unit === "miles" ? Math.round(rawKm * 1.609) : rawKm) : null;
    const trim = s(a.trim, 40);
    const step = typeof a.step === "number" ? a.step : null;

    const row: Row = {
      draftId: id,
      savedAt,
      reg,
      km,
      car: [year ? String(year) : "", make, model].filter(Boolean).join(" "),
      year,
      make,
      model,
      trim,
      step,
      stepLabel: step != null ? STEP_LABEL[step] || String(step) : "—",
      route: a.route === "privateproof" ? "private" : a.route === "tradein" ? "trade-in" : "",
      fair: s(a.fair, 10),
      fairExpectedEur: n(a.fairExpected),
      wantedCarId: s(a.wantedCarId, 40),
      wantedTitle: s(a.wantedTitle, 120),
      wantedLandedEur: n(a.wantedLandedEur),
      retailEur: null,
      comparables: 0,
      tradeLowEur: null,
      tradeHighEur: null,
      tradeMedianEur: null,
      privateLowEur: null,
      privateHighEur: null,
      unpriced: "",
    };

    if (make && model && year && km) {
      try {
        const val = await valueTradeIn(make, model, year, km, trim ? trim.toUpperCase() : null);
        row.retailEur = val.estimateEur ?? null;
        row.comparables = val.comparables ?? 0;
        const pr = await priceRoutes(make, model, year, km, val.estimateEur, val.comparables);
        if (pr) {
          for (const r of pr.routes) {
            if (r.route === "trade") {
              row.tradeLowEur = r.conditionLowEur;
              row.tradeHighEur = r.conditionHighEur;
              row.tradeMedianEur = r.medianEur ?? null;
            } else if (r.route === "private") {
              row.privateLowEur = r.conditionLowEur;
              row.privateHighEur = r.conditionHighEur;
            }
          }
        } else {
          row.unpriced = "not enough Irish evidence";
        }
      } catch {
        row.unpriced = "pricing failed";
      }
    } else {
      row.unpriced = !km ? "no mileage" : "no car";
    }
    rows.push(row);
  }

  return NextResponse.json({ ok: true, requests: rows }, { headers: NO_STORE });
}
