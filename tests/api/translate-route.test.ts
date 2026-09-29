import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MockGemini } from '../../scripts/mock-gemini';
import { MAX_TRANSLATE_CHARS } from '@/lib/translate/config';
import { captured, postJson, startRouteMock } from '../helpers/routes';

let mock: MockGemini;
let POST: (req: Request) => Promise<Response>;
let cloudCalls = 0;
const realFetch = globalThis.fetch;

before(async () => {
    mock = await startRouteMock();
    delete process.env.TRANSLATE_FALLBACK;
    // Cloud Translation is stubbed; every other request (the SDK's calls to
    // the mock) passes through.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('translation.googleapis.com')) {
            cloudCalls++;
            return Response.json({ data: { translations: [{ translatedText: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', detectedSourceLanguage: 'en' }] } });
        }
        return realFetch(input, init);
    }) as typeof fetch;
    ({ POST } = await import('@/app/api/translate/route'));
});
after(async () => {
    globalThis.fetch = realFetch;
    await mock.close();
});
beforeEach(() => { cloudCalls = 0; });

const translate = (text: string, sourceHint = 'auto') =>
    POST(postJson('http://local/api/translate', { text, sourceHint }));

type WireBody = { generationConfig: Record<string, unknown> & { thinkingConfig: { thinkingLevel: string } } };

test('translates through the pinned model with the shared request', async () => {
    const { result: res, requests } = await captured(mock, () => translate('Ki haal hai?'));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.roman, 'Ki haal hai?');
    assert.equal(data.gurmukhi, 'ਕੀ ਹਾਲ ਹੈ?');
    assert.deepEqual(requests.map(r => r.model), ['gemini-3.8-flash']);
    const config = (requests[0].body as WireBody).generationConfig;
    assert.equal(config.responseMimeType, 'application/json');
    assert.equal(config.maxOutputTokens, 8192);
    assert.equal(config.thinkingConfig.thinkingLevel, 'LOW');
    assert.equal('temperature' in config, false);
});

test('a rate-limited pinned model is answered by the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => translate('MOCK_429_FIRST main theek haan', 'punjabi-latin'));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).fallback, undefined);
    assert.deepEqual(requests.map(r => r.model), ['gemini-3.8-flash', 'gemini-3.7-flash']);
});

test('both models rate-limited: romanized input gets the busy message, no Cloud call', async () => {
    const { result: res, requests } = await captured(mock, () => translate('MOCK_429 main theek haan', 'punjabi-latin'));
    assert.equal(res.status, 429);
    assert.equal((await res.json()).code, 'translate_busy');
    assert.equal(requests.length, 2);
    assert.equal(cloudCalls, 0, 'Cloud Translation cannot read romanized Punjabi');
});

test('both models rate-limited: English input still gets a basic Cloud translation', async () => {
    const res = await translate('MOCK_429 hello', 'english');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).fallback, 'cloud');
    assert.equal(cloudCalls, 1);
});

test('a truncated reply falls back to Cloud when it can', async () => {
    const res = await translate('MOCK_MAX_TOKENS hello', 'english');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).fallback, 'cloud');
});

test('a truncated reply with no fallback available is translate_too_long', async () => {
    const res = await translate('MOCK_MAX_TOKENS main theek haan', 'punjabi-latin');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'translate_too_long');
    assert.equal(cloudCalls, 0);
});

test('unusable output with no fallback available is translate_failed', async () => {
    const res = await translate('MOCK_GARBAGE main theek haan', 'punjabi-latin');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'translate_failed');
});

test('a rejected request is not retried on the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => translate('MOCK_400 main theek haan', 'punjabi-latin'));
    assert.equal(res.status, 500);
    assert.equal((await res.json()).code, 'translate_failed');
    assert.equal(requests.length, 1);
});

test('an oversized body is refused before it is parsed or sent anywhere', async () => {
    const { result: res, requests } = await captured(mock, () => translate('x'.repeat(5000)));
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, 'translate_too_long');
    assert.equal(requests.length, 0);
    assert.equal(cloudCalls, 0);
});

test('the longest text a client sends, in characters JSON escapes, is still translated', async () => {
    const res = await translate('"'.repeat(MAX_TRANSLATE_CHARS), 'english');
    assert.notEqual(res.status, 413);
});

test('the cross-check refuses an oversized body too', async () => {
    const { POST: crosscheck } = await import('@/app/api/translate/crosscheck/route');
    const res = await crosscheck(postJson('http://local/api/translate/crosscheck', { text: 'x'.repeat(10_000), direction: 'en-pa' }));
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, 'translate_too_long');
    assert.equal(cloudCalls, 0);
});
