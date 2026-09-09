import type { Metadata } from "next";
import IrishCarsAdmin from "./IrishCarsAdmin";

// Same reason as /dashboard and /tradeins: without this Next prerenders the
// page as static and Cloudflare keeps the stale build for a year.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Irish cars",
  robots: { index: false, follow: false },
};

export default function IrishCarsPage() {
  return <IrishCarsAdmin />;
}
