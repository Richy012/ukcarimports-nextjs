import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

// Without this, Next.js prerenders /dashboard as static content (confirmed
// live: shipped with `Cache-Control: s-maxage=31536000`, a 1-year edge
// cache), so Cloudflare keeps serving a stale build indefinitely regardless
// of source changes. Every other authenticated page already sets this
// (sign-in, staff-login) -- missed here, not a deliberate difference.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
