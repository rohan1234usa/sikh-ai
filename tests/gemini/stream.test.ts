// The streaming mechanics the chat and the Punjabi tutor share
// (lib/gemini/stream.ts), against the local Gemini mock. The chat's route
// tests cover them end to end too; these reach the paths a route test can't
// afford, like a model that never answers.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { FinishReason, GoogleGenAI } from '@google/genai';
import { startMockGemini, type MockGemini } from '../../scripts/mock-gemini';
import { isAbortError } from '@/lib/gemini/fallback';
import { openTextStream, readWholeText, settleNoText, textStreamResponse, type Opened } from '@/lib/gemini/stream';
import { parseTranslationResult } from '@/lib/translate/parse';
import { buildTranslateRequest } from '@/lib/translate/prompts';
import { captured, logged, readStream, startRouteMock } from '../helpers/routes';

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

test('a reader who leaves (Stop) stops Gemini generating, instead of paying for the rest', async () => {
    // Its own mock, with a gap between chunks, so the reply is still
    // streaming when the reader cancels.
    const slow = await startMockGemini({ chunkDelayMs: 50 });
    try {
        const slowAi = new GoogleGenAI({ apiKey: 'test-key', httpOptions: { baseUrl: slow.url } });
        const opened = await openTextStream(slowAi, { model: 'gemini-3.8-flash', contents: 'MOCK_LONG' }, {
            signal: new AbortController().signal,
            deadline: Date.now() + 20_000,
            firstTextMs: 5000,
        });
        assert.ok(opened.kind === 'text', opened.kind);
        const reader = textStreamResponse(opened, CALL, new AbortController().signal).body!.getReader();
        await reader.read();
        assert.equal(opened.upstream.signal.aborted, false);
        await reader.cancel();
        assert.equal(opened.upstream.signal.aborted, true, 'cancelling the body aborts the Gemini request');
    } finally {
        await slow.close();
    }
});

// The translator's request, as its route builds it: it asks for JSON.
const translateRequest = (text: string) =>
    buildTranslateRequest('gemini-3.8-flash', text, { sourceHint: 'auto', detectedScript: 'latin' });
const TRANSLATE_CALL = { feature: 'translate', model: 'gemini-3.8-flash', depth: 0 } as const;

test("the translator's JSON streams in slices that make up the whole result", async () => {
    const opened = await openTextStream(ai, translateRequest('Ki haal hai?'), {
        signal: new AbortController().signal,
        deadline: Date.now() + 20_000,
        firstTextMs: 5000,
    });
    assert.ok(opened.kind === 'text', opened.kind);
    const { text, error } = await readStream(textStreamResponse(opened, TRANSLATE_CALL, new AbortController().signal));
    assert.equal(error, undefined);
    assert.ok(opened.text.length < text.length, 'the first slice is not the whole reply');
    assert.equal(parseTranslationResult(text, 'english')?.roman, 'Ki haal hai?');
});

test("by default Google is sent the route's own deadline", async () => {
    const { result: opened, requests } = await captured(mock, () => open('What is kirpa?'));
    assert.ok(opened.kind === 'text', opened.kind);
    await readStream(textStreamResponse(opened, CALL, new AbortController().signal));
    assert.equal(requests[0].headers['x-server-timeout'], '20', 'the 20 s deadline open() gives');
});

test('given a later deadline for Google, a stuck call still ends at the first-text wait', async () => {
    const start = mock.requests.length;
    const started = Date.now();
    await assert.rejects(openTextStream(ai, { model: 'gemini-3.8-flash', contents: 'MOCK_HANG' }, {
        signal: new AbortController().signal,
        deadline: Date.now() + 20_000,
        firstTextMs: 200,
        serverTimeoutMs: 30_000,
    }), (err) => isAbortError(err));
    assert.ok(Date.now() - started < 5000, 'it gives up at the first-text wait');
    const [sent] = mock.requests.slice(start);
    assert.equal(sent.headers['x-server-timeout'], '30', 'Google is sent 30 s, once, not the 20 s budget');
});

test("given a later deadline for Google, the route's own timer ends a reply still writing at its deadline", async () => {
    // Slices 300 ms apart: the first text comes after 300 ms, and the whole
    // reply would take 1,200 ms, past the 800 ms deadline.
    const slow = await startMockGemini({ chunkDelayMs: 300 });
    try {
        const slowAi = new GoogleGenAI({ apiKey: 'test-key', httpOptions: { baseUrl: slow.url } });
        const started = Date.now();
        const opened = await openTextStream(slowAi, translateRequest('Ki haal hai?'), {
            signal: new AbortController().signal,
            deadline: Date.now() + 800,
            firstTextMs: 1000,
            serverTimeoutMs: 30_000,
        });
        assert.ok(opened.kind === 'text', opened.kind);
        const { error } = await readStream(textStreamResponse(opened, TRANSLATE_CALL, new AbortController().signal));
        assert.ok(isAbortError(error), String(error));
        assert.ok(Date.now() - started < 1200, 'ended at the deadline, before the reply did');
        assert.equal(slow.requests[0].headers['x-server-timeout'], '30');
    } finally {
        await slow.close();
    }
});

// The translator's settings: 30 s for Google, the route's own deadline after.
const translateOpts = (signal: AbortSignal, deadlineMs: number, firstTextMs: number) =>
    ({ signal, deadline: Date.now() + deadlineMs, firstTextMs, serverTimeoutMs: 30_000 });
const geminiCalls = (lines: { evt: string }[]) =>
    lines.filter((l) => l.evt === 'gemini_call') as unknown as Record<string, unknown>[];

// Runs `run` against a mock that sends its pieces `chunkDelayMs` apart.
async function withSlowGemini(chunkDelayMs: number, run: (ai: GoogleGenAI) => Promise<void>) {
    const slow = await startMockGemini({ chunkDelayMs });
    try {
        await run(new GoogleGenAI({ apiKey: 'test-key', httpOptions: { baseUrl: slow.url } }));
    } finally {
        await slow.close();
    }
}

test('a slow reply that keeps writing past the first-text wait is read to its end, and logged once', async () => {
    // Slices 200 ms apart: the first text comes well inside the 500 ms wait,
    // and the reply ends well past it, after 800 ms.
    await withSlowGemini(200, async (slowAi) => {
        const lines = await logged(async () => {
            const opened = await openTextStream(slowAi, translateRequest('Ki haal hai?'), translateOpts(new AbortController().signal, 20_000, 500));
            const reply = await readWholeText(opened, TRANSLATE_CALL, new AbortController().signal);
            assert.equal(parseTranslationResult(reply.text, 'english')?.roman, 'Ki haal hai?');
            assert.equal(reply.finishReason, FinishReason.STOP);
            reply.settle('ok');
            reply.settle('ok');
        });
        const calls = geminiCalls(lines);
        assert.equal(calls.length, 1, 'one line for the call, however often it is settled');
        assert.equal(calls[0].outcome, 'ok');
        assert.ok(Number(calls[0].ttftMs) >= 150, `ttftMs ${calls[0].ttftMs}`);
        assert.ok(Number(calls[0].ms) > 500, `ms ${calls[0].ms}: it ran past the first-text wait`);
        assert.equal(calls[0].outputTokens, 340, "the usage from the reply's last chunk");
    });
});

test("the route's own deadline ends a reply still writing: a timeout, logged with its time to first text", async () => {
    // Slices 300 ms apart: the first text after 300 ms, the whole reply after
    // 1,200 ms, and the deadline in between.
    await withSlowGemini(300, async (slowAi) => {
        let opened: Opened | undefined;
        const lines = await logged(async () => {
            opened = await openTextStream(slowAi, translateRequest('Ki haal hai?'), translateOpts(new AbortController().signal, 800, 1000));
            await assert.rejects(readWholeText(opened, TRANSLATE_CALL, new AbortController().signal), (err) => isAbortError(err));
        });
        const calls = geminiCalls(lines);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].outcome, 'timeout', 'the route timed it out: not an error, and not a visitor leaving');
        assert.equal(typeof calls[0].ttftMs, 'number', 'it had started writing: slow, not stuck');
        assert.ok(Number(calls[0].ms) < 1200, `ms ${calls[0].ms}`);
        assert.ok(opened?.kind === 'text' && opened.upstream.signal.aborted, 'the request to Gemini is stopped');
    });
});

test('a visitor who leaves mid-reply is logged as aborted, and the request stopped', async () => {
    await withSlowGemini(300, async (slowAi) => {
        const visitor = new AbortController();
        let opened: Opened | undefined;
        const lines = await logged(async () => {
            opened = await openTextStream(slowAi, translateRequest('Ki haal hai?'), translateOpts(visitor.signal, 20_000, 1000));
            const reading = readWholeText(opened, TRANSLATE_CALL, visitor.signal);
            visitor.abort();
            await assert.rejects(reading, (err) => isAbortError(err));
        });
        assert.deepEqual(geminiCalls(lines).map((l) => l.outcome), ['aborted']);
        assert.ok(opened?.kind === 'text' && opened.upstream.signal.aborted);
    });
});

test('a reply stopped by the output cap comes back cut, with MAX_TOKENS', async () => {
    const lines = await logged(async () => {
        const opened = await openTextStream(ai, translateRequest('MOCK_MAX_TOKENS hello'), translateOpts(new AbortController().signal, 20_000, 5000));
        const reply = await readWholeText(opened, TRANSLATE_CALL, new AbortController().signal);
        assert.equal(reply.text, '{"detectedInput":"engl');
        assert.equal(reply.finishReason, FinishReason.MAX_TOKENS);
        reply.settle('truncated');
    });
    const [call] = geminiCalls(lines);
    assert.equal(call.outcome, 'truncated');
    assert.equal(call.finishReason, 'MAX_TOKENS');
    assert.equal(typeof call.ttftMs, 'number');
});

test('a refused prompt or an empty reply comes back with no text, and its reason', async () => {
    const lines = await logged(async () => {
        const opts = () => translateOpts(new AbortController().signal, 20_000, 5000);
        const blocked = await readWholeText(await openTextStream(ai, translateRequest('MOCK_BLOCKED'), opts()), TRANSLATE_CALL, new AbortController().signal);
        assert.deepEqual([blocked.text, blocked.blockReason], ['', 'SAFETY']);
        blocked.settle('blocked');
        const empty = await readWholeText(await openTextStream(ai, translateRequest('MOCK_EMPTY'), opts()), TRANSLATE_CALL, new AbortController().signal);
        assert.deepEqual([empty.text, empty.finishReason], ['', FinishReason.STOP]);
        empty.settle('unusable');
    });
    const calls = geminiCalls(lines);
    assert.deepEqual(calls.map((l) => l.outcome), ['blocked', 'unusable']);
    assert.deepEqual(calls.map((l) => l.ttftMs), [undefined, undefined], 'no text, so no time to it');
});
