import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Read our useful posts - How to buy a cheaper used car, how Brexit affects the Irish car market - UK Car Imports",
};

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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/\s+/g, " ")
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
                <time>{blog.blog_date}</time> &mdash; By <strong>{blog.Author}</strong>
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
