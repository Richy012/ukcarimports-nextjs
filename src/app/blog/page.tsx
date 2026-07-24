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
            <div
              className={styles.excerpt}
              dangerouslySetInnerHTML={{ __html: blog.blog_description }}
            />
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
