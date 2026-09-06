/**
 * Deal Builder notifications — staging.
 *
 * Every event writes an in-app Notification row (always), and attempts an
 * email through the same SMTP relay the rest of the business uses, by
 * shelling to /root/db_mail.py (subject, to, body on stdin).
 *
 * MAIL MODE — the safety knob, in data/dealbuilder.json config.mailMode:
 *   "log"        — rows only, no email at all
 *   "staff-only" — DEFAULT ON STAGING. Every email goes to info@ukcarimports.ie
 *                  with the intended recipient named in the subject, so Richard
 *                  sees exactly what a dealer/buyer WOULD have received and
 *                  nobody outside the business gets staging mail.
 *   "live"       — emails go to their real recipients. Flip only when dealers
 *                  are real and Richard says so.
 */

import { execFile } from "child_process";
import { withDb, newId, nowIso, type Notification } from "./dealstore";

const STAFF = "info@ukcarimports.ie";

function sendRelay(to: string, subject: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = execFile(
      "python3", ["/root/db_mail.py", to, subject],
      { timeout: 45000 },
      (err) => resolve(!err),
    );
    child.stdin?.write(body);
    child.stdin?.end();
  });
}

export async function notify(opts: {
  audience: "staff" | "dealer" | "buyer";
  to: string | null;          // real recipient (null for staff → info@)
  dealerId?: string | null;
  dealId?: string | null;
  kind: string;
  subject: string;
  body: string;
}): Promise<void> {
  const intended = opts.audience === "staff" ? STAFF : (opts.to ?? "");
  let emailedTo: string | null = null;

  const mode = await withDb((db) => {
    return db.config.mailMode;
  });

  if (mode !== "log" && intended) {
    const target = mode === "live" ? intended : STAFF;
    const subject = mode === "live" || opts.audience === "staff"
      ? "[Deal Builder] " + opts.subject
      : `[Deal Builder → ${intended}] ` + opts.subject;
    const ok = await sendRelay(target, subject, opts.body);
    if (ok) emailedTo = target;
  }

  await withDb((db) => {
    const row: Notification = {
      id: newId("ntf"),
      at: nowIso(),
      audience: opts.audience,
      dealerId: opts.dealerId ?? null,
      dealId: opts.dealId ?? null,
      kind: opts.kind,
      subject: opts.subject,
      body: opts.body,
      emailedTo,
      intendedFor: intended || null,
    };
    db.notifications.unshift(row);
    if (db.notifications.length > 2000) db.notifications.length = 2000;
  });
}

/** Small helpers so route code reads like the event list it implements. */
export const lines = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join("\n");

export const eur = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

/**
 * THE TRADE-IN OFFER EMAIL (owner, 5 Sep: "we require a further template to
 * send to the client once a final offer has been decided by me"). Sent by the
 * staff console's make_offer action. Edit the wording HERE and nowhere else;
 * {note} is the free line typed when the offer is made.
 */
export function tradeInOfferEmail(opts: {
  name: string;
  car: string;
  reg: string;
  eur: number;
  note: string;
  wantedTitle: string;
  wantedLandedEur: number;
  statusUrl: string;
}): { subject: string; body: string } {
  const first = (opts.name || "").trim().split(/\s+/)[0] || "there";
  return {
    subject: `Our offer for your ${opts.car}`,
    body: lines(
      `Hi ${first},`,
      ``,
      `We have been through your photographs and your answers on the ${opts.car}${opts.reg ? ` (${opts.reg})` : ""}.`,
      ``,
      `Our offer for it is ${eur(opts.eur)}, taken off the price of the car we import for you${
        opts.wantedLandedEur > 0 ? ` (${opts.wantedTitle} at ${eur(opts.wantedLandedEur)} all-in)` : ""
      }.`,
      opts.note ? `` : false,
      opts.note ? opts.note : false,
      ``,
      `This figure holds at handover as long as the car matches what you declared. Nothing is committed until you say yes, and there is nothing to pay.`,
      ``,
      `Reply to this email to accept, or ring us on 01-556 8261 if you would rather talk it through. Everything about your car lives here: ${opts.statusUrl}`,
      ``,
      `UK Car Imports`,
    ),
  };
}
