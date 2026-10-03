import type { Metadata } from "next";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  // Website review 3 Oct 2026 #66: canonical address and a fuller description (the terms' own headings).
  description: "The client service terms and conditions for UK Car Imports' vehicle sourcing, purchase administration, import, VRT and related services.",
  alternates: { canonical: "https://ukcarimports.ie/terms-and-conditions" },
};

interface ContentResponse {
  data: { content: string };
}

async function getContent(slug: string): Promise<string> {
  const res = await fetch(`${API_BASE}/get-content/${slug}`, { cache: "no-store" });
  const json: ContentResponse = await res.json();
  return json.data?.content ?? "";
}

export default async function TermsAndConditionsPage() {
  const content = await getContent("tnc");

  return (
    <main className={styles.page}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </main>
  );
}
