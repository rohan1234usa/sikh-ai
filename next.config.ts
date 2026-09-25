import type { NextConfig } from "next";

// Sent with every page, API route and static file. Vercel already adds HSTS.
// A Content-Security-Policy is not here yet: it has to allow the pre-paint
// theme script, Google Analytics and Firebase sign-in, and it has to work
// once pages are served statically, where there is no per-request nonce.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Browsers' own default, made explicit. The share page overrides it with
  // no-referrer through its own meta tag.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Nothing on the site uses these. A voice feature would need microphone=(self).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // If the error persists, uncomment the line below to bypass type checking temporarily
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
