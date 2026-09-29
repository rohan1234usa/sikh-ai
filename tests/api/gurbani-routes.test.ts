import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

// GurbaniNow is stubbed: each test says what it answers, and every URL asked
// for is recorded.
type Upstream = (url: string) => Promise<Response>;
const realFetch = globalThis.fetch;
let upstream: Upstream;
let asked: string[] = [];

const ANG_PAYLOAD = {
    source: { id: 1, english: 'Sri Guru Granth Sahib Ji', unicode: 'ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ' },
    page: [{ line: { id: 'ONT', gurmukhi: { unicode: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ' }, translation: { english: { default: 'One Universal Creator God.' } } } }],
};
const HUKAMNAMA_PAYLOAD = {
    hukamnamainfo: { pageno: 666 },
    hukamnama: [{ line: { gurmukhi: { unicode: 'ਧਨਾਸਰੀ ਮਹਲਾ ੪' }, translation: { english: { default: 'Dhanaasaree, Fourth Mehl' } } } }],
};

let shabad: (req: Request) => Promise<Response>;
let hukamnama: () => Promise<Response>;

before(async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        asked.push(url);
        return upstream(url);
    }) as typeof fetch;
    ({ GET: shabad } = await import('@/app/api/shabad/route'));
    ({ GET: hukamnama } = await import('@/app/api/hukamnama/route'));
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => {
    asked = [];
    upstream = async (url) => Response.json(url.includes('/hukamnama/') ? HUKAMNAMA_PAYLOAD : ANG_PAYLOAD);
});

const ang = (query?: string) =>
    shabad(new Request(`http://local/api/shabad${query === undefined ? '' : `?query=${encodeURIComponent(query)}`}`));

test('an Ang outside 1–1430, or not a number, is refused without asking GurbaniNow', async () => {
    for (const [query, code] of [[undefined, 'missing_query'], ['0', 'invalid_ang'], ['1431', 'invalid_ang'], ['12a', 'invalid_ang'], ['-3', 'invalid_ang']] as const) {
        const res = await ang(query);
        assert.equal(res.status, 400, `query ${query}`);
        assert.equal((await res.json()).code, code);
        assert.equal(res.headers.get('cache-control'), 'no-store');
    }
    assert.deepEqual(asked, []);
});

test('an Ang is passed through as GurbaniNow sent it, with a long CDN cache', async () => {
    const res = await ang(' 1 ');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), ANG_PAYLOAD);
    assert.match(res.headers.get('cache-control') ?? '', /s-maxage=2592000/);
    assert.deepEqual(asked, ['https://api.gurbaninow.com/v2/ang/1']);
});

test('an upstream failure is a 502 with a code, not the upstream error text', async () => {
    upstream = async () => new Response('database exploded at node 7', { status: 500 });
    const res = await ang('1');
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.code, 'source_error');
    assert.doesNotMatch(JSON.stringify(body), /exploded|500/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('a 200 that carries no Ang page is a failure, and the CDN does not keep it', async () => {
    upstream = async () => Response.json({ error: true, data: 'nothing here' });
    const res = await ang('7');
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('a source that never answers is cut off and reported, not waited on', async () => {
    upstream = async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); };
    const res = await ang('1');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'source_error');
});

test("today's Hukamnama is normalized for the chat and cached for ten minutes", async () => {
    const res = await hukamnama();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ang, 666);
    assert.match(body.text, /ਧਨਾਸਰੀ ਮਹਲਾ ੪\nDhanaasaree, Fourth Mehl/);
    assert.match(res.headers.get('cache-control') ?? '', /s-maxage=600/);
    assert.deepEqual(asked, ['https://api.gurbaninow.com/v2/hukamnama/today']);
});

test('a missing Hukamnama is a 502 hukamnama_unavailable, never cached', async () => {
    upstream = async () => new Response('Service Unavailable', { status: 503 });
    const res = await hukamnama();
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'hukamnama_unavailable');
    assert.equal(res.headers.get('cache-control'), 'no-store');
});

test("page traffic never spends the quote checker's daily allowance", async () => {
    const { fetchAngPayload, gurbaniNow } = await import('@/lib/gurbani/gurbaninow');
    // More page lookups than the checker's daily ceiling (3,000)…
    for (let i = 0; i < 3001; i++) await fetchAngPayload(1);
    // …and the checker still gets its answer.
    assert.notEqual(await gurbaniNow.fetchAng(1), null);
});
