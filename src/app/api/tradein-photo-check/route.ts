import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Does this photo actually show the part of the car it is supposed to?
 * STAGING ONLY, same as the rest of the trade-in flow.
 *
 * Why this exists: the in-camera wireframe gate was calibrated against 540 real
 * photographs on 2026-09-04 and does not work. Ranked against all 16 overlays
 * the correct one came top 11% of the time against a 6% chance rate, because a
 * wireframe is a silhouette and a car's front and rear silhouettes are nearly
 * the same shape - no edge-based method can tell a front from a rear. The
 * outline stays as a framing GUIDE; correctness is judged here instead, on the
 * photo that was actually taken. Full evidence: ALIGNMENT_CALIBRATION_4SEP.md.
 *
 * Design:
 *  - The image is already on our disk, so the phone uploads nothing twice.
 *  - Downscaled to 512px before it is sent. Judging "is this the rear of a car"
 *    needs no more, and it is the difference between ~250 and ~2,500 tokens a
 *    photo.
 *  - Called in the background the moment a shot lands, so a retake is asked for
 *    while the seller is still standing at the car, not after they have gone in.
 *  - NO KEY, NO NOISE: with ANTHROPIC_API_KEY unset this returns "skipped" and
 *    the flow behaves exactly as it did before. Nothing here can block a photo.
 */

export const runtime = "nodejs";

const ROOT = `${process.cwd()}/uploads/tradein`;
const SAFE = /^[A-Za-z0-9_-]{6,64}$/;
// Haiku is the right tier for a yes/no about a photograph, and it is what the
// costing the owner approved was based on: about 0.7 cent for a full set.
const MODEL = process.env.TRADEIN_CHECK_MODEL || "claude-haiku-4-5";

type Verdict = "ok" | "wrong" | "unclear" | "skipped" | "error";

function out(verdict: Verdict, seen = "", note = "") {
  return NextResponse.json({ ok: true, verdict, seen, note });
}

export async function POST(req: NextRequest) {
  let body: { draftId?: string; slot?: string; label?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const draftId = String(body.draftId || "");
  const slot = String(body.slot || "");
  const label = String(body.label || "").slice(0, 120);
  const hint = String(body.hint || "").slice(0, 300);
  if (!SAFE.test(draftId) || !SAFE.test(slot)) {
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  }

  // Unconfigured is a normal state, not a failure: the flow ran without this
  // check for a month and must keep running until a key is put in place.
  if (!process.env.ANTHROPIC_API_KEY) return out("skipped");

  let small: Buffer;
  try {
    const buf = await readFile(path.join(ROOT, draftId, `${slot}.jpg`));
    small = await sharp(buf).rotate().resize(512, 512, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
  } catch {
    return out("error", "", "could not read the photo");
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system:
        "You check photographs taken by a car owner on their phone for a trade-in valuation. " +
        "You judge ONE thing: is the subject and the angle what was asked for, with the whole " +
        "subject in frame and recognisable. Ignore lighting, weather, background, clutter and " +
        "how tidy the car is - those are judged separately. Reply with a single line and nothing else.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: small.toString("base64") } },
            {
              type: "text",
              text:
                `This photo is meant to show: ${label}. Guidance given to the owner: ${hint}\n\n` +
                "Answer in exactly one line, in one of these three forms:\n" +
                "OK|<what it shows in a few words>\n" +
                "WRONG|<what it actually shows in a few words>\n" +
                "UNCLEAR|<why you cannot tell, in a few words>\n" +
                "Use WRONG when it is a different part of the car or a clearly different angle, " +
                "or when the subject is cut off. Use OK when an experienced buyer would accept it.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return out("skipped");

    let line = "";
    for (const block of response.content) if (block.type === "text") line += block.text;
    line = line.trim().split("\n")[0] || "";
    const [head, ...rest] = line.split("|");
    const tail = rest.join("|").trim().slice(0, 120);
    const verb = head.trim().toUpperCase();
    if (verb.startsWith("OK")) return out("ok", tail);
    if (verb.startsWith("WRONG")) return out("wrong", tail);
    if (verb.startsWith("UNCLEAR")) return out("unclear", tail);
    // An unparseable answer must never accuse the seller of a bad photo.
    return out("skipped", "", line.slice(0, 120));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return out("skipped", "", "key rejected");
    if (e instanceof Anthropic.RateLimitError) return out("error", "", "busy, try again");
    if (e instanceof Anthropic.APIError) return out("error", "", `check unavailable (${e.status})`);
    return out("error", "", "check unavailable");
  }
}
