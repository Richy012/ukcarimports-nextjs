import { NextRequest, NextResponse } from "next/server";

// Resolve a UKCI car into the ONLY three things the Deal Builder is allowed
// to know about it: a title, a one-line detail, and the all-in landed price.
// No cost stack, no margin, no fee fields — they do not exist here (hard
// rule 2). The public API is the source; field names are probed defensively
// because the two public endpoints do not share an exact shape.

export const runtime = "nodejs";

const API_BASE = "https://api.ukcarimports.ie";
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const TIMEOUT_MS = 10000;

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Unwrap { car: {...} } / { data: [...] } / [...] into the car object itself. */
function unwrap(j: unknown): Record<string, unknown> | null {
  if (Array.isArray(j)) {
    const first: unknown = j[0];
    return first && typeof first === "object" && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : null;
  }
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  for (const k of ["car", "data", "result", "vehicle"]) {
    const v = o[k];
    if (Array.isArray(v)) {
      const first: unknown = v[0];
      if (first && typeof first === "object" && !Array.isArray(first)) {
        return first as Record<string, unknown>;
      }
    } else if (v && typeof v === "object") {
      return v as Record<string, unknown>;
    }
  }
  return o;
}

/** Lowercase-keyed view so field probing is case-insensitive. */
function lower(o: Record<string, unknown>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) m[k.toLowerCase()] = v;
  return m;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[€£,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickStr(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (k in o) {
      const n = toNum(o[k]);
      if (n != null) return n;
    }
  }
  return null;
}

function mapCar(
  j: unknown,
  id: string,
): { carId: string; title: string; detail: string; landedEur: number } | null {
  const raw = unwrap(j);
  if (!raw) return null;
  const o = lower(raw);

  // Verified live against /public/get-car2new/{id} on 2026-08-18: the payload's
  // `make`/`model` are NUMERIC CODES ("91"/"2104") — the readable names live in
  // make_name/model_name and car_name. Probe those first, never the codes.
  const year = pickNum(o, ["year", "car_year", "reg_year"]);
  const make = pickStr(o, ["make_name", "car_make"]);
  const model = pickStr(o, ["model_name", "car_model"]);
  const name = pickStr(o, ["car_name", "carname", "title", "name"]);

  const title =
    name ||
    (year != null && make && model
      ? `${Math.round(year)} ${make} ${model}`
      : [year != null ? Math.round(year) : "", make, model].filter(Boolean).join(" "));

  // mileage_km first: the bare `mileage` field is MILES as a display string.
  const mileage = pickNum(o, ["mileage_km", "plain_mileage_km", "odometer_km"]);
  const fuel = pickStr(o, ["fuel_type_name", "fuel_type", "fuel"]);
  const trans = pickStr(o, ["transmission_name", "transmission_type", "transmission"]);
  const detail = [
    mileage != null ? Math.round(mileage).toLocaleString("en-IE") + " km" : "",
    fuel.toLowerCase(),
    trans.toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");

  // The all-in landed price is computed_final_price_v2 and ONLY that column —
  // the same payload also carries a stale `final_price` from the old vrt_details
  // table (proven €441 wrong on a live car on 2026-08-18). Guessing at price
  // fields here would quote a customer the wrong number, so if the real column
  // is missing we fail rather than fall back.
  const landed = pickNum(o, ["computed_final_price_v2"]);

  if (!title || landed == null || !(landed > 0)) return null;
  return { carId: id, title, detail, landedEur: Math.round(landed) };
}

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!ID_RE.test(id)) return bad("bad car id");

  // Verified live 2026-08-18: this is the endpoint the live site itself uses.
  const car = mapCar(await fetchJson(`${API_BASE}/public/get-car2new/${encodeURIComponent(id)}`), id);
  if (!car) return bad("car not found", 404);

  return NextResponse.json(
    { ok: true, car },
    { headers: { "Cache-Control": "no-store" } },
  );
}
