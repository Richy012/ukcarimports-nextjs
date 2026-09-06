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
 */

export const dynamic = "force-dynamic";

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

    return NextResponse.json({ found: true, reg, make: m[1].trim(), model: (m[2] || "").trim(), year });
  } catch {
    return NextResponse.json({ found: false, year, error: "lookup_failed" });
  }
}
