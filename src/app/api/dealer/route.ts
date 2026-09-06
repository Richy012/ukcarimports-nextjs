import { NextRequest, NextResponse } from "next/server";
import {
  withDb,
  readOnly,
  newId,
  newToken,
  nowIso,
  dealForDealer,
  type Dealer,
} from "../../../lib/dealstore";
import { notify, lines } from "../../../lib/dealnotify";

// POST — dealer registration: created unapproved, staff verify silently
// (Carzone stock / CRO / VIES) before flipping the switch. GET ?token= — the
// dealer portal feed, built ONLY from dealForDealer (hard rule 1): live deals
// always, plus accepted/matched/completed deals this dealer actually won.
// Buyer identity never appears here until the serializer itself reveals it.

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BASE = "https://staging.ukcarimports.ie";

/** Trading names legitimately differ from registered names — flag only when
 *  the two share not one meaningful word (legal suffixes ignored). */
function namesShareNothing(trading: string, registered: string): boolean {
  const toks = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !["limited", "ltd", "dac", "ulc", "plc", "the", "and", "teoranta"].includes(w)),
    );
  const a = toks(trading);
  const b = toks(registered);
  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (b.has(w)) return false;
  return true;
}

/**
 * Real-time VAT check against the EU VIES REST service — returns validity
 * plus the registered entity name and address. 8s cap, fail-open: VIES has
 * regular member-state outages and a flaky service must never cost us a
 * dealer registration. valid stays null when the service can't answer.
 */
async function viesCheck(vat: string): Promise<{
  checkedAt: string; valid: boolean | null; name: string; address: string;
}> {
  const m = vat.match(/^([A-Z]{2})([A-Z0-9+*]+)$/);
  const countryCode = m ? m[1] : "IE";
  const vatNumber = m ? m[2] : vat;
  const out = { checkedAt: new Date().toISOString(), valid: null as boolean | null, name: "", address: "" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch("https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode, vatNumber }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const j = (await r.json()) as { valid?: boolean; name?: string; address?: string };
      if (typeof j.valid === "boolean") {
        out.valid = j.valid;
        out.name = (j.name || "").trim().slice(0, 200);
        out.address = (j.address || "").replace(/\s*\n\s*/g, ", ").trim().slice(0, 300);
      }
    }
  } catch {
    /* VIES down — staff check manually at approval */
  }
  return out;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const j: unknown = await req.json();
    body = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return bad("invalid JSON body");
  }

  const vat = str(body.vat, 20).toUpperCase().replace(/\s+/g, "");
  const email = str(body.email, 120).toLowerCase();
  const name = str(body.name, 120);
  const county = str(body.county, 40);
  const takesRaw = str(body.takesTradeIns, 12);
  const takesTradeIns = (["yes", "sometimes", "no"] as const).find((x) => x === takesRaw) ?? "";

  if (!EMAIL_RE.test(email)) return bad("a valid business email is required");
  if (vat.length < 5) return bad("a VAT number is required");
  if (!name) return bad("a trading name is required");
  if (!county) return bad("a county is required");

  const vies = await viesCheck(vat);

  // Auto-approval (owner, 20 Aug): a valid VAT whose registered name lines up
  // with the trading name, from a dealer who takes trade-ins, goes straight
  // through — the access link is emailed immediately. Anything less waits for
  // staff. VIES is the verification; Carzone history is OUR data to consult,
  // not a hoop for the dealer.
  const nameLinesUp = vies.valid === true && !namesShareNothing(name, vies.name);
  const autoApprove = nameLinesUp && takesTradeIns !== "no" && takesTradeIns !== "";

  const made = await withDb((db): { created: boolean; token: string } => {
    const existing = db.dealers.find((d) => d.email.toLowerCase() === email);
    if (existing) return { created: false, token: "" }; // idempotent: no duplicates, no enumeration
    const dealer: Dealer = {
      id: newId("dlr"),
      vat,
      email,
      name,
      county,
      approved: autoApprove,
      approvedAt: autoApprove ? nowIso() : null,
      token: newToken(),
      createdAt: nowIso(),
      notes: autoApprove ? "auto-approved: VIES valid, name matches, takes trade-ins" : "",
      banned: false,
      creditEur: 0,
      vies,
      takesTradeIns,
    };
    db.dealers.push(dealer);
    return { created: true, token: dealer.token };
  });

  if (made.created) {
    const viesLine =
      vies.valid === true
        ? `VIES: VALID — registered as "${vies.name}"${vies.address ? `, ${vies.address}` : ""}.`
        : vies.valid === false
          ? `VIES: the VAT number does NOT validate. Do not approve without an explanation.`
          : `VIES: service unavailable at registration — check the number manually.`;
    const tradeLine = `Takes trade-ins: ${takesTradeIns || "not answered"}.`;

    if (autoApprove) {
      await notify({
        audience: "dealer",
        to: email,
        kind: "dealer_approved",
        subject: `You're on the UK Car Imports Deal Builder — your access link`,
        body: lines(
          `${name}, your VAT checked out and your access is live.`,
          `Your portal — keep this link private, it is your login:`,
          `${BASE}/deal-builder?token=${made.token}`,
          ``,
          `Every live deal comes with the retail sale already attached: a trade-in you can retail, and a buyer already committed to their next car. You bid on the proposition.`,
          `Every bid is indicative and subject to physical inspection of the car.`,
        ),
      });
      await notify({
        audience: "staff",
        to: null,
        kind: "dealer_registered",
        subject: `Dealer AUTO-APPROVED: ${name} (${county})`,
        body: lines(
          `${name} · VAT ${vat} · ${email} · ${county}`,
          viesLine,
          tradeLine,
          `Registered name lines up with the trading name, so the access link went out automatically. Ban from the console if anything looks wrong.`,
        ),
      });
    } else {
      await notify({
        audience: "staff",
        to: null,
        kind: "dealer_registered",
        subject: `Dealer awaiting verification: ${name} (${county})`,
        body: lines(
          `${name} · VAT ${vat} · ${email} · ${county}`,
          viesLine,
          tradeLine,
          `Not auto-approved because: ${
            vies.valid !== true
              ? "the VAT did not validate cleanly"
              : namesShareNothing(name, vies.name)
                ? "the registered name shares nothing with the trading name"
                : "they did not confirm they take trade-ins"
          }.`,
          `Our own Carzone data shows their advertising history — check it there, then approve or ban in the console. The dealer is not told what was checked.`,
        ),
      });
    }
  }

  return NextResponse.json({ ok: true, approved: made.created && autoApprove });
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  if (!token) return bad("token is required");

  const out = await readOnly((db) => {
    const dealer = db.dealers.find((d) => d.token === token);
    if (!dealer || dealer.banned) return null;

    const won = (dealId: string, acceptedBidId: string | null): boolean =>
      acceptedBidId !== null &&
      db.bids.some((b) => b.id === acceptedBidId && b.dealId === dealId && b.dealerId === dealer.id);

    const deals = !dealer.approved
      ? []
      : db.deals
          .filter(
            (d) =>
              d.status === "live" ||
              (["accepted", "matched", "completed"].includes(d.status) &&
                won(d.id, d.acceptedBidId)),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((d) => dealForDealer(d, dealer, db));

    return {
      dealer: { name: dealer.name, county: dealer.county, approved: dealer.approved },
      deals,
    };
  });

  if (!out) return bad("not found", 404);
  return NextResponse.json({ ok: true, ...out });
}
