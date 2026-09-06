import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { readOnly } from "../../../lib/dealstore";

/**
 * Autosave for the trade-in form. Staging.
 *
 * Owner, 6 Sep: the submission is long and people will not have everything to
 * hand. Photos already live on the server under the draft id and survive a
 * reload; the ANSWERS did not. Now they do: the page posts its whole answer
 * state here as it changes, and reads it back on load — same browser, or any
 * device via the emailed resume link (/api/tradein-resume).
 *
 * Stored beside the photos (uploads/tradein/<draftId>/answers.json). Frozen
 * once the draft is attached to a submitted deal, same rule as the photos.
 * Answers are the customer's own words about their own car: no valuation, no
 * staff notes, nothing of ours is written here.
 */
export const runtime = "nodejs";

const ROOT = `${process.cwd()}/uploads/tradein`;
const SAFE_DRAFT = /^[a-z0-9]{12,32}$/;
const MAX = 64 * 1024;

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

async function sealed(draftId: string): Promise<boolean> {
  return readOnly((db) => db.deals.some((d) => d.draftId === draftId));
}

export async function GET(req: NextRequest) {
  const draftId = (req.nextUrl.searchParams.get("draftId") || "").trim();
  if (!SAFE_DRAFT.test(draftId)) return bad("bad draft id");
  try {
    const raw = await readFile(path.join(ROOT, draftId, "answers.json"), "utf8");
    const j = JSON.parse(raw);
    return NextResponse.json({ ok: true, draftId, answers: j.answers ?? null, savedAt: j.savedAt ?? null,
                               sealed: await sealed(draftId) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: true, draftId, answers: null, savedAt: null,
                               sealed: await sealed(draftId) }, { headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  let body: { draftId?: string; answers?: unknown };
  try { body = await req.json(); } catch { return bad("invalid JSON"); }
  const draftId = String(body.draftId || "").trim();
  if (!SAFE_DRAFT.test(draftId)) return bad("bad draft id");
  if (!body.answers || typeof body.answers !== "object") return bad("answers required");
  if (await sealed(draftId)) return bad("this trade-in has been submitted; its answers are locked", 409);
  const text = JSON.stringify({ savedAt: new Date().toISOString(), answers: body.answers });
  if (text.length > MAX) return bad("too large");
  const dir = path.join(ROOT, draftId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "answers.json"), text, "utf8");
  return NextResponse.json({ ok: true, savedAt: JSON.parse(text).savedAt }, { headers: NO_STORE });
}
