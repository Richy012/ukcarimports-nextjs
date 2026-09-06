import { NextRequest, NextResponse } from "next/server";
import { withDb, nowIso } from "../../../../lib/dealstore";
import { notify, lines } from "../../../../lib/dealnotify";

// Buyer answers a misdescription claim within the 48h window. "accepted"
// puts the claim on the fast path (staff refund the dealer next day, the
// description guarantee applies); "contested" drops it to the slow path
// automatically — a refund never hinges on a story we cannot check. Staff
// resolve either way in the console; this endpoint never moves money.

export const runtime = "nodejs";

type Mail = Parameters<typeof notify>[0];

interface Result {
  status: number;
  error?: string;
  mails?: Mail[];
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

  const token = str(body.token, 64);
  const action = str(body.action, 12); // "accept" | "contest"
  const note = str(body.note, 1000);
  if (!token || (action !== "accept" && action !== "contest")) {
    return bad("token and action (accept|contest) are required");
  }
  if (action === "contest" && note.length < 10) {
    return bad("say briefly what is wrong with the dealer's account");
  }

  const r = await withDb((db): Result => {
    const deal = db.deals.find((d) => d.buyerToken === token);
    if (!deal) return { status: 404, error: "not found" };
    const c = (deal.cancellations ?? [])
      .slice()
      .reverse()
      .find((x) => x.category === "misdescription" && x.by === "dealer");
    if (!c) return { status: 400, error: "there is no claim to answer" };
    if (c.buyerResponse !== "") return { status: 400, error: "already answered" };
    if (c.resolution !== "") return { status: 400, error: "this claim has already been decided" };

    c.buyerResponse = action === "accept" ? "accepted" : "contested";
    c.buyerRespondedAt = nowIso();
    deal.history.push({
      at: nowIso(),
      event: `misdescription_${c.buyerResponse}`,
      detail: note || (action === "accept" ? "buyer accepted the claim" : "buyer contested the claim"),
    });
    deal.updatedAt = nowIso();

    const label =
      [deal.tradeIn.year, deal.tradeIn.make, deal.tradeIn.model].filter(Boolean).join(" ") ||
      deal.tradeIn.reg || "trade-in";

    const mails: Mail[] = [
      {
        audience: "staff",
        to: null,
        dealId: deal.id,
        kind: `misdescription_${c.buyerResponse}`,
        subject:
          action === "accept"
            ? `Buyer ACCEPTED the misdescription claim on ${label} — fast path`
            : `Buyer CONTESTED the misdescription claim on ${label} — slow path`,
        body: lines(
          action === "accept"
            ? `Uncontested. Resolve in the console: dealer refunded next day, guarantee applies.`
            : `Contested: "${note}". Slow path — judge both packs side by side; reg stays watched until ${c.vrmWatchUntil?.slice(0, 10) ?? "n/a"}.`,
        ),
      },
    ];
    return { status: 200, mails };
  });

  if (r.error) return bad(r.error, r.status);
  for (const m of r.mails ?? []) await notify(m);
  return NextResponse.json({ ok: true });
}
