import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { readOnly } from "../../../lib/dealstore";
import { notify } from "../../../lib/dealnotify";

/**
 * "Email me a link to finish later." Staging.
 *
 * Owner, 6 Sep: the form is long, people will not have everything to hand,
 * and a member sign-up is more than this needs. So: they give an email, we
 * send a signed link back to THIS draft — answers (autosaved) and photos
 * (already on the server) come back on any device. No account, nothing to
 * remember. It also captures an address from people who would otherwise walk
 * away, which is the leak measured on 5 Sep (13,600 visitors, 1 sign-up).
 *
 * The link is draftId.signature, HMAC-SHA256 over the draft id with the
 * admin key as the secret — server-only, never in the browser. A forged id
 * without the signature gets nothing.
 *
 * Mail goes through the Deal Builder's notify(), so it respects mailMode:
 * on staging (staff-only) the message lands in info@ with the intended
 * address in the subject, and no customer is ever emailed from a test.
 */
export const runtime = "nodejs";

const SAFE_DRAFT = /^[a-z0-9]{12,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

async function secret(): Promise<string> {
  return readOnly((db) => db.config.adminKey || "");
}
const sign = (id: string, key: string) =>
  createHmac("sha256", key).update(id).digest("base64url").slice(0, 32);

export async function GET(req: NextRequest) {
  const t = (req.nextUrl.searchParams.get("t") || "").trim();
  const [draftId, sig] = t.split(".");
  if (!draftId || !sig || !SAFE_DRAFT.test(draftId)) return bad("bad link");
  const key = await secret();
  if (!key) return bad("resume links are not configured", 500);
  const want = sign(draftId, key);
  const a = Buffer.from(want), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return bad("bad link", 403);
  return NextResponse.json({ ok: true, draftId }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  let body: { draftId?: string; email?: string; car?: string };
  try { body = await req.json(); } catch { return bad("invalid JSON"); }
  const draftId = String(body.draftId || "").trim();
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const car = String(body.car || "your car").slice(0, 80);
  if (!SAFE_DRAFT.test(draftId)) return bad("bad draft id");
  if (!EMAIL_RE.test(email)) return bad("a valid email address is required");
  const key = await secret();
  if (!key) return bad("resume links are not configured", 500);

  const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "staging.ukcarimports.ie"}`;
  const link = `${origin}/trade-ins?resume=${draftId}.${sign(draftId, key)}`;

  await notify({
    audience: "buyer",
    to: email,
    dealId: null,
    kind: "tradein_resume_link",
    subject: `Finish your trade-in for ${car}`,
    body: [
      `Here is your link to pick up where you left off with ${car}:`,
      ``,
      link,
      ``,
      `Your photos and answers so far are saved. Open the link on any phone or computer and carry on.`,
      `Nothing is committed until you send it in.`,
      ``,
      `UK Car Imports · 01 556 8261 · info@ukcarimports.ie`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
