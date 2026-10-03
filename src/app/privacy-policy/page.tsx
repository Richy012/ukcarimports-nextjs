import type { Metadata } from "next";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "Privacy Policy",
  // Website review 3 Oct 2026 #66: canonical address and a real description (it was 30 characters).
  description: "How UK Car Imports (Focus Investments Limited) collects, uses, stores and shares personal data when you visit our website, request a vehicle, place a deposit or import a car with us.",
  alternates: { canonical: "https://ukcarimports.ie/privacy-policy" },
};

interface ContentResponse {
  data: { content: string };
}

async function getContent(slug: string): Promise<string> {
  const res = await fetch(`${API_BASE}/get-content/${slug}`, { cache: "no-store" });
  const json: ContentResponse = await res.json();
  return json.data?.content ?? "";
}

export default async function PrivacyPolicyPage() {
  const content = await getContent("privacypolicy");
  // Website review 3 Oct 2026 #66: the policy's title arrives from the CMS as a plain
  // paragraph, so the page had no main heading. The same words now render as the
  // <h1>; the policy text itself is untouched.
  const hasH1 = /<h1[\s>]/i.test(content);
  const body = hasH1 ? content : content.replace(/^\s*<p>\s*Privacy Policy\s*<\/p>/i, "");

  return (
    <main className={styles.page}>
      {!hasH1 && <h1>Privacy Policy</h1>}
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </main>
  );
}
