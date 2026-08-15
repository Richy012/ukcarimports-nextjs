import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "../page.module.css";
import RelatedDeals from "./RelatedDeals";

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


/** Pull the Article node out of a post's embedded JSON-LD, if it has one. */
function extractArticleSchema(html: string): Record<string, string> | null {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    const nodes: Record<string, unknown>[] = parsed["@graph"] ?? [parsed];
    const article = nodes.find((n) => n["@type"] === "Article");
    return (article as Record<string, string>) ?? null;
  } catch {
    // Malformed schema must never take the page down - fall back to defaults.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);
  if (!blog) return { title: "Blog" };
  // 2026-08-15: blog posts carried NO Open Graph tags at all, so every share to
  // Facebook, LinkedIn, X or WhatsApp rendered as a bare link with no title
  // card and no image -- on the guides, which exist to be shared, that is the
  // whole point of publishing them. The car page pattern, applied here.
  const url = `https://ukcarimports.ie/blog/${slug}`;
  const heading = blog.blog_heading.trim();

  // 2026-08-15: every post was shipping the full headline as its <title> and a
  // boilerplate description that just repeated the headline. The warranty guide
  // came out at a 132-character title and a meta description that said nothing
  // a searcher wants. Rather than a per-slug lookup table that nobody will
  // maintain, read the SEO copy out of the article's own JSON-LD when it has
  // any: `alternativeHeadline` is the short SERP title, `description` is the
  // meta description. A post without schema keeps the old behaviour.
  const schema = extractArticleSchema(blog.blog_description);
  const title = (schema?.alternativeHeadline || heading).trim();
  const description = (
    schema?.description ||
    `${heading} — from the UK Car Imports blog: importing cars from the UK to Ireland, VRT, pricing and market analysis.`
  ).trim();
  // blog_image is empty on every recent post, so fall back to the brand banner
  // rather than let the platforms pick the site avatar.
  const image = blog.blog_image
    ? `https://api.ukcarimports.ie/public/blogimages/${blog.blog_image}`
    : "https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "UK Car Imports",
      title: heading,
      description,
      locale: "en_IE",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
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
      <RelatedDeals text={blog.blog_heading + " " + blog.blog_description} />
    </main>
  );
}
