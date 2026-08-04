import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Live and staging are served by ONE process, so a build-time flag opened
// BOTH to crawlers (found 2026-08-04, hours after cutover). Decide per
// request host instead: only the canonical live host is indexable, every
// other host (staging, IP, preview) gets a blanket Disallow.
const LIVE_HOSTS = new Set(["ukcarimports.ie", "www.ukcarimports.ie"]);

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase().split(":")[0];

  if (!LIVE_HOSTS.has(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/deposits",
        "/leads",
        "/members",
        "/comparisons",
        "/templates",
        "/staff-login",
        "/my-account",
        "/api/",
      ],
    },
    sitemap: "https://ukcarimports.ie/sitemap.xml",
  };
}
