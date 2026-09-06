import type { Metadata } from "next";

/** A customer's private status page (token in the URL): never indexed, never previewed. */
export const metadata: Metadata = {
  title: { absolute: "Your trade-in | UK Car Imports" },
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "https://ukcarimports.ie/trade-ins" },
  openGraph: { title: "Your trade-in | UK Car Imports", description: "Private page for one customer's trade-in.", images: [] },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
