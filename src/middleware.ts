import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// UK visitors get the access-unavailable wall — restores the legacy SPA's geo
// gate (App.js isUK -> WarningPage) that silently died at the Next.js cutover;
// rediscovered 2026-08-14 after UK crawler swarms reappeared in GA4 at 3am.
// Country comes from Cloudflare's cf-ipcountry header. Exemptions, each
// deliberate: staff/admin paths (the owner works from the UK at times), and
// the production server's own IP (the E2E suite runs from this London Linode
// through Cloudflare, so without this the suite would wall itself).
const STAFF_PREFIXES = [
  "/uk-notice",
  "/staff-login",
  "/dashboard",
  "/leads",
  "/members",
  "/comparisons",
  "/deposits",
  "/templates",
  "/cars",
  "/social",
];

export function middleware(req: NextRequest) {
  const country = req.headers.get("cf-ipcountry");
  if (country !== "GB") return NextResponse.next();
  if (req.headers.get("cf-connecting-ip") === "139.162.203.124") return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (STAFF_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return NextResponse.next();
  return NextResponse.rewrite(new URL("/uk-notice", req.url));
}

export const config = {
  matcher: ["/((?!_next/|api/|assets/|favicon|robots|sitemap).*)"],
};
