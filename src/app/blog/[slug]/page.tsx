import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "../page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

interface BlogDetail {
  blog_heading: string;
  blog_description: string;
  blog_image: string;
  blog_date: string;
  Author: string;
}

async function getBlog(slug: string): Promise<BlogDetail | null> {
  const res = await fetch(`${API_BASE}/get-blog/${slug}`, { cache: "no-store" });
  const json = await res.json();
  return json.data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);
  if (!blog) return { title: "Blog" };
  return {
    title: blog.blog_heading.trim(),
    description: `${blog.blog_heading.trim()} — from the UK Car Imports blog: importing cars from the UK to Ireland, VRT, pricing and market analysis.`,
    alternates: { canonical: `https://ukcarimports.ie/blog/${(await params).slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const blog = await getBlog(slug);
  if (!blog) notFound();

  return (
    <main className={styles.page}>
      <article className={styles.singlePost}>
        <h1>{blog.blog_heading}</h1>
        <div dangerouslySetInnerHTML={{ __html: blog.blog_description }} />
        <div className={styles.meta}>
          <time>{blog.blog_date}</time> &mdash; By <strong>{blog.Author}</strong>
        </div>
      </article>
    </main>
  );
}
