// The site's Content-Security-Policy (#7). next.config.ts sends it on every
// response, enforced, under next dev as well: browsers block whatever it
// doesn't allow and report each block to /api/csp-report, which logs a
// csp_violation line. A feature that loads something from a new host (a
// script, an image, a connection, a frame, audio) needs the host added here,
// or that part of it stops working.
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
};

// Google Analytics (gtag), per Google's guide to the tag and CSP.
const ANALYTICS = {
    script: ['https://*.googletagmanager.com'],
    img: ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
    connect: ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
};

// Firebase: Auth's sign-in popup loads Google's gapi script and a hidden
// iframe on the auth domain; Auth and Firestore talk to *.googleapis.com.
const FIREBASE = {
    script: ['https://apis.google.com'],
    connect: ['https://*.googleapis.com'],
};

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

export function contentSecurityPolicy({ dev, preview, firebaseAuthDomain }: CspOptions): string {
    const when = (on: boolean, sources: string[]) => (on ? sources : []);
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': [
            "'self'", "'unsafe-inline'",
            ...ANALYTICS.script, ...FIREBASE.script,
            // Fast Refresh evaluates code, and Speed Insights' debug script
            // comes from Vercel's CDN; both only under next dev.
            ...when(dev, ["'unsafe-eval'", 'https://va.vercel-scripts.com']),
            ...when(preview, VERCEL_TOOLBAR.script),
        ],
        'style-src': ["'self'", "'unsafe-inline'", ...when(preview, VERCEL_TOOLBAR.style)],
        'img-src': ["'self'", 'data:', 'blob:', ...ANALYTICS.img, ...when(preview, VERCEL_TOOLBAR.img)],
        'font-src': ["'self'", 'data:', ...when(preview, VERCEL_TOOLBAR.font)],
        'connect-src': [
            "'self'",
            ...ANALYTICS.connect, ...FIREBASE.connect,
            ...when(dev, ['ws:', 'https://va.vercel-scripts.com']),
            ...when(preview, VERCEL_TOOLBAR.connect),
        ],
        'frame-src': [
            ...(firebaseAuthDomain ? [`https://${firebaseAuthDomain}`] : []),
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
