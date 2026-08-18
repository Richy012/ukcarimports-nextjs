import type { Metadata } from "next";
import HowItWorksClient from "./HowItWorksClient";
import { getStockCount, formatStockCount } from "@/lib/stockCount";

export const metadata: Metadata = {
  // 2026-08-11: "importing a car from uk to ireland" sits at position 6 with
  // 3% CTR (GSC) — a how-to query this page answers. Title now says so.
  title: "How to Import a Car from the UK to Ireland — Step by Step, VRT Included",
  description:
    "How importing your next car from the UK with UK Car Imports works — search, compare against Irish prices, secure with a deposit, independent inspection, and collect on Irish plates in about two weeks.",
  alternates: { canonical: "https://ukcarimports.ie/how-it-works" },
};

// Revalidate on the same 15-minute window as every other stock-count surface.
export const revalidate = 900;

export default async function HowItWorksPage() {
  const count = await getStockCount();
  return <HowItWorksClient stockLabel={formatStockCount(count)} />;
}
