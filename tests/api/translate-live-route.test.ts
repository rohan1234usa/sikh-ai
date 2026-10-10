import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MockGemini } from '../../scripts/mock-gemini';
import { MINUTE_MS, VISITOR_LIMITS } from '@/lib/api/allowance';
import { MAX_LIVE_CHARS, parseLiveLines } from '@/lib/translate/live';
import { ROMANIZATION_RULES } from '@/lib/translate/romanization';
import { captured, postJson, readStream, spendDay, startRouteMock } from '../helpers/routes';

let mock: MockGemini;
let POST: (req: Request) => Promise<Response>;

before(async () => {
    mock = await startRouteMock();
    ({ POST } = await import('@/app/api/translate/live/route'));
});
after(() => mock.close());

const URL = 'http://local/api/translate/live';
const live = (text: string, extra: object = {}, headers: Record<string, string> = {}) =>
    POST(postJson(URL, { text, sourceHint: 'auto', ...extra }, headers));

type WireBody = {
    contents: { parts: { text: string }[] }[];
    systemInstruction: { parts: { text: string }[] };
    generationConfig: Record<string, unknown> & { maxOutputTokens: number; thinkingConfig: { thinkingLevel: string } };
};
const instructionOf = (body: unknown) => (body as WireBody).systemInstruction.parts[0].text;

test('streams the four lines as plain text', async () => {
    const { result: res, requests } = await captured(mock, () => live('ki haal hai ji'));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { text, error } = await readStream(res);
    assert.equal(error, undefined);
    assert.deepEqual(parseLiveLines(text, true), {
        input: 'punjabi-latin',
        gurmukhi: 'ਕੀ ਹਾਲ ਹੈ?',
        roman: 'ki haal hai ji',
        english: 'How are you?',
    });
    assert.deepEqual(requests.map((r) => [r.model, r.op]), [['gemini-3.8-flash', 'streamGenerateContent']]);
});

test('sends the live request: the fenced text, the live instruction, a small cap, LOW thinking, no schema', async () => {
    const { result: res, requests } = await captured(mock, () => live('main theek haan'));
    await readStream(res);
    const body = requests[0].body as WireBody;
    assert.match(body.contents[0].parts[0].text, /^--- BEGIN TEXT [0-9a-f]{8} ---\nmain theek haan\n--- END TEXT [0-9a-f]{8} ---$/);
    const instruction = instructionOf(body);
    assert.match(instruction, /^You are the SikhAI translator/);
    assert.ok(instruction.includes(ROMANIZATION_RULES));
    assert.match(instruction, /^GURMUKHI: /m);
    assert.equal(body.generationConfig.maxOutputTokens, 1024);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
    assert.equal('responseMimeType' in body.generationConfig, false);
    assert.equal('responseSchema' in body.generationConfig, false);
});

test('the text is trimmed before it is fenced', async () => {
    const { result: res, requests } = await captured(mock, () => live('  \n main theek haan \n '));
    await readStream(res);
    assert.match((requests[0].body as WireBody).contents[0].parts[0].text, /---\nmain theek haan\n---/);
});

test('the script is checked on the server, and the hint shapes the instruction', async () => {
    const cases: [string, string, RegExp][] = [
        ['ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ', 'english', /Set the INPUT line to "punjabi-gurmukhi"/],
        ['how are you doing', 'english', /stated the input is English.*set the INPUT line to "english"/],
        ['tusi kiven ho', 'punjabi-latin', /set the INPUT line to "punjabi-latin"/],
        ['tusi kiven ho', 'nonsense', /report your conclusion in the INPUT line/],
    ];
    for (const [text, sourceHint, expected] of cases) {
        const { result: res, requests } = await captured(mock, () => live(text, { sourceHint }));
        await readStream(res);
        assert.match(instructionOf(requests[0].body), expected, `${text} / ${sourceHint}`);
    }
});

test('a rate-limited pinned model is answered by the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => live('MOCK_429_FIRST ki haal hai'));
    assert.equal(res.status, 200);
    await readStream(res);
    assert.deepEqual(requests.map((r) => r.model), ['gemini-3.8-flash', 'gemini-3.7-flash']);
});

test('both models busy: 429 or 503 translate_live_busy', async () => {
    for (const [trigger, status] of [['MOCK_429', 429], ['MOCK_503', 503]] as const) {
        const res = await live(`${trigger} ki haal hai`);
        assert.equal(res.status, status, trigger);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal((await res.json()).code, 'translate_live_busy');
    }
});

test('a rejected request is not retried on the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => live('MOCK_400 ki haal hai'));
    assert.equal(res.status, 500);
    assert.equal((await res.json()).code, 'translate_live_failed');
    assert.equal(requests.length, 1);
});

test('a blocked prompt is translate_live_blocked; no text at all is translate_live_failed', async () => {
    let res = await live('MOCK_BLOCKED ki haal hai');
    assert.equal(res.status, 422);
    assert.equal((await res.json()).code, 'translate_live_blocked');
    res = await live('MOCK_EMPTY ki haal hai');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'translate_live_failed');
});

test('lines cut short keep what came and error the body', async () => {
    for (const trigger of ['MOCK_SAFETY', 'MOCK_MAX_TOKENS']) {
        const res = await live(`${trigger} ki haal hai`);
        assert.equal(res.status, 200);
        const { text, error } = await readStream(res);
        assert.ok(text.length > 0, trigger);
        assert.ok(error, `${trigger}: the body must error so the page marks the lines cut off`);
    }
});

test('a call the page abandons before the reply starts answers 499', async () => {
    const controller = new AbortController();
    const req = new Request(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'MOCK_HANG ki haal hai', sourceHint: 'auto' }),
        signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    const { result: res, requests } = await captured(mock, () => POST(req));
    assert.equal(res.status, 499);
    assert.equal(requests.length, 1, 'not retried on the fallback');
});

test('empty, overlong or malformed text is refused before any model call', async () => {
    const cases: [unknown, number, string][] = [
        [{ text: '   ' }, 400, 'translate_live_empty'],
        [{ text: 42 }, 400, 'translate_live_empty'],
        [{ text: 'x'.repeat(MAX_LIVE_CHARS + 1) }, 400, 'translate_live_too_long'],
        [{ text: '"'.repeat(MAX_LIVE_CHARS + 300) }, 413, 'translate_live_too_long'],
    ];
    for (const [body, status, code] of cases) {
        const { result: res, requests } = await captured(mock, () => POST(postJson(URL, body)));
        assert.equal(res.status, status, JSON.stringify(body).slice(0, 40));
        assert.equal((await res.json()).code, code);
        assert.equal(requests.length, 0);
    }
    for (const raw of ['{not json', 'null', '[]', '"hello"']) {
        const req = new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
        const { result: res, requests } = await captured(mock, () => POST(req));
        assert.equal(res.status, 400, raw);
        assert.equal(requests.length, 0);
    }
});

test('the largest text a page sends still gets an answer', async () => {
    // At the cap, in characters JSON has to escape.
    const res = await live('"\n'.repeat(MAX_LIVE_CHARS / 2));
    assert.equal(res.status, 200);
    await readStream(res);
});

test("another site's request, or a post that isn't JSON, is refused before any model call", async () => {
    for (const [headers, status] of [[{ 'sec-fetch-site': 'cross-site' }, 403], [{ 'content-type': 'text/plain;charset=UTF-8' }, 415]] as const) {
        const { result: res, requests } = await captured(mock, () => live('ki haal hai', {}, headers));
        assert.equal(res.status, status, JSON.stringify(headers));
        assert.equal(requests.length, 0);
    }
});

test('live calls count against their own allowance, not the Translate button’s', async () => {
    const visitor = { 'x-forwarded-for': '203.0.113.70' };
    spendDay('translateLive', '203.0.113.70');
    const { result: res, requests } = await captured(mock, () => live('ki haal hai', {}, visitor));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(Number(res.headers.get('retry-after')) > 0);
    assert.equal((await res.json()).code, 'translate_live_limit');
    assert.equal(requests.length, 0);

    // A minute's worth from another address, then one more. The minute is
    // the clock's, so a run that crosses into the next one proves nothing.
    const other = { 'x-forwarded-for': '203.0.113.71' };
    const minute = () => Math.floor(Date.now() / MINUTE_MS);
    const started = minute();
    for (let i = 0; i < VISITOR_LIMITS.translateLive.perMinute; i++) await readStream(await live('ki haal hai', {}, other));
    const refused = await live('ki haal hai', {}, other);
    if (minute() !== started) return;
    assert.equal(refused.status, 429);
    assert.equal((await refused.json()).code, 'translate_live_busy');
});
