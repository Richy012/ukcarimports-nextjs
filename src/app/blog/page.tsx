import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import { blogDate } from "@/lib/blogDate";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "Blog",
  // Website review 3 Oct 2026 #66: a canonical address, and a description of what the
  // posts cover now (the old one led on Brexit, which today's guides barely touch).
  description:
    "Guides to importing a car from the UK to Ireland: VRT and VAT, warranties, finance, brand buyer's guides and how our prices compare with the Irish market - UK Car Imports",
  alternates: { canonical: "https://ukcarimports.ie/blog" },
};

// Named character codes the posts use (website review 3 Oct 2026 #65). &amp; is
// deliberately absent: it is decoded last, so "&amp;euro;" stays the text "&euro;".
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", euro: "\u20ac", pound: "\u00a3", quot: '"', apos: "'", lt: "<", gt: ">",
  ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018", rsquo: "\u2019", sbquo: "\u201a",
  ldquo: "\u201c", rdquo: "\u201d", bdquo: "\u201e", hellip: "\u2026", middot: "\u00b7",
  bull: "\u2022", trade: "\u2122", reg: "\u00ae", copy: "\u00a9", deg: "\u00b0",
  times: "\u00d7", rarr: "\u2192", larr: "\u2190", frac12: "\u00bd",
  aacute: "\u00e1", eacute: "\u00e9", iacute: "\u00ed", oacute: "\u00f3", uacute: "\u00fa",
  Aacute: "\u00c1", Eacute: "\u00c9", Iacute: "\u00cd", Oacute: "\u00d3", Uacute: "\u00da",
  euml: "\u00eb", ouml: "\u00f6", uuml: "\u00fc", auml: "\u00e4", ccedil: "\u00e7", szlig: "\u00df",
};

function codePoint(n: number): string {
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
}

interface BlogSummary {
  blog_id: string;
  blog_url: string;
  blog_heading: string;
  blog_description: string;
  blog_image: string;
  blog_date: string;
  Author: string;
}

async function getBlogs(): Promise<BlogSummary[]> {
  const res = await fetch(`${API_BASE}/get-blogs`, { cache: "no-store" });
  const json = await res.json();
  return json.data ?? [];
}


/**
 * A real excerpt, built on the server, instead of shipping the whole article.
 *
 * 2026-08-15: this page was rendering every post's FULL HTML into the response
 * and hiding the overflow with `max-height: 100px`. The reader downloaded all
 * of it and saw a hundred pixels. The 33-brand warranty guide alone is 69KB, so
 * /blog had grown to 239KB and every new guide made it worse.
 *
 * Strips schema/style blocks and tags, collapses whitespace, cuts on a word
 * boundary. Server-side, so nothing extra reaches the browser.
 */
function excerpt(html: string, limit = 220): string {
  const text = (html || "")
    // JSON-LD and the article's own scoped CSS are not prose.
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    // Website review 3 Oct 2026 #65: named codes such as &euro; reached the page as
    // text ("For &euro;395 , eligible ..."). Every numbered code and the named ones
    // above are decoded; &amp; last.
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
    .replace(/&([a-z][a-z0-9]*);/gi, (whole, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole,
    )
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    // A tag dropped between a word and its comma left "\u20ac395 ,".
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return cut.slice(0, cut.lastIndexOf(" ")) + "\u2026";
}

export default async function BlogListPage() {
  const blogs = await getBlogs();

  return (
    <main className={styles.page}>
      <h1>Blog</h1>
      <div className={styles.list}>
        {blogs.map((blog) => (
          <article key={blog.blog_id} className={styles.card}>
            <Link href={`/blog/${blog.blog_url}`}>
              <h2>{blog.blog_heading}</h2>
            </Link>
            <p className={styles.excerpt}>{excerpt(blog.blog_description)}</p>
            <div className={styles.meta}>
              <span>
                <time dateTime={blogDate(blog.blog_date).iso}>{blogDate(blog.blog_date).label}</time> &mdash; By <strong>{blog.Author}</strong>
              </span>
              <Link href={`/blog/${blog.blog_url}`} className={styles.readMore}>
                Read post
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
