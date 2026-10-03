// Where a member goes after signing in, and the email alert they asked for
// before they had signed in (website review 3 Oct 2026 #25 and #49).
//
// Before this, sign-in always ended on /my-account/notifications and the
// "?redirect=" the alert prompt added was never read, so a visitor who clicked
// "Email me new matches" lost the search they were looking at.
//
// Client-side only (localStorage / window), like lib/auth.

// Only a path on this site is accepted. "//evil.com", "/\evil.com" and full
// URLs are refused: an open redirect on the sign-in page would let a phishing
// link send a member anywhere straight after a genuine sign-in.
export function safeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 32 || c === 127) return null;
  }
  // Never bounce back into the sign-in or sign-up pages themselves.
  if (/^\/(sign-in|sign-up)(\/|\?|#|$)/.test(v)) return null;
  if (typeof window !== "undefined") {
    try {
      if (new URL(v, window.location.origin).origin !== window.location.origin) return null;
    } catch {
      return null;
    }
  }
  return v;
}

export function withRedirect(path: string, redirect: string | null | undefined): string {
  const safe = safeRedirect(redirect);
  return safe ? `${path}?redirect=${encodeURIComponent(safe)}` : path;
}

// ---------------------------------------------------------------------------
// An alert asked for while signed out. Kept for 3 days: sign-up, then up to
// the 48 hours the confirmation email allows, then signing in.
// ---------------------------------------------------------------------------
const PENDING_ALERT_KEY = "ukci_pending_alert";
const PENDING_ALERT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface PendingAlert {
  /** The exact query_params JSON the alert will be saved with. */
  qp: string;
  label: string;
  /** The /used-cars address showing that search. */
  url: string;
  t: number;
}

export function rememberPendingAlert(alert: Omit<PendingAlert, "t">) {
  try {
    localStorage.setItem(PENDING_ALERT_KEY, JSON.stringify({ ...alert, t: Date.now() }));
  } catch {
    /* storage blocked: the slide-over path still saves it straight away */
  }
}

export function readPendingAlert(): PendingAlert | null {
  try {
    const raw = localStorage.getItem(PENDING_ALERT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Partial<PendingAlert>;
    const fresh = typeof a.t === "number" && Date.now() - a.t < PENDING_ALERT_MAX_AGE_MS;
    const url = safeRedirect(a.url);
    if (!fresh || !url || typeof a.qp !== "string" || !a.qp) {
      localStorage.removeItem(PENDING_ALERT_KEY);
      return null;
    }
    return { qp: a.qp, label: typeof a.label === "string" ? a.label : "", url, t: a.t as number };
  } catch {
    return null;
  }
}

export function clearPendingAlert() {
  try {
    localStorage.removeItem(PENDING_ALERT_KEY);
  } catch {
    /* ignore */
  }
}
