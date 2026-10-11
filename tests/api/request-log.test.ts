import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { sentry } from '@/lib/errors/sentry';
import { describeError, logError, logEvent, logRouteError, withRequestLog } from '@/lib/log';
import { startSentryMock, type SentryMock } from '../helpers/sentryMock';

let mock: SentryMock;
before(async () => { mock = await startSentryMock(); });
after(() => mock.close());

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

test("a route's unexpected error is logged with where it was thrown, never its message's user text", async () => {
    let parseError: unknown;
    try { JSON.parse('{"message": "my private question'); } catch (e) { parseError = e; }
    const multiline = new Error('upstream said:\n    at my private question');
    const lines = await capture(async () => {
        logRouteError(new TypeError('boom'));
        logRouteError(parseError);
        logRouteError(multiline);
        logRouteError('not an error');
    });
    const [typeError, syntaxError, withText, other] = lines;
    assert.equal(typeError.evt, 'route_error');
    assert.equal(typeError.error, 'TypeError: boom');
    const stack = typeError.stack as string[];
    assert.ok(stack.length > 0 && stack.length <= 6);
    assert.ok(stack.every((frame) => frame.startsWith('at ')));
    assert.match(stack[0], /request-log\.test\.ts/);
    assert.equal(syntaxError.error, 'SyntaxError');
    for (const line of [syntaxError, withText]) {
        assert.equal(JSON.stringify(line.stack).includes('private question'), false);
    }
    assert.equal('stack' in other, false);
});

test("an error line goes to Sentry too, once, when it's set up; warnings and the rest never do", async () => {
    process.env.SENTRY_DSN = mock.dsn;
    try {
        mock.received.length = 0;
        const lines = await capture(async () => {
            const handler = withRequestLog('/api/test', async () => {
                logEvent('config_error', { missing: 'GEMINI_API_KEY' }, 'error');
                logEvent('upstream_error', { upstream: 'gurbaninow', status: 503 }, 'warn');
                logEvent('gemini_call', { outcome: 'ok' });
            });
            await handler(new Request('http://local/api/test', { headers: { 'x-vercel-id': 'iad1::sent-1' } }));
            await sentry.settled();
        });
        assert.deepEqual(lines.map((l) => l.evt), ['config_error', 'upstream_error', 'gemini_call']);
        assert.equal(mock.received.length, 1);
        const { event } = mock.received[0];
        assert.deepEqual(event.logentry, { formatted: 'config_error (route=/api/test, missing=GEMINI_API_KEY)' });
        assert.deepEqual(event.tags, { evt: 'config_error', runtime: 'server', route: '/api/test', missing: 'GEMINI_API_KEY', requestId: 'iad1::sent-1' });
    } finally {
        delete process.env.SENTRY_DSN;
    }
});

test("a route's unexpected error reaches Sentry with its frames and without its user text", async () => {
    process.env.SENTRY_DSN = mock.dsn;
    try {
        mock.received.length = 0;
        await capture(async () => {
            logRouteError(new TypeError('failed for "my private question"'));
            await sentry.settled();
        });
        assert.equal(mock.received.length, 1);
        const [value] = mock.received[0].event.exception!.values;
        assert.equal(value.type, 'TypeError');
        assert.equal(value.value, 'failed for "…"');
        assert.ok(value.stacktrace!.frames.length > 0);
        assert.equal(mock.received[0].body.includes('private question'), false);
    } finally {
        delete process.env.SENTRY_DSN;
    }
});

test("without SENTRY_DSN, or with logging off, an error line sends nothing and writes nothing more", async () => {
    mock.received.length = 0;
    const lines = await capture(async () => {
        await logError('config_error', { missing: 'X' });
    });
    assert.deepEqual(lines, [{ evt: 'config_error', missing: 'X' }]);
    process.env.SENTRY_DSN = mock.dsn;
    process.env.APP_LOG = 'off';
    try {
        await logError('config_error', { missing: 'Y' });
    } finally {
        delete process.env.SENTRY_DSN;
        delete process.env.APP_LOG;
    }
    assert.equal(mock.received.length, 0);
});

test('a send Sentry refuses is noted once, as a warning, never as another error', async () => {
    process.env.SENTRY_DSN = mock.dsn;
    mock.answer = { status: 401 };
    try {
        const lines = await capture(async () => {
            await logError('config_error', { missing: 'A' });
            await logError('config_error', { missing: 'B' });
        });
        assert.deepEqual(lines.map((l) => [l.evt, l.status]), [
            ['config_error', undefined],
            ['error_report_failed', 401],
            ['config_error', undefined],
        ]);
    } finally {
        delete process.env.SENTRY_DSN;
        mock.answer = { status: 200 };
    }
});

test("with the platform's waitUntil, an error line's send is handed over and nothing waits for it", async () => {
    const PLATFORM_CONTEXT = Symbol.for('@next/request-context');
    const handed: Promise<unknown>[] = [];
    Object.assign(globalThis, { [PLATFORM_CONTEXT]: { get: () => ({ waitUntil: (p: Promise<unknown>) => { handed.push(p); } }) } });
    process.env.SENTRY_DSN = mock.dsn;
    mock.answer = { status: 200, delayMs: 300 };
    try {
        mock.received.length = 0;
        await capture(async () => {
            const started = Date.now();
            await logError('config_error', { missing: 'HANDED' });
            assert.ok(Date.now() - started < 200, 'resolved before Sentry answered');
            assert.equal(handed.length, 1);
            await handed[0];
        });
        assert.equal(mock.received.length, 1);
    } finally {
        delete (globalThis as Record<symbol, unknown>)[PLATFORM_CONTEXT];
        delete process.env.SENTRY_DSN;
        mock.answer = { status: 200 };
    }
});
