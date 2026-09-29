// The streaming mechanics the chat and the Punjabi tutor share
// (lib/gemini/stream.ts), against the local Gemini mock. The chat's route
// tests cover them end to end too; these reach the paths a route test can't
// afford, like a model that never answers.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleGenAI } from '@google/genai';
import type { MockGemini } from '../../scripts/mock-gemini';
import { isAbortError } from '@/lib/gemini/fallback';
import { openTextStream, settleNoText, textStreamResponse, type Opened } from '@/lib/gemini/stream';
import { readStream, startRouteMock } from '../helpers/routes';

let mock: MockGemini;
let ai: GoogleGenAI;

before(async () => {
    mock = await startRouteMock();
    ai = new GoogleGenAI({ apiKey: 'test-key' });
});
after(() => mock.close());

const CALL = { feature: 'chat', model: 'gemini-3.8-flash', depth: 0 } as const;

function open(message: string, firstTextMs = 5000, signal = new AbortController().signal): Promise<Opened> {
    return openTextStream(ai, { model: 'gemini-3.8-flash', contents: message }, {
        signal,
        deadline: Date.now() + 20_000,
        firstTextMs,
    });
}

test('opening a stream reads past the signature chunk to the first text', async () => {
    const opened = await open('What is seva?');
    assert.ok(opened.kind === 'text', opened.kind);
    assert.match(opened.text, /^Waheguru Ji Ka Khalsa/);
    assert.equal(typeof opened.ttftMs, 'number');
    const { text, error } = await readStream(textStreamResponse(opened, CALL, new AbortController().signal));
    assert.equal(error, undefined);
    assert.match(text, /^Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh\. This is a \*\*mock\*\* reply from `gemini-3\.8-flash`\.$/);
});

test('the streamed response is plain text that no cache or proxy holds back', async () => {
    const opened = await open('What is simran?');
    assert.ok(opened.kind === 'text', opened.kind);
    const res = textStreamResponse(opened, CALL, new AbortController().signal);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-accel-buffering'), 'no');
    await readStream(res);
});

test('a refused prompt is blocked before any response exists', async () => {
    const opened = await open('MOCK_BLOCKED');
    assert.ok(opened.kind === 'blocked', opened.kind);
    assert.equal(opened.reason, 'SAFETY');
    assert.equal(settleNoText(opened, CALL), 'blocked');
});

test('a model that stops without a word is empty, not blocked', async () => {
    const opened = await open('MOCK_EMPTY');
    assert.ok(opened.kind === 'empty', opened.kind);
    assert.equal(settleNoText(opened, CALL), 'empty');
});

test('a model that never answers times out at the first-text wait, as an abort', async () => {
    const started = Date.now();
    await assert.rejects(open('MOCK_HANG', 200), (err) => isAbortError(err));
    assert.ok(Date.now() - started < 5000, 'it gives up at the first-text wait, not the deadline');
});

test('a reply cut by a filter keeps its text and errors the body', async () => {
    const opened = await open('MOCK_SAFETY');
    assert.ok(opened.kind === 'text', opened.kind);
    const { text, error } = await readStream(textStreamResponse(opened, CALL, new AbortController().signal));
    assert.equal(text, 'Partial answer before the filter');
    assert.ok(error, 'the body errors, so the client marks the reply interrupted');
});

test('a reply stopped by the output cap errors the body too', async () => {
    const opened = await open('MOCK_MAX_TOKENS');
    assert.ok(opened.kind === 'text', opened.kind);
    const { text, error } = await readStream(textStreamResponse(opened, CALL, new AbortController().signal));
    assert.match(text, /^Waheguru/);
    assert.ok(error);
});
