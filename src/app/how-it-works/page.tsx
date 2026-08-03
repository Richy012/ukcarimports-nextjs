import type { Metadata } from "next";
import HowItWorksClient from "./HowItWorksClient";
import { getStockCount, formatStockCount } from "@/lib/stockCount";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How importing your next car from the UK with UK Car Imports works — search, compare against Irish prices, secure with a deposit, independent inspection, and collect on Irish plates in about two weeks.",
};

// Revalidate on the same 15-minute window as every other stock-count surface.
export const revalidate = 900;

export default async function HowItWorksPage() {
  const count = await getStockCount();
  return <HowItWorksClient stockLabel={formatStockCount(count)} />;
}
