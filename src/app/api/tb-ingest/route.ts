import { NextRequest, NextResponse } from "next/server";
import { mkdir, appendFile, readFile, stat } from "fs/promises";
import path from "path";

/**
 * Trade Book harvest sink. STAGING ONLY, internal, temporary.
 *
 * The harvest extracts rows in the owner's browser and needs to get them to us.
 * Passing thousands of CSV lines back through the assistant's context is slow
 * and error-prone, so the page POSTs its buffer here instead. Same data, same
 * destination as the existing scp-based Command B - only the transport changes.
 *
 * Token-gated because it appends to a file. Nothing is read back by the public.
 */
export const runtime = "nodejs";

const DIR = `${process.cwd()}/uploads/tb`;
const FILE = path.join(DIR, "incoming_stream.csv");
const TOKEN = "tbsink_7f3a91c4e2";
const MAX = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const body = await req.text();
  if (!body || body.length > MAX) return NextResponse.json({ ok: false, error: "size" }, { status: 400 });
  // Only accept lines that look like our own 17-column CSV.
  const lines = body.split("\n").filter((l) => l.trim() && l.split(",").length >= 15);
  await mkdir(DIR, { recursive: true });
  await appendFile(FILE, lines.join("\n") + "\n", "utf8");
  const size = (await stat(FILE)).size;
  return NextResponse.json({ ok: true, added: lines.length, bytes: size });
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  try {
    const t = await readFile(FILE, "utf8");
    return NextResponse.json({ ok: true, lines: t.split("\n").filter(Boolean).length, bytes: t.length });
  } catch {
    return NextResponse.json({ ok: true, lines: 0, bytes: 0 });
  }
}
