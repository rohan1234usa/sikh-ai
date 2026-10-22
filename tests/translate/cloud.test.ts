import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE_MS } from '@/lib/api/allowance';
import type * as Cloud from '@/lib/translate/cloud';

// Its own file: the allowances are module state, and these tests spend them.
// Cloud Translation is stubbed; each test says what it answers.
const realFetch = globalThis.fetch;
let calls = 0;
let answer: () => Response;
let cloud: typeof Cloud;

const translated = () => Response.json({ data: { translations: [{ translatedText: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' }] } });

before(async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key';
    delete process.env.TRANSLATE_FALLBACK;
    globalThis.fetch = (async () => {
        calls++;
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

// Runs `run` with logging on, and collects the JSON lines it writes.
async function capture(run: () => Promise<unknown>): Promise<Record<string, unknown>[]> {
    delete process.env.APP_LOG;
    const lines: Record<string, unknown>[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const collect = (line: string) => { lines.push(JSON.parse(line)); };
    console.log = collect;
    console.warn = collect;
    console.error = collect;
    try {
        await run();
    } finally {
        Object.assign(console, saved);
        process.env.APP_LOG = 'off';
    }
    return lines;
}

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
    // An hour ago, so its log line (held back or not) leaves this minute's
    // to the last test.
    assert.equal(cloud.cloudCanTranslate('compare', left + 1, Date.now() - 60 * MINUTE_MS), false, 'one more than is left');
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
        // As .env.local's `GOOGLE_TRANSLATE_API_KEY=` arrives.
        process.env.GOOGLE_TRANSLATE_API_KEY = '';
        process.env.GEMINI_API_KEY = 'gemini-key';
        assert.equal(cloud.cloudCanTranslate('fallback', 5), true, 'a blank Translate key borrows the Gemini key');
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
        delete process.env.APP_LOG;
        const saved = { log: console.log, warn: console.warn, error: console.error };
        console.log = () => { levels.push([status, 'info']); };
        console.warn = () => { levels.push([status, 'warn']); };
        console.error = () => { levels.push([status, 'error']); };
        try {
            await cloud.cloudTranslate({ text: 'a', target: 'pa', purpose: 'fallback' });
        } finally {
            Object.assign(console, saved);
            process.env.APP_LOG = 'off';
        }
    }
    assert.deepEqual(levels, [[400, 'error'], [403, 'error'], [429, 'warn'], [503, 'warn']]);
});

// Last: it spends this process's Compare allowance.
test("a day of comparisons leaves the fallback working, and the log says whose allowance ran out", async () => {
    while (cloud.cloudAllowances.compare.spend(1000));
    while (cloud.cloudAllowances.compare.spend(1));
    const lines = await capture(async () => {
        assert.equal(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose: 'compare' }), null);
    });
    assert.equal(calls, 0, 'nothing is bought');
    assert.deepEqual(lines.map(({ evt, purpose, chars }) => ({ evt, purpose, chars })), [{ evt: 'cloud_translate_ceiling', purpose: 'compare', chars: 5 }]);
    // Compare asks the same before counting anyone, and says why at most
    // once a minute: a minute nothing else has used, then once more in it.
    const later = Date.now() + 2 * MINUTE_MS;
    const asked = await capture(async () => {
        assert.equal(cloud.cloudCanTranslate('compare', 5, later), false, 'Compare says no before anyone is charged');
        assert.equal(cloud.cloudCanTranslate('compare', 5, later), false);
    });
    assert.deepEqual(asked.map(({ evt, purpose, chars, refused }) => ({ evt, purpose, chars, refused })), [{ evt: 'cloud_translate_ceiling', purpose: 'compare', chars: 5, refused: 1 }], 'one line for the minute, so a spent day can’t flood the logs');
    const next = await capture(async () => { cloud.cloudCanTranslate('compare', 5, later + MINUTE_MS); });
    assert.deepEqual(next.map(({ evt, refused }) => ({ evt, refused })), [{ evt: 'cloud_translate_ceiling', refused: 2 }], 'the next minute’s line counts the one held back');
    assert.equal(cloud.cloudCanTranslate('fallback', 5), true);
    assert.ok(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose: 'fallback' }), 'the fallback still translates');
    assert.equal(calls, 1);
});
