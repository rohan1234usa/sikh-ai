import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_REPORTS_PER_REQUEST, summarizeCspReports } from '@/lib/cspReport';

test('a report-uri report becomes its directive, the blocked origin and the page path', () => {
    const body = {
        'csp-report': {
            'document-uri': 'https://sikhai.vercel.app/chat?context=my%20private%20question',
            'effective-directive': 'script-src-elem',
            'blocked-uri': 'https://evil.example/x.js?token=abc',
            'script-sample': 'alert("user text")',
        },
    };
    assert.deepEqual(summarizeCspReports(body), [{ directive: 'script-src-elem', blocked: 'https://evil.example', page: '/chat' }]);
});

test('Reporting API batches are read too, keywords kept, and floods cut short', () => {
    const report = (blockedURL: string) => ({
        type: 'csp-violation',
        body: { documentURL: 'https://sikhai.vercel.app/seva', effectiveDirective: 'script-src-elem', blockedURL },
    });
    assert.deepEqual(summarizeCspReports([report('inline'), report('data:image/png;base64,AAAA'), { type: 'deprecation', body: {} }]), [
        { directive: 'script-src-elem', blocked: 'inline', page: '/seva' },
        { directive: 'script-src-elem', blocked: 'data', page: '/seva' },
    ]);
    assert.equal(summarizeCspReports(Array.from({ length: 50 }, () => report('eval'))).length, MAX_REPORTS_PER_REQUEST);
});

test('anything else yields nothing, or unknown fields', () => {
    assert.deepEqual(summarizeCspReports(null), []);
    assert.deepEqual(summarizeCspReports('nope'), []);
    assert.deepEqual(summarizeCspReports({ 'csp-report': { 'effective-directive': 'Script Src <b>' } }),
        [{ directive: 'unknown', blocked: 'none', page: 'unknown' }]);
});

let POST: (req: Request) => Promise<Response>;
before(async () => {
    process.env.APP_LOG = 'off';
    ({ POST } = await import('@/app/api/csp-report/route'));
});
const post = (body: string, type = 'application/csp-report') =>
    POST(new Request('http://local/api/csp-report', { method: 'POST', headers: { 'content-type': type }, body }));

test('the endpoint answers 204 to reports, and refuses junk and floods', async () => {
    assert.equal((await post(JSON.stringify({ 'csp-report': { 'effective-directive': 'img-src' } }))).status, 204);
    assert.equal((await post('[]', 'application/reports+json')).status, 204);
    assert.equal((await post('{not json')).status, 400);
    assert.equal((await post('x'.repeat(70_000))).status, 413);
});
