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
// Intrinsic sizes of the images this page ships. Without width/height the
// browser cannot reserve space, and the text below them jumps once they load
// -- measured CLS 0.162 on mobile.
const CMS_IMAGE_SIZES: Record<string, [number, number]> = {
  "bmwpc.jpg": [1200, 486],
  "richard-v2.jpg": [700, 875],
  "logogray.jpg": [250, 250],
  "tick.png": [16, 16],
};

function tidyCmsHtml(html: string): string {
  return html
    .replace(/<img(?![^>]*\salt=)([^>]*?)\s*\/?>/gi, '<img$1 alt="">')
    .replace(/<img([^>]*?)>/gi, (m, attrs: string) => {
      if (/\swidth=/i.test(attrs)) return m;
      const src = /src="([^"]*)"/i.exec(attrs)?.[1] ?? "";
      const file = src.split("/").pop() ?? "";
      const dims = CMS_IMAGE_SIZES[file];
      return dims ? `<img${attrs} width="${dims[0]}" height="${dims[1]}">` : m;
    })
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
