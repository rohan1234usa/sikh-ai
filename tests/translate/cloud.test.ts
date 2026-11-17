import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE_MS } from '@/lib/api/allowance';
import type * as Cloud from '@/lib/translate/cloud';
import { logged as capture } from '../helpers/routes';

// Its own file: the allowances are module state, and these tests spend them.
// Cloud Translation is stubbed; each test says what it answers.
const realFetch = globalThis.fetch;
let calls = 0;
let lastUrl = '';
let answer: () => Response;
let cloud: typeof Cloud;

const translated = () => Response.json({ data: { translations: [{ translatedText: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' }] } });

before(async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key';
    delete process.env.TRANSLATE_FALLBACK;
    globalThis.fetch = (async (url: string | URL) => {
        calls++;
        lastUrl = String(url);
        return answer();
    }) as typeof fetch;
    cloud = await import('@/lib/translate/cloud');
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => {
    calls = 0;
    answer = translated;
    process.env.APP_LOG = 'off';
});

test("a day's allowance of characters refuses what would go past it, and starts again the next day", () => {
    let day = '2026-10-04';
    const allowance = cloud.charAllowance(10, () => day);
    assert.equal(allowance.spend(6), true);
    assert.equal(allowance.spend(5), false, 'that would make 11');
    assert.equal(allowance.remaining(), 4, 'a refusal spends nothing');
    assert.equal(allowance.spend(4), true);
    assert.equal(allowance.remaining(), 0);
    day = '2026-10-05';
    assert.equal(allowance.remaining(), 10);
});

test('the fallback and Compare each spend only their own allowance', async () => {
    const before = { fallback: cloud.cloudAllowances.fallback.remaining(), compare: cloud.cloudAllowances.compare.remaining() };
    assert.equal(before.compare, cloud.DAILY_CHAR_CEILING);
    assert.ok(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose: 'compare' }));
    assert.equal(cloud.cloudAllowances.compare.remaining(), before.compare - 5);
    assert.equal(cloud.cloudAllowances.fallback.remaining(), before.fallback);
    assert.ok(await cloud.cloudTranslate({ text: 'hi', target: 'pa', purpose: 'fallback' }));
    assert.equal(cloud.cloudAllowances.fallback.remaining(), before.fallback - 2);
    assert.equal(calls, 2);
});

test('a failed request still spends: a broken API can never be called forever', async () => {
    answer = () => new Response('oops', { status: 500 });
    const before = cloud.cloudAllowances.fallback.remaining();
    assert.equal(await cloud.cloudTranslate({ text: 'abc', target: 'pa', purpose: 'fallback' }), null);
    assert.equal(cloud.cloudAllowances.fallback.remaining(), before - 3);
});

test('whether a call would go out: Cloud on, a key, and enough of that day left', async () => {
    const left = cloud.cloudAllowances.compare.remaining();
    assert.equal(cloud.cloudCanTranslate('compare', left), true, 'all that is left');
    // The fallback's, so Compare's once-a-minute line is left for the last test.
    assert.equal(cloud.cloudCanTranslate('fallback', cloud.cloudAllowances.fallback.remaining() + 1), false, 'one more than is left');
    process.env.TRANSLATE_FALLBACK = 'off';
    assert.equal(cloud.cloudCanTranslate('fallback', 5), false, 'switched off');
    delete process.env.TRANSLATE_FALLBACK;
    const key = process.env.GOOGLE_TRANSLATE_API_KEY;
    const gemini = process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
        assert.equal(cloud.cloudCanTranslate('fallback', 5), false, 'no key');
        const lines = await capture(async () => { cloud.cloudCanTranslate('compare', 5); });
        assert.deepEqual(lines.map((l) => [l.evt, l.missing]), [['config_error', 'GOOGLE_TRANSLATE_API_KEY']], 'a missing key is logged');
    } finally {
        process.env.GOOGLE_TRANSLATE_API_KEY = key;
        if (gemini === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = gemini;
    }
    assert.equal(calls, 0, 'asking sends nothing');
    assert.equal(cloud.cloudAllowances.compare.remaining(), left, 'and spends nothing');
});

test('the switch turns every call off, fallback and Compare alike', async () => {
    for (const flag of ['0', 'false', 'OFF']) {
        process.env.TRANSLATE_FALLBACK = flag;
        for (const purpose of ['fallback', 'compare'] as const)
            assert.equal(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose }), null, `${flag} ${purpose}`);
    }
    delete process.env.TRANSLATE_FALLBACK;
    assert.equal(calls, 0);
});

test("a refusal only the owner can fix is an error line, which reaches Sentry; busy or down is a warning", async () => {
    const levels: [number, string][] = [];
    for (const status of [400, 403, 429, 503]) {
        answer = () => new Response('{}', { status });
        const lines = await capture(() => cloud.cloudTranslate({ text: 'a', target: 'pa', purpose: 'fallback' }));
        for (const { level } of lines) levels.push([status, level]);
    }
    assert.deepEqual(levels, [[400, 'error'], [403, 'error'], [429, 'warn'], [503, 'warn']]);
});

test('a blank Translate key borrows the Gemini key, and the call sends it', async () => {
    const saved = { key: process.env.GOOGLE_TRANSLATE_API_KEY, gemini: process.env.GEMINI_API_KEY };
    try {
        // As .env.local's `GOOGLE_TRANSLATE_API_KEY=` arrives.
        process.env.GOOGLE_TRANSLATE_API_KEY = '';
        process.env.GEMINI_API_KEY = 'gemini-key';
        assert.ok(await cloud.cloudTranslate({ text: 'hi', target: 'pa', purpose: 'fallback' }));
        assert.equal(new URL(lastUrl).searchParams.get('key'), 'gemini-key');
        process.env.GOOGLE_TRANSLATE_API_KEY = ' own-key ';
        assert.ok(await cloud.cloudTranslate({ text: 'hi', target: 'pa', purpose: 'fallback' }));
        assert.equal(new URL(lastUrl).searchParams.get('key'), 'own-key', 'its own, trimmed');
    } finally {
        for (const [name, value] of [['GOOGLE_TRANSLATE_API_KEY', saved.key], ['GEMINI_API_KEY', saved.gemini]] as const) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    }
});

// Last: it spends this process's Compare allowance.
test("a day of comparisons leaves the fallback working, and the log says whose allowance ran out", async () => {
    while (cloud.cloudAllowances.compare.spend(1000));
    while (cloud.cloudAllowances.compare.spend(1));
    // A call is made once its route has counted the visitor: each one that
    // finds the day spent says so.
    const lines = await capture(async () => {
        for (let i = 0; i < 2; i++) assert.equal(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose: 'compare' }), null);
    });
    assert.equal(calls, 0, 'nothing is bought');
    const ceiling = { evt: 'cloud_translate_ceiling', purpose: 'compare', chars: 5 };
    assert.deepEqual(lines.map(({ evt, purpose, chars }) => ({ evt, purpose, chars })), [ceiling, ceiling], 'a line for each call');
    // Compare asks before counting anyone, so it says why at most once a
    // minute, with a count, and a spent day can't flood the logs. The
    // minute is the clock's, so a run that crosses into the next one proves
    // nothing.
    const minute = () => Math.floor(Date.now() / MINUTE_MS);
    const started = minute();
    const asked = await capture(async () => {
        assert.equal(cloud.cloudCanTranslate('compare', 5), false, 'Compare says no before anyone is charged');
        assert.equal(cloud.cloudCanTranslate('compare', 5), false);
    });
    if (minute() === started) assert.deepEqual(asked.map(({ evt, purpose, chars, refused }) => ({ evt, purpose, chars, refused })), [{ ...ceiling, refused: 1 }], 'one line for the minute');
    assert.equal(cloud.cloudCanTranslate('fallback', 5), true);
    assert.ok(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose: 'fallback' }), 'the fallback still translates');
    assert.equal(calls, 1);
});
