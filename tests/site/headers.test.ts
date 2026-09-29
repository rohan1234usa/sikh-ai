import { test } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '@/next.config';

async function sentHeaders() {
    const rules = await nextConfig.headers!();
    // One rule for every page, API route and static file.
    assert.deepEqual(rules.map((r) => r.source), ['/:path*']);
    return new Map(rules[0].headers.map((h) => [h.key.toLowerCase(), h.value]));
}

test('every response carries the standard security headers, and no X-Powered-By', async () => {
    const headers = await sentHeaders();
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
    // Not same-origin, which would cut off Google sign-in's popup.
    assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    assert.equal(nextConfig.poweredByHeader, false);
});

test('the Content-Security-Policy is enforced, and still reports what it blocks', async () => {
    const headers = await sentHeaders();
    const csp = headers.get('content-security-policy') ?? '';
    assert.match(csp, /frame-ancestors 'none'/);
    assert.ok(!headers.has('content-security-policy-report-only'));
    // Blocks still reach /api/csp-report: report-to for Chromium (through the
    // Reporting-Endpoints group), report-uri for the other browsers.
    assert.match(csp, /report-to csp(;|$)/);
    assert.match(csp, /report-uri \/api\/csp-report(;|$)/);
    assert.equal(headers.get('reporting-endpoints'), 'csp="/api/csp-report"');
});
