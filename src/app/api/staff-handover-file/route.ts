import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Serves one image of a handover (car, person or signature) to STAFF only.
 * The admin page fetches it with the staff token and shows it as a blob URL,
 * so customer photos never sit at an open address.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = `${process.cwd()}/uploads/handover`;
const SAFE_ID = /^[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$/;
const FILES: Record<string, { name: string; type: string }> = {
  car: { name: "car.jpg", type: "image/jpeg" },
  person: { name: "person.jpg", type: "image/jpeg" },
  signature: { name: "signature.png", type: "image/png" },
};

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "X-Auth-Token",
};

async function isStaff(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-auth-token") || "";
  if (!token) return false;
  try {
    const r = await fetch("https://api.ukcarimports.ie/public/user/get-leads", {
      headers: { "X-Auth-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await isStaff(req))) return NextResponse.json({ ok: false, error: "staff only" }, { status: 403, headers: NO_STORE });
  const id = req.nextUrl.searchParams.get("id") || "";
  const f = FILES[req.nextUrl.searchParams.get("f") || ""];
  // id becomes a directory name - validated hard against path traversal.
  if (!SAFE_ID.test(id) || !f) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400, headers: NO_STORE });
  try {
    const buf = await readFile(path.join(ROOT, id, f.name));
    return new NextResponse(new Uint8Array(buf), { headers: { ...NO_STORE, "Content-Type": f.type } });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404, headers: NO_STORE });
  }
}
