import type { Metadata } from "next";
import HandoversClient from "./HandoversClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Handovers",
  robots: { index: false, follow: false },
};

export default function AdminHandoversPage() {
  return <HandoversClient />;
}
