import type { MetadataRoute } from "next";

const API_BASE = "https://api.ukcarimports.ie/public";
const SITE = "https://ukcarimports.ie";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/used-cars`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/car-sourcing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/about-us`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/blog`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API_BASE}/import-landing-index`, { next: { revalidate: 86400 } });
    const json = await res.json();
    const data = json?.data;
    const makes: MetadataRoute.Sitemap = (data?.makes ?? []).map(
      (m: { slug: string }) => ({
        url: `${SITE}/import/${m.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })
    );
    const models: MetadataRoute.Sitemap = (data?.models ?? []).map(
      (m: { make_slug: string; model_slug: string }) => ({
        url: `${SITE}/import/${m.make_slug}/${m.model_slug}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })
    );
    return [...fixed, ...makes, ...models];
  } catch {
    return fixed;
  }
}
