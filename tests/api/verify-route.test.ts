import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_VERIFY_CHARS } from '@/lib/gurbani/citations';
import { reply } from '../gurbani/helpers';
import { postJson, spendDay } from '../helpers/routes';

// The quote check's route. GurbaniNow is stubbed as a source that's down, so
// a check that looks something up gets no cards; every URL asked for is kept.
// What the verifier makes of real answers is tests/gurbani/verify.test.ts.
const realFetch = globalThis.fetch;
let asked: string[] = [];
let POST: (req: Request) => Promise<Response>;

before(async () => {
    process.env.APP_LOG = 'off';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        asked.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        return new Response('unavailable', { status: 503 });
    }) as typeof fetch;
    ({ POST } = await import('@/app/api/chat/verify/route'));
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => { asked = []; });

const verify = (body: unknown, headers: Record<string, string> = {}) =>
    POST(postJson('http://local/api/chat/verify', body, headers));
const QUOTING = reply('haumai-gurbani-first:36');

test('a reply that quotes Gurbani is looked up; the source being down means no cards, not an error', async () => {
    const res = await verify({ text: QUOTING });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { citations: [] });
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(asked.length >= 1, 'GurbaniNow was asked');
    assert.ok(asked.every((url) => url.startsWith('https://api.gurbaninow.com/v2/')));
});

test('a reply with no Gurmukhi in it is answered without a lookup', async () => {
    const res = await verify({ text: 'Seva is selfless service, done without wanting anything back.' });
    assert.deepEqual(await res.json(), { citations: [] });
    assert.deepEqual(asked, []);
});

test('a missing, empty or overlong text, or a body that isn’t JSON, is refused without a lookup', async () => {
    const cases: [unknown, string][] = [
        [{}, 'verify_invalid'],
        [{ text: '   ' }, 'verify_invalid'],
        [{ text: 42 }, 'verify_invalid'],
        [{ text: 'ਕ'.repeat(MAX_VERIFY_CHARS + 1) }, 'verify_too_long'],
    ];
    for (const [body, code] of cases) {
        const res = await verify(body);
        assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
        assert.equal((await res.json()).code, code);
    }
    const res = await POST(new Request('http://local/api/chat/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'verify_invalid');
    assert.deepEqual(asked, []);
});

test('an oversized body is refused before it is parsed', async () => {
    const res = await verify({ text: 'x'.repeat(2 * MAX_VERIFY_CHARS + 1000) });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, 'verify_too_large');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(asked, []);
});

test("another site's request, or a post that isn't JSON, is refused without a lookup", async () => {
    for (const [headers, status] of [[{ 'sec-fetch-site': 'cross-site' }, 403], [{ 'content-type': 'text/plain;charset=UTF-8' }, 415]] as const) {
        const res = await verify({ text: QUOTING }, headers);
        assert.equal(res.status, status, JSON.stringify(headers));
        assert.equal(res.headers.get('cache-control'), 'no-store');
    }
    assert.deepEqual(asked, []);
});

test("past the day's limit a visitor's quotes aren't looked up; a reply with nothing to look up is still answered", async () => {
    spendDay('verify', '203.0.113.80');
    const visitor = { 'x-forwarded-for': '203.0.113.80' };
    const res = await verify({ text: QUOTING }, visitor);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).code, 'verify_limit');
    assert.deepEqual(asked, []);
    const plain = await verify({ text: 'Seva is selfless service.' }, visitor);
    assert.deepEqual(await plain.json(), { citations: [] });
});
