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

// This copy is CMS HTML shared with the legacy site, so it is fixed up at
// render time rather than edited in the database. Two accessibility failures
// come from it: decorative images with no alt attribute at all, and headings
// that start at h3 under the page h1, which skips a level.
function tidyCmsHtml(html: string): string {
  return html
    .replace(/<img(?![^>]*\salt=)([^>]*?)\s*\/?>/gi, '<img$1 alt="">')
    .replace(
      /<(\/?)h([34])(\s|>)/gi,
      (_m, slash: string, level: string, tail: string) =>
        `<${slash}h${level === "3" ? "2" : "3"}${tail}`,
    );
}

export default async function AboutUsPage() {
  const content = await getContent("aboutus");

  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>Est. 2013 &middot; Sandyford, Dublin</p>
      <h1>About Us</h1>
      <p className={styles.lede}>
        Ireland&apos;s largest UK vehicle import specialist. Every car we list carries
        the full landed cost &mdash; VRT, VAT, duty and delivery &mdash; so the price you
        see is the price you pay.
      </p>
      <div className={styles.cms} dangerouslySetInnerHTML={{ __html: tidyCmsHtml(content) }} />
    </main>
  );
}
