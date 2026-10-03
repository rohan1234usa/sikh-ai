// The site's Content-Security-Policy (#7). next.config.ts sends it on every
// response, enforced, under next dev as well: browsers block whatever it
// doesn't allow and report each block to /api/csp-report, which logs a
// csp_violation line. A feature that loads something from a new host (a
// script, an image, a connection, a frame) needs the host added here, or that
// part of it stops working, and a line on /privacy, which names every service
// a visitor's browser talks to. Audio and video fall back to default-src
// 'self': playing one from another host, or from a blob: or data: URL, needs
// a media-src directive first.
//
// Scripts keep 'unsafe-inline'. Next sends each page's data in inline
// <script> tags, and a per-request nonce would make every page dynamic again
// (pages are meant to come from the CDN, #9). A hash would switch
// 'unsafe-inline' off for those tags. So the policy guards where scripts,
// frames and connections may come from, and who may frame the site, rather
// than inline code.
//
// Relative imports only: next.config.ts loads this at build time.

export type CspOptions = {
    dev: boolean;               // next dev: eval for Fast Refresh, and its websocket
    preview: boolean;           // a Vercel preview deployment, which adds its toolbar
    firebaseAuthDomain?: string; // where Google sign-in's helper iframe lives
    emulators?: boolean;        // next dev against the local Firebase emulators
};

// Visit counts and page speed (app/components/SiteAnalytics.tsx) are
// Vercel's Web Analytics and Speed Insights, whose scripts and reports use
// this site's own address, so 'self' covers them; nothing else counts visits.

// Firebase: Auth's sign-in popup loads Google's gapi script and a hidden
// iframe on the auth domain; Auth and Firestore talk to *.googleapis.com.
const FIREBASE = {
    script: ['https://apis.google.com'],
    connect: ['https://*.googleapis.com'],
};

// The Firebase emulators (lib/firebase/config.ts), for local testing under
// next dev only: Auth's sign-in page and helper iframe, and both APIs.
const EMULATORS = ['http://127.0.0.1:9099', 'http://127.0.0.1:8080'];

// Vercel's toolbar and comments, on preview deployments only.
const VERCEL_TOOLBAR = {
    script: ['https://vercel.live', 'https://vercel.com'],
    connect: ['https://vercel.live', 'https://vercel.com', 'https://*.pusher.com', 'wss://*.pusher.com'],
    img: ['https://vercel.live', 'https://vercel.com', 'https://*.pusher.com'],
    frame: ['https://vercel.live', 'https://vercel.com'],
    style: ['https://vercel.live'],
    font: ['https://vercel.live', 'https://assets.vercel.com'],
};

// Where browsers send reports: the report-to group (Reporting-Endpoints
// header) for Chromium, report-uri for the rest.
export const CSP_REPORT_PATH = '/api/csp-report';
export const CSP_REPORT_GROUP = 'csp';

export function contentSecurityPolicy({ dev, preview, firebaseAuthDomain, emulators = false }: CspOptions): string {
    const when = (on: boolean, sources: string[]) => (on ? sources : []);
    const local = dev && emulators;
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': [
            "'self'", "'unsafe-inline'",
            ...FIREBASE.script,
            // Fast Refresh evaluates code, and Web Analytics' and Speed
            // Insights' debug scripts come from Vercel's CDN; all only under
            // next dev.
            ...when(dev, ["'unsafe-eval'", 'https://va.vercel-scripts.com']),
            ...when(preview, VERCEL_TOOLBAR.script),
        ],
        'style-src': ["'self'", "'unsafe-inline'", ...when(preview, VERCEL_TOOLBAR.style)],
        'img-src': ["'self'", 'data:', 'blob:', ...when(preview, VERCEL_TOOLBAR.img)],
        'font-src': ["'self'", 'data:', ...when(preview, VERCEL_TOOLBAR.font)],
        'connect-src': [
            "'self'",
            ...FIREBASE.connect,
            ...when(dev, ['ws:', 'https://va.vercel-scripts.com']),
            ...when(local, EMULATORS),
            ...when(preview, VERCEL_TOOLBAR.connect),
        ],
        'frame-src': [
            ...(firebaseAuthDomain ? [`https://${firebaseAuthDomain}`] : []),
            ...when(local, EMULATORS.slice(0, 1)),
            ...when(preview, VERCEL_TOOLBAR.frame),
        ],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'report-uri': [CSP_REPORT_PATH],
        'report-to': [CSP_REPORT_GROUP],
    };
    return Object.entries(directives)
        .map(([name, sources]) => (sources.length ? `${name} ${sources.join(' ')}` : `${name} 'none'`))
        .join('; ');
}
