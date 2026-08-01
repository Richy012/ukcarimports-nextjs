import type { Metadata } from "next";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "About Us",
  description: "Meet the team behind UK Car Imports and learn how we help import quality used cars from the UK to Ireland.",
};

interface ContentResponse {
  data: { content: string };
}

async function getContent(slug: string): Promise<string> {
  const res = await fetch(`${API_BASE}/get-content/${slug}`, { cache: "no-store" });
  const json: ContentResponse = await res.json();
  return json.data?.content ?? "";
}

export default async function AboutUsPage() {
  const content = await getContent("aboutus");

  return (
    <main className={styles.page}>
      <h1>About Us</h1>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </main>
  );
}
