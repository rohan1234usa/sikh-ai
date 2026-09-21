import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_FALLBACK_MS, withModelFallback, withTransport } from '@/lib/gemini/fallback';
import type { GeminiCallLog } from '@/lib/gemini/log';

class FakeApiError extends Error {
    constructor(readonly status: number) {
        super(`{"error":{"code":${status}}}`);
    }
}

const quiet = () => {};

// A fake model call: throws the scripted error for a model, else answers.
function scripted(errors: Record<string, Error>) {
    const calls: string[] = [];
    const call = async (model: string) => {
        calls.push(model);
        if (errors[model]) throw errors[model];
        return `answer from ${model}`;
    };
    return { calls, call };
}

afterEach(() => { delete process.env.GEMINI_CHAT_FALLBACK_MODEL; });

test('the pinned model answers without the fallback being touched', async () => {
    const { calls, call } = scripted({});
    const result = await withModelFallback('chat', call, { log: quiet });
    assert.deepEqual(result, { value: 'answer from gemini-3.8-flash', model: 'gemini-3.8-flash', depth: 0 });
    assert.deepEqual(calls, ['gemini-3.8-flash']);
});

test('a rate-limited pinned model is answered by the fallback', async () => {
    const { calls, call } = scripted({ 'gemini-3.8-flash': new FakeApiError(429) });
    const result = await withModelFallback('chat', call, { log: quiet });
    assert.equal(result.model, 'gemini-3.7-flash');
    assert.equal(result.depth, 1);
    assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.7-flash']);
});

for (const status of [500, 502, 503, 504, 404]) {
    test(`status ${status} is worth one more try`, async () => {
        const { calls, call } = scripted({ 'gemini-3.8-flash': new FakeApiError(status) });
        await withModelFallback('chat', call, { log: quiet });
        assert.equal(calls.length, 2);
    });
}

for (const status of [400, 401, 402, 403]) {
    test(`status ${status} fails the same on every model, so it is not retried`, async () => {
        const { calls, call } = scripted({ 'gemini-3.8-flash': new FakeApiError(status) });
        await assert.rejects(withModelFallback('chat', call, { log: quiet }), { status });
        assert.equal(calls.length, 1);
    });
}

test('when both models are overloaded, the fallback error surfaces', async () => {
    const { call } = scripted({
        'gemini-3.8-flash': new FakeApiError(429),
        'gemini-3.7-flash': new FakeApiError(503),
    });
    await assert.rejects(withModelFallback('chat', call, { log: quiet }), { status: 503 });
});

test('a misconfigured fallback does not hide that the primary was overloaded', async () => {
    const { call } = scripted({
        'gemini-3.8-flash': new FakeApiError(429),
        'gemini-3.7-flash': new FakeApiError(404),
    });
    await assert.rejects(withModelFallback('chat', call, { log: quiet }), { status: 429 });
});

test('our own timeout falls back; a user who went away is not retried', async () => {
    const timedOut = scripted({ 'gemini-3.8-flash': new DOMException('slow', 'AbortError') });
    await withModelFallback('chat', timedOut.call, { log: quiet, signal: new AbortController().signal });
    assert.equal(timedOut.calls.length, 2);

    const left = new AbortController();
    left.abort();
    const aborted = scripted({ 'gemini-3.8-flash': new DOMException('gone', 'AbortError') });
    await assert.rejects(withModelFallback('chat', aborted.call, { log: quiet, signal: left.signal }), { name: 'AbortError' });
    assert.equal(aborted.calls.length, 1);
});

test('the fallback is skipped when too little of the budget is left', async () => {
    const { calls, call } = scripted({ 'gemini-3.8-flash': new FakeApiError(429) });
    const deadline = Date.now() + MIN_FALLBACK_MS - 1000;
    await assert.rejects(withModelFallback('chat', call, { log: quiet, deadline }), { status: 429 });
    assert.equal(calls.length, 1);
});

test('a disabled fallback means one attempt only', async () => {
    process.env.GEMINI_CHAT_FALLBACK_MODEL = 'off';
    const { calls, call } = scripted({ 'gemini-3.8-flash': new FakeApiError(503) });
    await assert.rejects(withModelFallback('chat', call, { log: quiet }), { status: 503 });
    assert.equal(calls.length, 1);
});

test('each failed attempt is logged with its status and outcome', async () => {
    const entries: GeminiCallLog[] = [];
    const { call } = scripted({ 'gemini-3.8-flash': new FakeApiError(429) });
    await withModelFallback('chat', call, { log: e => entries.push(e) });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].model, 'gemini-3.8-flash');
    assert.equal(entries[0].depth, 0);
    assert.equal(entries[0].status, 429);
    assert.equal(entries[0].outcome, 'error');
});

test('withTransport adds the signal and timeout and leaves the request alone', () => {
    const signal = new AbortController().signal;
    const original = { model: 'm', contents: 'hi', config: { maxOutputTokens: 10 } };
    const sent = withTransport(original, { signal, timeoutMs: 1500.7 });
    assert.equal(sent.config?.abortSignal, signal);
    assert.equal(sent.config?.httpOptions?.timeout, 1500);
    assert.equal(sent.config?.maxOutputTokens, 10);
    assert.deepEqual(original.config, { maxOutputTokens: 10 }, 'the shared request must not be mutated');
});
