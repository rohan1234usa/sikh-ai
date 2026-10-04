import type { NextConfig } from "next";
import { CSP_REPORT_GROUP, CSP_REPORT_PATH, contentSecurityPolicy } from "./lib/csp";
import { languageRedirects, languageRewrites } from "./lib/i18n/routing";

// Enforced: see lib/csp.ts for what it allows, and why scripts keep
// 'unsafe-inline'. To stop blocking while a problem is looked into, rename the
// header below to Content-Security-Policy-Report-Only.
const CSP = contentSecurityPolicy({
  dev: process.env.NODE_ENV === "development",
  preview: process.env.VERCEL_ENV === "preview",
  firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  emulators: process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1",
});

// Sent with every page, API route and static file. Vercel already adds HSTS.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Browsers' own default, made explicit. The share page overrides it with
  // no-referrer through its own meta tag.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Another site that opens this one in a window gets no handle on it. Not
  // same-origin, which would also cut off the popups this site opens, Google
  // sign-in's among them.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Nothing on the site uses these. A voice feature would need microphone=(self).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
  { key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // app/global-not-found.tsx: the 404 for every language (pages live under
  // app/[lang], whose layout can't serve one of its own; a language prefix in
  // the wrong case gets Next's plain 404 from that layout).
  experimental: { globalNotFound: true },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Each language's own URLs: English unprefixed, Punjabi under /pa and
  // /pa-latn, all from app/[lang] (lib/i18n/routing.ts). The rewrites come
  // after files and pages, so /og.jpg or /api/chat never reach them.
  async redirects() {
    return languageRedirects();
  },
  async rewrites() {
    return { beforeFiles: [], afterFiles: languageRewrites(), fallback: [] };
  },
};

export default nextConfig;
