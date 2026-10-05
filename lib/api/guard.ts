// SERVER-ONLY: refuses a request that another website's page sent, before it
// costs anything. The AI routes, quote checking and Shabad Search call it
// first thing.
//
// Any site's page can make its visitors' browsers send requests here. The
// browser hides the answer from that page, but the request still runs, so a
// busy site could spend this one's Gemini and GurbaniNow allowances from its
// own visitors' browsers, each from a different address, where no limit per
// address can catch it. Two checks stop that:
// - Sec-Fetch-Site, which every current browser sends, says whether the page
//   that sent the request is this site's. Anything but same-origin, or none
//   (an address typed into the browser), is refused. Scripts and older
//   browsers don't send it, so they pass this check.
// - A POST has to say its body is JSON. A page may send another site a form,
//   or a no-cors fetch with a text body, without asking; to send JSON it has
//   to ask first (a preflight), and this site never says yes: Next answers
//   OPTIONS itself, without CORS headers. So no browser posts JSON here from
//   another site, however old it is.
// Scripts can send any header they like. The firewall's rate limit and the
// per-visitor allowances (lib/api/allowance.ts) are there for them.

import { logRefusal } from './refusals';

const NO_STORE = { 'Cache-Control': 'no-store' };
const THIS_SITE = new Set(['same-origin', 'none']);

// The media type alone, without parameters such as charset, in lower case.
const mediaType = (header: string | null) => (header ?? '').split(';')[0].trim().toLowerCase();

// What a refused request was, for the log: one of a few fixed words, never
// the header's own text.
const siteKind = (site: string) => (site === 'cross-site' || site === 'same-site' ? site : 'other');
function typeKind(type: string): string {
    if (type === '') return 'none';
    if (type.startsWith('text/')) return 'text';
    if (type === 'application/x-www-form-urlencoded' || type === 'multipart/form-data') return 'form';
    return 'other';
}

// The refusal to send back, or null to go on.
export function refuseCrossSite(req: Request): Response | null {
    const path = new URL(req.url).pathname;
    const site = req.headers.get('sec-fetch-site');
    if (site !== null && !THIS_SITE.has(site)) {
        logRefusal('request_refused', `${path} cross_site`, { reason: 'cross_site', site: siteKind(site) });
        return new Response(null, { status: 403, headers: NO_STORE });
    }
    if (req.method === 'POST') {
        const type = mediaType(req.headers.get('content-type'));
        if (type !== 'application/json') {
            logRefusal('request_refused', `${path} not_json`, { reason: 'not_json', type: typeKind(type) });
            return new Response(null, { status: 415, headers: NO_STORE });
        }
    }
    return null;
}
