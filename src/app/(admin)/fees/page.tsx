import type { Metadata } from "next";
import FeesClient from "./FeesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fees",
  robots: { index: false, follow: false },
};

export default function AdminFeesPage() {
  return <FeesClient />;
}
