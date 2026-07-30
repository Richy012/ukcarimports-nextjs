import type { Metadata } from "next";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "FAQ",
  description: "We have gathered frequently asked questions for you - UK Car Imports",
};

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

async function getFaqs(): Promise<FaqItem[]> {
  const res = await fetch(`${API_BASE}/get-faq`, { cache: "no-store" });
  const json = await res.json();
  const raw = json.data?.content;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default async function FaqPage() {
  const faqs = await getFaqs();

  return (
    <main className={`${styles.page} wm-light`}>
      <h1>Frequently Asked Questions</h1>
      <div className={styles.faqList}>
        {faqs.map((faq, index) => (
          <details key={faq.id} className={styles.faqItem} open={index === 0}>
            <summary className={styles.faqQuestion}>{faq.question}</summary>
            <div
              className={styles.faqAnswer}
              dangerouslySetInnerHTML={{ __html: faq.answer }}
            />
          </details>
        ))}
      </div>
    </main>
  );
}
