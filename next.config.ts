import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The live crew counter sits in the corner this badge would cover.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
