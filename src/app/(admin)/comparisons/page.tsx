import type { Metadata } from "next";
import ComparisonsClient from "./ComparisonsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Price comparisons",
  robots: { index: false, follow: false },
};

export default function AdminComparisonsPage() {
  return <ComparisonsClient />;
}
