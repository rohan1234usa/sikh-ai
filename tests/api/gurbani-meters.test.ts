import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type * as GurbaniNow from '@/lib/gurbani/gurbaninow';

// Its own file: the meters are module state, and these tests spend them.
// GurbaniNow is stubbed, and every URL asked for is recorded.
const realFetch = globalThis.fetch;
let asked: string[] = [];
let g: typeof GurbaniNow;

const ANG = {
    source: { id: 1, english: 'Sri Guru Granth Sahib Ji', unicode: 'ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ' },
    page: [{ line: { id: 'X1', shabadid: 'S1', gurmukhi: { unicode: 'ਲਾਈਨ' } } }],
};

before(async () => {
    process.env.APP_LOG = 'off';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        asked.push(url);
        return Response.json(url.includes('/ang/') ? ANG : { count: 0, shabads: [], error: false });
    }) as typeof fetch;
    g = await import('@/lib/gurbani/gurbaninow');
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => { asked = []; });

test('a daily meter refuses past its ceiling and starts again the next day', () => {
    let day = '2026-10-02';
    const meter = g.dailyMeter(2, () => day);
    assert.equal(meter.remaining(), 2);
    assert.equal(meter.take(), true);
    assert.equal(meter.take(), true);
    assert.equal(meter.take(), false, 'the third call of the day is refused');
    assert.equal(meter.remaining(), 0);
    day = '2026-10-03';
    assert.equal(meter.remaining(), 2, 'a new day, a new allowance');
    assert.equal(meter.take(), true);
});

test('Shabad Search asks for Sri Guru Granth Sahib Ji only; the quote checker asks everywhere', async () => {
    await g.verseSearchClient.searchLines('ਸਪਨਹ', g.SEARCH_TYPES.firstLettersStart, 30);
    await g.gurbaniNow.searchLines('ਸਪਨਹ', g.SEARCH_TYPES.firstLettersStart, 30);
    const [search, check] = asked;
    assert.match(search, /[?&]source=1(&|$)/);
    assert.doesNotMatch(check, /source=/);
    assert.equal(new URL(search).searchParams.get('searchtype'), '0');
    assert.equal(new URL(search).searchParams.get('results'), '30');
});

test('only Gurmukhi reaches the upstream URL: no Latin, and no wildcards', async () => {
    await g.verseSearchClient.searchLines('ਸ_ਪ%ਨ abc ਹ', g.SEARCH_TYPES.firstLettersAnywhere, 30);
    const path = decodeURIComponent(new URL(asked[0]).pathname);
    assert.equal(path, '/v2/search/ਸਪਨ ਹ');
    asked = [];
    assert.deepEqual(await g.verseSearchClient.searchLines('so purakh %_', g.SEARCH_TYPES.phrase, 30), []);
    assert.deepEqual(asked, [], 'nothing left to ask, so nothing is asked');
});

test('each client spends only its own allowance, and page traffic spends neither', async () => {
    const before = { check: g.meters.quoteCheck.remaining(), search: g.meters.verseSearch.remaining() };
    await g.gurbaniNow.fetchAng(1);
    assert.equal(g.meters.quoteCheck.remaining(), before.check - 1);
    assert.equal(g.meters.verseSearch.remaining(), before.search);
    await g.verseSearchClient.searchLines('ਸਪਨਹ', g.SEARCH_TYPES.firstLettersStart, 30);
    assert.equal(g.meters.verseSearch.remaining(), before.search - 1);
    assert.equal(g.meters.quoteCheck.remaining(), before.check - 1);
    for (let i = 0; i < 10; i++) await g.fetchAngPayload(1);
    assert.equal(g.meters.quoteCheck.remaining(), before.check - 1, 'Ang pages are not metered');
    assert.equal(g.meters.verseSearch.remaining(), before.search - 1);
});

test('a spent search allowance stops searching, and leaves quote checking alone', async () => {
    while (g.meters.verseSearch.take());
    asked = [];
    assert.equal(await g.verseSearchClient.searchLines('ਸਪਨਹ', g.SEARCH_TYPES.firstLettersStart, 30), null, 'no allowance is no answer');
    assert.deepEqual(asked, [], 'and nothing is asked');
    assert.notEqual(await g.gurbaniNow.fetchAng(1), null);
    assert.notEqual(await g.gurbaniNow.searchLines('ਸਪਨਹ', g.SEARCH_TYPES.firstLettersStart, 30), null);
});
