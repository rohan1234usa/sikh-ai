import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { refuseCrossSite } from '@/lib/api/guard';
import { logRefusal } from '@/lib/api/refusals';
import { clientImports, reaches } from '../helpers/clientImports';

// Collects the JSON lines logEvent writes, whatever the level.
function capture(run: () => void): Record<string, unknown>[] {
    delete process.env.APP_LOG;
    const lines: Record<string, unknown>[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const collect = (line: string) => { lines.push(JSON.parse(line)); };
    console.log = collect;
    console.warn = collect;
    console.error = collect;
    try {
        run();
    } finally {
        Object.assign(console, saved);
    }
    return lines;
}

const post = (headers: Record<string, string>, body: BodyInit | null = '{}') =>
    new Request('http://local/api/chat', { method: 'POST', headers, body });
const get = (headers: Record<string, string> = {}) => new Request('http://local/api/shabad/search?q=x', { headers });

test("the site's own pages get through: same-origin, an address typed in, or no Sec-Fetch-Site at all", () => {
    const json = { 'content-type': 'application/json' };
    assert.equal(refuseCrossSite(post({ ...json, 'sec-fetch-site': 'same-origin' })), null);
    assert.equal(refuseCrossSite(post(json)), null, 'scripts and older browsers send none');
    assert.equal(refuseCrossSite(get({ 'sec-fetch-site': 'none' })), null);
    assert.equal(refuseCrossSite(get()), null);
    for (const type of ['application/json; charset=utf-8', 'Application/JSON', ' application/json ;charset=UTF-8'])
        assert.equal(refuseCrossSite(post({ 'content-type': type })), null, type);
});

test("another site's page is refused with a 403 that is never cached, on a POST or a GET", () => {
    capture(() => {
        for (const site of ['cross-site', 'same-site', 'something-new']) {
            for (const req of [post({ 'content-type': 'application/json', 'sec-fetch-site': site }), get({ 'sec-fetch-site': site })]) {
                const res = refuseCrossSite(req);
                assert.equal(res?.status, 403, `${req.method} ${site}`);
                assert.equal(res.headers.get('cache-control'), 'no-store');
                assert.equal(res.body, null);
            }
        }
    });
});

test("a POST that doesn't say JSON is refused with a 415: a form, a text body, or nothing at all", () => {
    capture(() => {
        const cases: [Record<string, string>, BodyInit | null][] = [
            [{}, '{}'], // a string body is sent as text/plain
            [{ 'content-type': 'text/plain;charset=UTF-8' }, '{}'],
            [{ 'content-type': 'application/x-www-form-urlencoded' }, 'message=hi'],
            [{ 'content-type': 'multipart/form-data; boundary=x' }, '--x--'],
            [{}, null],
            [{ 'content-type': 'application/jsonp' }, '{}'],
        ];
        for (const [headers, body] of cases) {
            const res = refuseCrossSite(post(headers, body));
            assert.equal(res?.status, 415, JSON.stringify(headers));
            assert.equal(res.headers.get('cache-control'), 'no-store');
        }
    });
    assert.equal(refuseCrossSite(get({ 'content-type': 'text/plain' })), null, 'a GET has no body to check');
});

test('a refusal is logged as one of a few fixed words, never the header it came with', () => {
    const lines = capture(() => {
        refuseCrossSite(new Request('http://local/api/learn', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }));
        refuseCrossSite(new Request('http://local/api/learn', { method: 'POST', headers: { 'content-type': 'text/my-private-type' }, body: 'x' }));
        refuseCrossSite(new Request('http://local/api/translate', { method: 'POST', headers: { 'sec-fetch-site': 'my-private-site' } }));
    });
    assert.deepEqual(lines.map(({ evt, reason, site, type, refused }) => ({ evt, reason, site, type, refused })), [
        { evt: 'request_refused', reason: 'cross_site', site: 'cross-site', type: undefined, refused: 1 },
        { evt: 'request_refused', reason: 'not_json', site: undefined, type: 'text', refused: 1 },
        { evt: 'request_refused', reason: 'cross_site', site: 'other', type: undefined, refused: 1 },
    ]);
    assert.equal(JSON.stringify(lines).includes('private'), false);
});

test('refusals are logged at most once a minute for each route and reason, with how many there were', () => {
    // Keys no other test uses: the counts are module state.
    const minute = 29_000_000 * 60_000;
    const lines = capture(() => {
        logRefusal('request_refused', '/test a', { reason: 'a' }, minute);
        for (let i = 1; i <= 5; i++) logRefusal('request_refused', '/test a', { reason: 'a' }, minute + i * 1000);
        logRefusal('request_refused', '/test b', { reason: 'b' }, minute + 6000);
        logRefusal('request_refused', '/other a', { reason: 'a' }, minute + 7000);
        logRefusal('request_refused', '/test a', { reason: 'a' }, minute + 60_000);
        logRefusal('request_refused', '/test a', { reason: 'a' }, minute + 120_000);
    });
    assert.deepEqual(lines.map((l) => [l.reason, l.refused]), [['a', 1], ['b', 1], ['a', 1], ['a', 6], ['a', 1]],
        'the next minute carries the 5 held back, plus its own');
});

test('no page loads lib/api: it runs only in the API routes', () => {
    const imports = clientImports();
    assert.ok(imports.length > 50, 'found the client components');
    for (const i of imports) assert.ok(!reaches(i.target, join('lib', 'api')), `${i.file} imports ${i.spec}`);
});
