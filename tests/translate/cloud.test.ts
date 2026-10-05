import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
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

test('the switch turns every call off, fallback and Compare alike', async () => {
    for (const flag of ['0', 'false', 'OFF']) {
        process.env.TRANSLATE_FALLBACK = flag;
        for (const purpose of ['fallback', 'compare'] as const)
            assert.equal(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose }), null, `${flag} ${purpose}`);
    }
    delete process.env.TRANSLATE_FALLBACK;
    assert.equal(calls, 0);
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
    assert.ok(await cloud.cloudTranslate({ text: 'hello', target: 'pa', purpose: 'fallback' }), 'the fallback still translates');
    assert.equal(calls, 1);
});
