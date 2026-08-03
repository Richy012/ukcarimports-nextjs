import type { Metadata } from "next";
import HowItWorksClient from "./HowItWorksClient";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How importing your next car from the UK with UK Car Imports works — search, compare against Irish prices, secure with a deposit, independent inspection, and collect on Irish plates in about two weeks.",
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
