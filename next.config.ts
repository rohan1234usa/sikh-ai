import type { NextConfig } from "next";
import { CSP_REPORT_GROUP, CSP_REPORT_PATH, contentSecurityPolicy } from "./lib/csp";

// Report-only for now: see lib/csp.ts for what it allows, and why scripts
// keep 'unsafe-inline'.
const CSP = contentSecurityPolicy({
  dev: process.env.NODE_ENV === "development",
  preview: process.env.VERCEL_ENV === "preview",
  firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
});

// Sent with every page, API route and static file. Vercel already adds HSTS.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Browsers' own default, made explicit. The share page overrides it with
  // no-referrer through its own meta tag.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Nothing on the site uses these. A voice feature would need microphone=(self).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
  { key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
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
