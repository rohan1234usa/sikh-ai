import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError, logEvent, withRequestLog } from '@/lib/log';

// Collects the JSON lines logEvent writes, whatever the level.
function capture(run: () => Promise<void>): Promise<Record<string, unknown>[]> {
    delete process.env.APP_LOG;
    const lines: Record<string, unknown>[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const collect = (line: string) => { lines.push(JSON.parse(line)); };
    console.log = collect;
    console.warn = collect;
    console.error = collect;
    return run().then(() => lines).finally(() => Object.assign(console, saved));
}

test("a route's log lines carry Vercel's request id and the route, however deep they're written", async () => {
    const handler = withRequestLog('/api/test', async () => {
        logEvent('first', { n: 1 });
        await new Promise((r) => setTimeout(r, 1));
        await Promise.resolve().then(() => logEvent('deeper', { n: 2 }, 'warn'));
        return 'done';
    });
    const lines = await capture(async () => {
        assert.equal(await handler(new Request('http://local/api/test', { headers: { 'x-vercel-id': 'iad1::abc-123' } })), 'done');
        logEvent('outside', {});
    });
    assert.deepEqual(lines, [
        { evt: 'first', requestId: 'iad1::abc-123', route: '/api/test', n: 1 },
        { evt: 'deeper', requestId: 'iad1::abc-123', route: '/api/test', n: 2 },
        { evt: 'outside' },
    ]);
});

test('without a Vercel id, each request gets its own', async () => {
    const handler = withRequestLog('/api/test', async () => { logEvent('hit', {}); });
    const lines = await capture(async () => {
        await Promise.all([handler(new Request('http://local/a')), handler(new Request('http://local/b'))]);
    });
    assert.equal(lines.length, 2);
    assert.match(String(lines[0].requestId), /^[0-9a-f-]{36}$/);
    assert.notEqual(lines[0].requestId, lines[1].requestId);
});

test('an error is logged by name and message, except a parse error, which can quote user text', () => {
    assert.equal(describeError(new TypeError('fetch failed')), 'TypeError: fetch failed');
    let parseError: unknown;
    try { JSON.parse('{"message": "my private question'); } catch (e) { parseError = e; }
    assert.equal(describeError(parseError), 'SyntaxError');
    assert.equal(describeError('a string'), 'string');
    assert.equal(describeError(new Error('x'.repeat(1000))).length, 300);
});
