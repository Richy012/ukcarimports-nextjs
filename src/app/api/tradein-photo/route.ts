import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, readdir, stat } from "fs/promises";
import path from "path";
import { isDraftSealed, readOnly } from "../../../lib/dealstore";

// Trade-in photo upload. STAGING ONLY - the whole trade-in flow is staging-only
// by the owner's 2026-08-08 instruction, and this writes to the staging box's
// own disk, not the Linode bucket.
//
// Design decisions worth keeping:
//  - ONE photo per request, uploaded the moment it is taken. A seller on a phone
//    in a car park loses signal; a submission that only uploads at the end loses
//    everything. Each shot is independently durable.
//  - The browser has already resized and re-encoded the image through a canvas,
//    which strips EVERY piece of EXIF including GPS. Nothing here has to remove
//    location data because it never arrives.
//  - Server stamps the time. The file's own timestamp is the seller's clock and
//    a dealer needs to know the condition is current.
//  - draftId comes from the client and is used as a directory name, so it is
//    validated hard - a slash or a dot-dot here would be a path traversal.
//
// SECURITY (2026-08-18, review finding): the draftId is the ONLY key on this
// endpoint, and dealForDealer hands every approved dealer the draftId of every
// live deal. So a MUTATION (upload or delete) authorized by draftId alone would
// let one dealer vandalise or overwrite a rival deal's photos. The gate is
// isDraftSealed(): once a draft is attached to a submitted deal it is frozen -
// POST and DELETE are refused. During capture no deal exists, so the seller's
// own uploads and retakes work normally; after submission nobody can mutate.
// GET stays open - dealers viewing photos of live deals is the intended flow.

export const runtime = "nodejs";

const ROOT = `${process.cwd()}/uploads/tradein`;
const MAX_BYTES = 6 * 1024 * 1024;
const SAFE = /^[A-Za-z0-9_-]{6,64}$/;
// Identity documents: the VRC names the registered owner; the photo ID proves
// the person submitting IS that owner. Neither ever reaches a dealer.
const PROTECTED_FILES = new Set(["vlc_cert.jpg", "owner_id.jpg"]);
const PROTECTED_SLOTS = new Set(["vlc_cert", "owner_id"]);

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("could not read the upload");
  }

  const draftId = String(form.get("draftId") || "");
  const slot = String(form.get("slot") || "");
  const file = form.get("photo");

  if (!SAFE.test(draftId)) return bad("bad draft id");
  if (!SAFE.test(slot)) return bad("bad slot id");
  if (await isDraftSealed(draftId)) return bad("this trade-in has been submitted; its photos are locked", 409);
  if (!(file instanceof File)) return bad("no photo");
  if (file.size === 0) return bad("empty photo");
  if (file.size > MAX_BYTES) return bad("photo too large - it should have been resized first");

  const buf = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the declared type: must start with a JPEG SOI marker.
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return bad("not a jpeg");

  const dir = path.join(ROOT, draftId);
  await mkdir(dir, { recursive: true });
  const name = `${slot}.jpg`;
  await writeFile(path.join(dir, name), buf);

  return NextResponse.json({
    ok: true,
    slot,
    url: `/api/tradein-photo?draftId=${encodeURIComponent(draftId)}&slot=${encodeURIComponent(slot)}`,
    bytes: buf.length,
    takenAt: new Date().toISOString(),
  });
}

// Serve a photo back (for the thumbnail and for staff review), or list what a
// draft already holds so a reload can restore its ticks.
export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draftId") || "";
  const slot = req.nextUrl.searchParams.get("slot");
  if (!SAFE.test(draftId)) return bad("bad draft id");

  const dir = path.join(ROOT, draftId);

  if (!slot) {
    try {
      const files = await readdir(dir);
      const slots = await Promise.all(
        files
          // identity documents never appear in the dealer-visible list
          .filter((f) => f.endsWith(".jpg") && !PROTECTED_FILES.has(f))
          .map(async (f) => {
            const s = await stat(path.join(dir, f));
            return { slot: f.replace(/\.jpg$/, ""), bytes: s.size, takenAt: s.mtime.toISOString() };
          }),
      );
      return NextResponse.json({ ok: true, draftId, slots });
    } catch {
      return NextResponse.json({ ok: true, draftId, slots: [] });
    }
  }

  if (!SAFE.test(slot)) return bad("bad slot id");
  // identity documents — staff only, keyed; 404 (not 403) so their existence
  // is not confirmed to anyone without the key
  if (PROTECTED_SLOTS.has(slot)) {
    const key = req.nextUrl.searchParams.get("key") || "";
    const adminKey = await readOnly((db) => db.config.adminKey);
    if (!adminKey || key !== adminKey) return bad("not found", 404);
  }
  try {
    const { readFile } = await import("fs/promises");
    const buf = await readFile(path.join(dir, `${slot}.jpg`));
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return bad("not found", 404);
  }
}

export async function DELETE(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draftId") || "";
  const slot = req.nextUrl.searchParams.get("slot") || "";
  if (!SAFE.test(draftId) || !SAFE.test(slot)) return bad("bad id");
  if (await isDraftSealed(draftId)) return bad("this trade-in has been submitted; its photos are locked", 409);
  try {
    const { unlink } = await import("fs/promises");
    await unlink(path.join(ROOT, draftId, `${slot}.jpg`));
  } catch {
    /* already gone is fine - retake should never fail on a missing file */
  }
  return NextResponse.json({ ok: true });
}
