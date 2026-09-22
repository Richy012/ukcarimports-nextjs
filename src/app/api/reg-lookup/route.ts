import { NextRequest, NextResponse } from "next/server";

/**
 * Reg lookup for the trade-in flow (STAGING).
 *
 * Reads make/model for an Irish reg from motortax.ie's public
 * change-of-vehicle-details search — the same three requests a browser makes:
 * front page (session), form page (one-time Struts token), then the reg POST.
 * Year is decoded from the reg itself, so no second source is needed.
 *
 * Volume is a handful of manual lookups a day. If this ever fronts real
 * traffic, move to a licensed NVDF provider (Cartell / MotorCheck).
 *
 * PROTECTING THE SOURCE (owner, 22 Sep 2026: "I am worried ... motortax.ie
 * will stop us"). Our own use is 11-20 lookups a day, three requests each,
 * which is nothing; the exposure is that this address is public, so a
 * stranger could run thousands through it in our name. Three guards, in
 * order of how much traffic they remove:
 *
 *   1. ANSWERED ONCE, NEVER ASKED AGAIN. A reg's make and model never
 *      change, so every successful answer is kept on disk for good and
 *      served from there. Repeat lookups cost motortax nothing.
 *   2. PER VISITOR: 3 new regs a day (owner, 22 Sep). A person valuing their
 *      own car and a relative's is fine; a script is not. Keyed on the real
 *      client address (Cloudflare sits in front, so CF-Connecting-IP).
 *   3. A DAILY CEILING of 400 across the whole site - twenty times the
 *      busiest day we have ever had. Past it we stop asking until midnight.
 *
 * When a guard trips we answer `found: false`, which is the same answer an
 * unreadable reg gets, and the page already handles it: the customer types
 * the make and model themselves on the Photos step. Nobody is blocked from
 * selling us a car; we just stop asking motortax.
 */

export const dynamic = "force-dynamic";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const STORE = `${process.cwd()}/uploads/reglookup`;
const CACHE_FILE = path.join(STORE, "cache.json");
const COUNT_FILE = path.join(STORE, "daily.json");
const PER_IP_PER_DAY = 3;
const DAILY_CEILING = 400;

type Hit = { make: string; model: string; year: number | null };

let cache: Record<string, Hit> | null = null;
let cacheDirty = false;

async function loadCache(): Promise<Record<string, Hit>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8")) as Record<string, Hit>;
  } catch {
    cache = {};
  }
  return cache;
}

async function remember(reg: string, hit: Hit) {
  const c = await loadCache();
  c[reg] = hit;
  cacheDirty = true;
  try {
    await mkdir(STORE, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(c), "utf8");
    cacheDirty = false;
  } catch {
    /* a cache that cannot be written is not a reason to fail the lookup */
  }
}

/** per-address, in memory: a restart forgives everyone, which is the right way round */
const seen = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const arr = (seen.get(ip) || []).filter((t) => now - t < 24 * 60 * 60 * 1000);
  if (arr.length >= PER_IP_PER_DAY) {
    seen.set(ip, arr);
    return true;
  }
  arr.push(now);
  seen.set(ip, arr);
  return false;
}

/** the day's total, on disk so a deploy cannot reset it */
async function dayCountUp(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  let rec: { day: string; n: number } = { day: today, n: 0 };
  try {
    const j = JSON.parse(await readFile(COUNT_FILE, "utf8"));
    if (j && j.day === today && typeof j.n === "number") rec = j;
  } catch {
    /* first call of the day */
  }
  rec.n += 1;
  try {
    await mkdir(STORE, { recursive: true });
    await writeFile(COUNT_FILE, JSON.stringify(rec), "utf8");
  } catch {
    /* counting is best-effort; never fail a lookup over it */
  }
  return rec.n;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

const BASE = "https://www.motortax.ie";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function collectCookies(res: Response, jar: Map<string, string>) {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const raw =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : (res.headers.get("set-cookie") || "").split(/,(?=[^;]+?=)/).filter(Boolean);
  for (const line of raw) {
    const pair = line.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function fetchJar(url: string, jar: Map<string, string>, init?: RequestInit): Promise<Response> {
  let current = url;
  let opts: RequestInit | undefined = init;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, {
      ...opts,
      headers: {
        "User-Agent": UA,
        ...((opts?.headers as Record<string, string>) || {}),
        ...(jar.size ? { Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    collectCookies(res, jar);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      opts = undefined; // redirects continue as plain GETs
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}

// 131-format (2013 on): first two digits are the year, third is the half.
// Two-digit format: 87-99 → 1900s, 00-12 → 2000s.
function yearFromReg(reg: string): number | null {
  const m = reg.match(/^(\d{2,3})[A-Z]/);
  if (!m) return null;
  const d = m[1];
  if (d.length === 3) {
    const yy = Number(d.slice(0, 2));
    if (yy >= 13 && (d[2] === "1" || d[2] === "2")) return 2000 + yy;
    return null;
  }
  const yy = Number(d);
  if (yy >= 87) return 1900 + yy;
  if (yy <= 12) return 2000 + yy;
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("reg") || "";
  const reg = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^\d{2,3}[A-Z]{1,2}\d{1,6}$/.test(reg)) {
    return NextResponse.json({ found: false, error: "bad_reg" }, { status: 400 });
  }
  const year = yearFromReg(reg);

  // 1. already answered once — no request to motortax at all
  const known = (await loadCache())[reg];
  if (known) {
    return NextResponse.json({ found: true, reg, make: known.make, model: known.model, year: known.year ?? year, cached: true });
  }
  // 2. this visitor has asked enough for one day
  if (tooMany(clientIp(req))) {
    return NextResponse.json({ found: false, year, error: "rate_limited" });
  }
  // 3. the whole site has asked enough for one day
  if ((await dayCountUp()) > DAILY_CEILING) {
    return NextResponse.json({ found: false, year, error: "daily_cap" });
  }

  try {
    const jar = new Map<string, string>();
    await fetchJar(`${BASE}/OMT/omt.do`, jar);

    const formRes = await fetchJar(`${BASE}/OMT/pse/pseVehicleSearch.do?page=change_vehicle_details`, jar, {
      headers: { Referer: `${BASE}/OMT/omt.do` },
    });
    const formHtml = await formRes.text();
    const token = formHtml.match(/TOKEN" value="([a-f0-9]+)"/)?.[1];
    if (!token) return NextResponse.json({ found: false, year, error: "no_token" });

    const postRes = await fetchJar(`${BASE}/OMT/pse/pseVehicleSearchReceiving.do`, jar, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${BASE}/OMT/pse/pseVehicleSearch.do?page=change_vehicle_details`,
      },
      body: new URLSearchParams({
        "org.apache.struts.taglib.html.TOKEN": token,
        requestType: "change_vehicle_details",
        vehicleRegistrationNumber: reg,
      }).toString(),
    });
    const html = await postRes.text();

    const afterLabel = html.split("Vehicle Details:")[1];
    if (!afterLabel) return NextResponse.json({ found: false, year });
    const cell = afterLabel.split("</tr>")[0] || "";
    const text = cell
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const m = text.match(/^(.*?)\s*\/\s*(.*)$/);
    if (!m || !m[1]) return NextResponse.json({ found: false, year });

    const hit = { make: m[1].trim(), model: (m[2] || "").trim(), year };
    await remember(reg, hit);
    return NextResponse.json({ found: true, reg, ...hit });
  } catch {
    return NextResponse.json({ found: false, year, error: "lookup_failed" });
  }
}
