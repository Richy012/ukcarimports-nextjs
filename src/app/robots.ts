import type { MetadataRoute } from "next";

// Indexability is a single switch: SITE_INDEXABLE=1 in .env.production (set
// at cutover, needs a rebuild) opens the site to crawlers and advertises the
// sitemap. Anything else — including the variable being absent, the safe
// default for staging — serves a blanket Disallow AND pairs with the
// noindex meta emitted by layout.tsx. Found 2026-08-04: staging had NO
// robots.txt and NO noindex anywhere; this closes both gaps.
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXABLE !== "1") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // admin group routes + staff login carry their own noindex meta, but
      // there is no reason to invite crawling either
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
