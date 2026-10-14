import { test } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '@/next.config';
import { parsePolicy } from '../helpers/csp';

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
    // The Talk page records from the microphone; nothing uses the camera or
    // location, and no other site's frame may ask for any of them.
    assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(self), geolocation=()');
    // Not same-origin, which would cut off Google sign-in's popup.
    assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    assert.equal(nextConfig.poweredByHeader, false);
});

test('the Content-Security-Policy is enforced, and still reports what it blocks', async () => {
    const headers = await sentHeaders();
    assert.ok(!headers.has('content-security-policy-report-only'));
    const policy = parsePolicy(headers.get('content-security-policy') ?? '');
    assert.deepEqual(policy.get('frame-ancestors'), ["'none'"]);
    // Blocks still reach /api/csp-report: report-to for Chromium (through the
    // Reporting-Endpoints group), report-uri for the other browsers.
    assert.deepEqual(policy.get('report-to'), ['csp']);
    assert.deepEqual(policy.get('report-uri'), ['/api/csp-report']);
    assert.equal(headers.get('reporting-endpoints'), 'csp="/api/csp-report"');
});

test("each script's source map is published, for error reports' frames", () => {
    assert.equal(nextConfig.productionBrowserSourceMaps, true);
});
