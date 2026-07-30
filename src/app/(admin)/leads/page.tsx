import type { Metadata } from "next";
import LeadsClient from "./LeadsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

export default function AdminLeadsPage() {
  return <LeadsClient />;
}
