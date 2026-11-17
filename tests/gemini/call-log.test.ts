import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPACITY_STATUS, geminiCallLevel, logGeminiCall, type GeminiCallLog } from '@/lib/gemini/log';

test("a failure only the owner can fix is an error, which reaches Sentry; one that passes is a warning", () => {
    // A bad or revoked key (Gemini answers 400), no prepaid credit, a retired model.
    for (const status of [400, 401, 402, 403, 404]) assert.equal(geminiCallLevel({ outcome: 'error', status }), 'error', String(status));
    for (const status of CAPACITY_STATUS) assert.equal(geminiCallLevel({ outcome: 'error', status }), 'warn', String(status));
    assert.equal(geminiCallLevel({ outcome: 'error' }), 'warn', 'no status: a network failure, which passes');
    for (const outcome of ['timeout', 'aborted', 'blocked', 'empty', 'cut', 'truncated', 'unusable'] as const)
        assert.equal(geminiCallLevel({ outcome, status: 400 }), 'warn', outcome);
    assert.equal(geminiCallLevel({ outcome: 'ok' }), 'info');
});

test("each call's line is written at its level", () => {
    delete process.env.APP_LOG;
    const levels: string[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    console.log = () => { levels.push('info'); };
    console.warn = () => { levels.push('warn'); };
    console.error = () => { levels.push('error'); };
    try {
        const call: GeminiCallLog = { feature: 'chat', model: 'm', depth: 0, outcome: 'ok', ms: 1 };
        logGeminiCall(call);
        logGeminiCall({ ...call, outcome: 'error', status: 503 });
        logGeminiCall({ ...call, outcome: 'error', status: 402 });
    } finally {
        Object.assign(console, saved);
        process.env.APP_LOG = 'off';
    }
    assert.deepEqual(levels, ['info', 'warn', 'error']);
});
