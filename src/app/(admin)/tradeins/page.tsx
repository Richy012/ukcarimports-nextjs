import type { Metadata } from "next";
import TradeInsAdmin from "./TradeInsAdmin";

// Same reason as /dashboard: without this Next prerenders the page as static
// and Cloudflare keeps the stale build for a year.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade-ins",
  robots: { index: false, follow: false },
};

export default function TradeInsPage() {
  return <TradeInsAdmin />;
}
