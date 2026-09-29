import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MockGemini } from '../../scripts/mock-gemini';
import { MAX_CONTEXT_TEXT_CHARS, MAX_CONTEXT_TITLE_CHARS, MAX_MESSAGE_CHARS } from '@/lib/chat/config';
import { MAX_CHAT_BODY_CHARS } from '@/lib/chat/request';
import { captured, postJson, readStream, startRouteMock } from '../helpers/routes';

let mock: MockGemini;
let POST: (req: Request) => Promise<Response>;

before(async () => {
    mock = await startRouteMock();
    ({ POST } = await import('@/app/api/chat/route'));
});
after(() => mock.close());

const chat = (message: string, extra: object = {}) =>
    POST(postJson('http://local/api/chat', { message, history: [], ...extra }));

type WireBody = {
    contents: { role: string }[];
    systemInstruction: { parts: { text: string }[] };
    generationConfig: Record<string, unknown> & { thinkingConfig: { thinkingLevel: string } };
};

test('streams a reply, skipping the signature-only first chunk', async () => {
    const { result: res, requests } = await captured(mock, () => chat('What is seva?'));
    assert.equal(res.status, 200);
    const { text, error } = await readStream(res);
    assert.equal(error, undefined);
    assert.match(text, /^Waheguru Ji Ka Khalsa/);
    assert.match(text, /gemini-3\.8-flash/);
    assert.deepEqual(requests.map(r => r.model), ['gemini-3.8-flash']);
});

test('sends the shared request: history, system prompt, LOW thinking, capped output', async () => {
    const history = [{ role: 'user', text: 'Sat Sri Akal' }, { role: 'ai', text: 'Sat Sri Akal ji!' }];
    const { result: res, requests } = await captured(mock, () => chat('What is simran?', { history, lensId: 'guru-nanak' }));
    await readStream(res);
    const body = requests[0].body as WireBody;
    assert.deepEqual(body.contents.map(c => c.role), ['user', 'model', 'user']);
    assert.match(body.systemInstruction.parts[0].text, /Guru Nanak Dev Ji/);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
    assert.equal(body.generationConfig.maxOutputTokens, 4096);
    assert.equal('temperature' in body.generationConfig, false);
    assert.equal('httpOptions' in body.generationConfig, false, 'transport settings stay client-side');
});

test('a rate-limited pinned model is answered by the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => chat('MOCK_429_FIRST what is hukam?'));
    assert.equal(res.status, 200);
    const { text } = await readStream(res);
    assert.match(text, /gemini-3\.7-flash/);
    assert.deepEqual(requests.map(r => r.model), ['gemini-3.8-flash', 'gemini-3.7-flash']);
});

test('both models rate-limited: 429 chat_busy', async () => {
    const { result: res, requests } = await captured(mock, () => chat('MOCK_429 hello'));
    assert.equal(res.status, 429);
    assert.equal((await res.json()).code, 'chat_busy');
    assert.equal(requests.length, 2);
});

test('both models overloaded: 503 chat_busy', async () => {
    const res = await chat('MOCK_503 hello');
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'chat_busy');
});

test('a rejected request is not retried on the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => chat('MOCK_400 hello'));
    assert.equal(res.status, 500);
    assert.equal((await res.json()).code, 'chat_failed');
    assert.equal(requests.length, 1);
});

test('a blocked prompt gets chat_blocked, not a broken stream', async () => {
    const { result: res, requests } = await captured(mock, () => chat('MOCK_BLOCKED hello'));
    assert.equal(res.status, 422);
    assert.equal((await res.json()).code, 'chat_blocked');
    assert.equal(requests.length, 1, 'a refusal is not retried on another model');
});

test('a reply with no text at all is a chat_failed, not an empty bubble', async () => {
    const res = await chat('MOCK_EMPTY hello');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'chat_failed');
});

test('a reply cut by a safety filter keeps its partial text and errors the body', async () => {
    const res = await chat('MOCK_SAFETY hello');
    assert.equal(res.status, 200);
    const { text, error } = await readStream(res);
    assert.equal(text, 'Partial answer before the filter');
    assert.ok(error, 'the body must error so the client marks the reply interrupted');
});

test('a reply stopped by the output cap is reported as cut short', async () => {
    const res = await chat('MOCK_MAX_TOKENS hello');
    const { text, error } = await readStream(res);
    assert.ok(text.length > 0);
    assert.ok(error, 'a capped reply must not pass as complete');
});

test('input validation happens before any model call', async () => {
    const { result: res, requests } = await captured(mock, () => chat('   '));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'chat_empty');
    assert.equal(requests.length, 0);
});

test('an oversized body is refused before it is parsed or sent anywhere', async () => {
    const huge = new Request('http://local/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hi', history: [{ role: 'user', text: 'x'.repeat(MAX_CHAT_BODY_CHARS) }] }),
    });
    const { result: res, requests } = await captured(mock, () => POST(huge));
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, 'chat_too_long');
    assert.equal(requests.length, 0);
});

test('the largest body a real client sends still gets an answer', async () => {
    // Every field at its cap, in characters JSON has to escape.
    const full = '"\n'.repeat(MAX_MESSAGE_CHARS / 2);
    const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'ai' : 'user', text: full }));
    const context = { type: 'shabad', title: '"'.repeat(MAX_CONTEXT_TITLE_CHARS), text: '"'.repeat(MAX_CONTEXT_TEXT_CHARS) };
    const res = await chat(full, { history, context, lensId: 'guru-tegh-bahadur', modeId: 'gurbani-first', languageId: 'bilingual' });
    assert.equal(res.status, 200);
    await readStream(res);
});
