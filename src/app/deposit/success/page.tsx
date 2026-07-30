import type { Metadata } from "next";
import DepositSuccessClient from "./DepositSuccessClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deposit received",
  robots: { index: false, follow: false },
};

export default function DepositSuccessPage() {
  return <DepositSuccessClient />;
}
