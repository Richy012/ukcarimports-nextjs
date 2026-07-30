import type { Metadata } from "next";
import DepositsClient from "./DepositsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deposits",
  robots: { index: false, follow: false },
};

export default function AdminDepositsPage() {
  return <DepositsClient />;
}
