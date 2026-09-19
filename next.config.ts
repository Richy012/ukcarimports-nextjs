import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-mode HMR websocket is blocked cross-origin by default; the app is
  // reached at staging.ukcarimports.ie (via Apache reverse proxy), not
  // localhost, so it needs to be explicitly allowlisted.
  allowedDevOrigins: ["staging.ukcarimports.ie"],
  // Email-link destinations handled by the Lumen API, not this app. Proxied
  // here (not in Apache) because the Apache-level ProxyPass with
  // ProxyPreserveHost looped the request back into this vhost (cutover
  // 2026-08-04). Rewrites forward the query string automatically.
  // Legacy static-site URLs still indexed by Google 404'd after cutover;
  // permanent redirects preserve their ranking signals (review 2026-08-05).
  async redirects() {
    return [
      { source: "/how-it-works.html", destination: "/how-it-works", permanent: true },
      // 19 Sep 2026 (owner): every phrasing of "value my car" lands on the one
      // valuation page, which keeps its Search Console history. All permanent.
      { source: "/value-my-car", destination: "/sell-my-car", permanent: true },
      { source: "/value-your-car", destination: "/sell-my-car", permanent: true },
      { source: "/car-value", destination: "/sell-my-car", permanent: true },
      { source: "/car-values", destination: "/sell-my-car", permanent: true },
      { source: "/car-value-ireland", destination: "/sell-my-car", permanent: true },
      { source: "/car-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/car-valuation-ireland", destination: "/sell-my-car", permanent: true },
      { source: "/car-valuations", destination: "/sell-my-car", permanent: true },
      { source: "/car-value-calculator", destination: "/sell-my-car", permanent: true },
      { source: "/car-valuation-calculator", destination: "/sell-my-car", permanent: true },
      { source: "/what-is-my-car-worth", destination: "/sell-my-car", permanent: true },
      { source: "/whats-my-car-worth", destination: "/sell-my-car", permanent: true },
      { source: "/how-much-is-my-car-worth", destination: "/sell-my-car", permanent: true },
      { source: "/my-car-value", destination: "/sell-my-car", permanent: true },
      { source: "/free-car-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/instant-car-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/online-car-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/trade-in-value", destination: "/sell-my-car", permanent: true },
      { source: "/trade-in-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/trade-in-my-car", destination: "/sell-my-car", permanent: true },
      { source: "/part-exchange", destination: "/sell-my-car", permanent: true },
      { source: "/part-exchange-value", destination: "/sell-my-car", permanent: true },
      { source: "/part-exchange-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/px-value", destination: "/sell-my-car", permanent: true },
      { source: "/sell-my-car-value", destination: "/sell-my-car", permanent: true },
      { source: "/used-car-value", destination: "/sell-my-car", permanent: true },
      { source: "/used-car-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/vehicle-valuation", destination: "/sell-my-car", permanent: true },
      { source: "/vehicle-value", destination: "/sell-my-car", permanent: true },
      { source: "/valuation", destination: "/sell-my-car", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/blog/polestar-2-ireland-import-guide", destination: "/blog/polestar-ireland-import-guide", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/unsubscribe", destination: "https://api.ukcarimports.ie/public/unsubscribe" },
      { source: "/verify-email", destination: "https://api.ukcarimports.ie/public/verify-email" },
      { source: "/notification-feedback", destination: "https://api.ukcarimports.ie/public/notification-feedback" },
    ];
  },
};

export default nextConfig;
