import type { Metadata } from "next";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email templates",
  robots: { index: false, follow: false },
};

export default function TemplatesPage() {
  return <TemplatesClient />;
}
