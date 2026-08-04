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
  async rewrites() {
    return [
      { source: "/unsubscribe", destination: "https://api.ukcarimports.ie/public/unsubscribe" },
      { source: "/verify-email", destination: "https://api.ukcarimports.ie/public/verify-email" },
      { source: "/notification-feedback", destination: "https://api.ukcarimports.ie/public/notification-feedback" },
    ];
  },
};

export default nextConfig;
