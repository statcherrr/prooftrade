import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to silence warning; build with --webpack
  turbopack: {},
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
