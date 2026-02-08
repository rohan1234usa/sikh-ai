import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  // If the error persists, uncomment the line below to bypass type checking temporarily
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;