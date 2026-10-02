import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, readdir, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Car handover sign-off (owner, 2 Oct 2026: "take a picture of the car and
 * person I hand over to and for them to sign"). STAFF ONLY.
 *
 * Each handover is a folder under uploads/handover/<id>/ holding car.jpg,
 * person.jpg, signature.png and record.json. Nothing is ever edited or
 * deleted from here - a signed handover is a record, same rule as deposits.
 *
 * Gate: same as staff-tradeins - the staff JWT is forwarded to a Lumen
 * endpoint that only answers 200 for staff. Never cached: these are photos of
 * customers.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = `${process.cwd()}/uploads/handover`;
const MAX_BYTES = 8 * 1024 * 1024;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "X-Auth-Token",
};

// The words the customer signs under. Stored in each record too, so a later
// change of wording never changes what an old signature meant.
const DECLARATION =
  "I confirm I have taken delivery of the vehicle above, with its keys and documents, on the date and time shown.";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code, headers: NO_STORE });
}

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

function text(form: FormData, key: string, max: number): string {
  return String(form.get(key) || "").trim().slice(0, max);
}

async function bytesOf(form: FormData, key: string): Promise<Buffer | string> {
  const f = form.get(key);
  if (!(f instanceof File) || f.size === 0) return `missing ${key}`;
  if (f.size > MAX_BYTES) return `${key} too large`;
  return Buffer.from(await f.arrayBuffer());
}

export async function GET(req: NextRequest) {
  if (!(await isStaff(req))) return bad("staff only", 403);
  let ids: string[] = [];
  try {
    ids = await readdir(ROOT);
  } catch {
    ids = [];
  }
  const rows = [];
  for (const id of ids) {
    try {
      rows.push(JSON.parse(await readFile(path.join(ROOT, id, "record.json"), "utf8")));
    } catch {
      // a folder without a record is a failed save - not a handover
    }
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return NextResponse.json({ ok: true, handovers: rows, declaration: DECLARATION }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!(await isStaff(req))) return bad("staff only", 403);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("could not read the upload");
  }

  const customerName = text(form, "customerName", 120);
  if (!customerName) return bad("customer name is required");

  const car = await bytesOf(form, "carPhoto");
  const person = await bytesOf(form, "personPhoto");
  const sig = await bytesOf(form, "signature");
  for (const b of [car, person, sig]) if (typeof b === "string") return bad(b);
  const carBuf = car as Buffer, personBuf = person as Buffer, sigBuf = sig as Buffer;
  // Trust the bytes, not the declared type.
  if (!(carBuf[0] === 0xff && carBuf[1] === 0xd8)) return bad("car photo is not a jpeg");
  if (!(personBuf[0] === 0xff && personBuf[1] === 0xd8)) return bad("person photo is not a jpeg");
  if (!(sigBuf[0] === 0x89 && sigBuf[1] === 0x50 && sigBuf[2] === 0x4e && sigBuf[3] === 0x47)) return bad("signature is not a png");

  const now = new Date();
  const id = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15) + "-" + crypto.randomBytes(3).toString("hex");
  const dir = path.join(ROOT, id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "car.jpg"), carBuf);
  await writeFile(path.join(dir, "person.jpg"), personBuf);
  await writeFile(path.join(dir, "signature.png"), sigBuf);

  const record = {
    id,
    createdAt: now.toISOString(), // the server's clock, not the phone's
    customerName,
    reg: text(form, "reg", 20).toUpperCase(),
    car: text(form, "car", 120),
    mileage: text(form, "mileage", 20),
    notes: text(form, "notes", 1000),
    declaration: DECLARATION,
    userAgent: (req.headers.get("user-agent") || "").slice(0, 300),
  };
  // record.json last: its presence is what makes the folder a handover.
  await writeFile(path.join(dir, "record.json"), JSON.stringify(record, null, 2));

  return NextResponse.json({ ok: true, handover: record }, { headers: NO_STORE });
}
