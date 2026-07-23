import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-mode HMR websocket is blocked cross-origin by default; the app is
  // reached at staging.ukcarimports.ie (via Apache reverse proxy), not
  // localhost, so it needs to be explicitly allowlisted.
  allowedDevOrigins: ["staging.ukcarimports.ie"],
};

export default nextConfig;
