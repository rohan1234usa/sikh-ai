import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ReadReport } from '@/lib/errors/report';
import {
    PER_HOUR, REPEAT_MS, browserEvent, createSender, envelope, logLineEvent, parseDsn, waitFrom, type Outgoing,
} from '@/lib/errors/sentry';

const ORIGIN = 'https://sikhai.vercel.app';
const CHUNK = `${ORIGIN}/_next/static/chunks/0a1b2c3d4e5f.js`;
const HOUR = 3_600_000;
// Far from today, so these times never meet a real clock's.
const T0 = 20_000 * 86_400_000;

// A stand-in for Sentry: records each envelope, and answers as told.
type Received = { path: string; headers: http.IncomingHttpHeaders; body: string };
let received: Received[] = [];
let answer: { status: number; headers?: Record<string, string>; hang?: boolean } = { status: 200 };
let server: http.Server;
let dsn = '';

before(async () => {
    server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            received.push({ path: req.url ?? '', headers: req.headers, body });
            if (answer.hang) return;
            res.writeHead(answer.status, answer.headers);
            res.end('{}');
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    dsn = `http://publickey@127.0.0.1:${(server.address() as AddressInfo).port}/42`;
});
after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }));

const fresh = () => {
    received = [];
    answer = { status: 200 };
    return createSender({ SENTRY_DSN: dsn, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'abc123' }, { timeoutMs: 200 });
};

const report = (over: Partial<ReadReport> = {}): ReadReport => ({
    kind: 'uncaught',
    name: 'TypeError',
    message: "Cannot read properties of undefined (reading 'x')",
    page: '/pa/chat/:id',
    frames: [
        { fn: 'Foo', file: CHUNK, line: 1, column: 2345 },
        { file: '/pa/chat/:id', line: 3, column: 4 },
    ],
    ...over,
});
const outgoing = (key: string): Outgoing =>
    ({ ...browserEvent(report(), { origin: ORIGIN }, T0, { VERCEL_GIT_COMMIT_SHA: 'abc123' }), key });

test('a DSN gives the envelope address and the key; anything else gives nothing', () => {
    assert.deepEqual(parseDsn('https://abc@o123.ingest.us.sentry.io/456'),
        { endpoint: 'https://o123.ingest.us.sentry.io/api/456/envelope/', key: 'abc' });
    assert.deepEqual(parseDsn('https://abc@sentry.example.com/base/7'),
        { endpoint: 'https://sentry.example.com/base/api/7/envelope/', key: 'abc' });
    assert.deepEqual(parseDsn('http://abc@127.0.0.1:8789/1'), { endpoint: 'http://127.0.0.1:8789/api/1/envelope/', key: 'abc' });
    for (const bad of [undefined, '', 'nonsense', 'http://abc@sentry.example.com/1', 'https://sentry.example.com/1', 'https://abc@sentry.example.com/x'])
        assert.equal(parseDsn(bad), null, String(bad));
});

test("a browser's report becomes an event with nothing but what the report allows", () => {
    const { event } = browserEvent(report(), { origin: ORIGIN, userAgent: 'Mozilla/5.0 '.padEnd(400, 'x'), requestId: 'iad1::r1' }, T0,
        { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'abc123' });
    assert.deepEqual(Object.keys(event).sort(),
        ['environment', 'event_id', 'exception', 'level', 'platform', 'release', 'request', 'sdk', 'tags', 'timestamp', 'transaction']);
    assert.match(event.event_id, /^[0-9a-f]{32}$/);
    assert.equal(event.platform, 'javascript');
    assert.equal(event.environment, 'production');
    assert.equal(event.release, 'abc123');
    assert.equal(event.transaction, '/pa/chat/:id');
    assert.deepEqual(event.tags, { kind: 'uncaught', runtime: 'browser', requestId: 'iad1::r1' });
    assert.deepEqual(Object.keys(event.request!), ['url', 'headers']);
    assert.equal(event.request!.url, `${ORIGIN}/pa/chat/:id`);
    assert.deepEqual(Object.keys(event.request!.headers!), ['User-Agent']);
    assert.equal(event.request!.headers!['User-Agent'].length, 300);
    const [value] = event.exception!.values;
    assert.equal(value.type, 'TypeError');
    assert.deepEqual(value.mechanism, { type: 'uncaught', handled: false });
    // Oldest call first; only a script's frame has an address Sentry fetches.
    assert.deepEqual(value.stacktrace!.frames, [
        { filename: '/pa/chat/:id', lineno: 3, colno: 4 },
        { function: 'Foo', filename: CHUNK, abs_path: CHUNK, lineno: 1, colno: 2345 },
    ]);
    assert.equal(browserEvent(report({ kind: 'page' }), { origin: ORIGIN }).event.exception!.values[0].mechanism.handled, true);
});

test('an error log line becomes an exception with its frames, grouped without line numbers', () => {
    const { event, key } = logLineEvent('route_error', {
        requestId: 'iad1::r2',
        route: '/api/chat',
        error: 'TypeError: failed for "my private question"',
        stack: [
            'at handlePost (/var/task/.next/server/app/api/chat/route.js:1:2345)',
            'at async file:///var/task/node_modules/next/dist/compiled/next-server/app-route.js:6:100',
        ],
    }, T0, {});
    assert.equal(event.platform, 'node');
    assert.equal(event.environment, 'local');
    assert.equal(event.transaction, '/api/chat');
    assert.deepEqual(event.tags, { evt: 'route_error', runtime: 'server', route: '/api/chat', requestId: 'iad1::r2' });
    const [value] = event.exception!.values;
    assert.equal(value.type, 'TypeError');
    assert.equal(value.value, 'failed for "…"');
    assert.deepEqual(value.mechanism, { type: 'route_error', handled: true });
    assert.deepEqual(value.stacktrace!.frames, [
        { filename: 'node_modules/next/dist/compiled/next-server/app-route.js', lineno: 6, colno: 100, in_app: false },
        { function: 'handlePost', filename: '.next/server/app/api/chat/route.js', lineno: 1, colno: 2345, in_app: true },
    ]);
    assert.deepEqual(event.fingerprint, ['route_error', 'route=/api/chat', 'TypeError', 'handlePost']);
    assert.equal(key, 'route_error|route=/api/chat|TypeError|handlePost');
    assert.equal(event.request, undefined);
});

test('a line without an error of its own becomes a message', () => {
    const config = logLineEvent('config_error', { route: '/api/chat', missing: 'GEMINI_API_KEY' }, T0, {}).event;
    assert.deepEqual(config.logentry, { formatted: 'config_error' });
    assert.equal(config.tags.missing, 'GEMINI_API_KEY');
    assert.deepEqual(config.fingerprint, ['config_error', 'route=/api/chat', 'missing=GEMINI_API_KEY']);

    const gemini = logLineEvent('gemini_call', {
        feature: 'chat', model: 'gemini-x', outcome: 'error', status: 402, error: 'Prepaid credit is used up for "my question"', ms: 120,
    }, T0, {}).event;
    assert.deepEqual(gemini.logentry, { formatted: 'gemini_call: Prepaid credit is used up for "…"' });
    assert.deepEqual(gemini.fingerprint, ['gemini_call', 'feature=chat', 'model=gemini-x', 'status=402']);
    assert.equal(gemini.tags.ms, undefined, 'only the fields that name what failed become tags');
});

test("Next's request error keeps its scrubbed path and method", () => {
    const { event } = logLineEvent('request_error', {
        path: '/seva/:id', method: 'GET', routePath: '/[lang]/seva/[id]', routeType: 'render', digest: '123',
        error: 'Error: Seva events are unavailable', stack: [],
    }, T0, {});
    assert.deepEqual(event.request, { url: '/seva/:id', method: 'GET' });
    assert.equal(event.transaction, '/[lang]/seva/[id]');
    assert.deepEqual(event.exception!.values[0].mechanism, { type: 'request_error', handled: false });
    assert.deepEqual(event.fingerprint, ['request_error', 'routePath=/[lang]/seva/[id]', 'Error']);
});

test('an envelope is a header, an item header and the event, a line each', () => {
    const { event } = outgoing('k');
    const [header, item, payload, end] = envelope(event, T0).split('\n');
    assert.deepEqual(JSON.parse(header), { event_id: event.event_id, sent_at: new Date(T0).toISOString(), sdk: event.sdk });
    assert.deepEqual(JSON.parse(item), { type: 'event' });
    assert.deepEqual(JSON.parse(payload), event);
    assert.equal(end, '');
});

test('an event reaches Sentry with its key, and the same one waits ten minutes', async () => {
    const sender = fresh();
    assert.equal(await sender.send(outgoing('same'), T0), 'sent');
    assert.equal(received.length, 1);
    const [{ path, headers, body }] = received;
    assert.equal(path, '/api/42/envelope/');
    assert.equal(headers['content-type'], 'application/x-sentry-envelope');
    assert.equal(headers['x-sentry-auth'], 'Sentry sentry_version=7, sentry_key=publickey, sentry_client=sikhai.relay/1.0.0');
    assert.equal(headers.cookie, undefined);
    assert.equal(JSON.parse(body.split('\n')[2]).release, 'abc123');

    assert.equal(await sender.send(outgoing('same'), T0 + REPEAT_MS - 1), 'skipped');
    assert.equal(await sender.send(outgoing('other'), T0 + 1), 'sent');
    assert.equal(await sender.send(outgoing('same'), T0 + REPEAT_MS), 'sent');
    assert.equal(received.length, 3);
});

test('a server sends at most 20 an hour', async () => {
    const sender = fresh();
    for (let i = 0; i < PER_HOUR; i++) assert.equal(await sender.send(outgoing(`k${i}`), T0 + i), 'sent');
    assert.equal(await sender.send(outgoing('one more'), T0 + PER_HOUR), 'skipped');
    assert.equal(await sender.send(outgoing('next hour'), T0 + HOUR), 'sent');
});

test("Sentry's rate limits hold sends back for as long as it says", async () => {
    const cases: { headers?: Record<string, string>; status: number; wait: number }[] = [
        { status: 429, headers: { 'x-sentry-rate-limits': '120:error;transaction:organization:usage_exceeded' }, wait: 120_000 },
        { status: 429, headers: { 'retry-after': '30' }, wait: 30_000 },
        { status: 429, wait: 60_000 },
        { status: 200, headers: { 'x-sentry-rate-limits': '300::key' }, wait: 300_000 },
    ];
    for (const { status, headers, wait } of cases) {
        const sender = fresh();
        answer = { status, headers };
        assert.equal(await sender.send(outgoing('first'), T0), status === 200 ? 'sent' : 'failed');
        answer = { status: 200 };
        assert.equal(await sender.send(outgoing('second'), T0 + wait - 1), 'skipped', `${status} ${JSON.stringify(headers)}`);
        assert.equal(await sender.send(outgoing('third'), T0 + wait), 'sent');
    }
    assert.equal(waitFrom({ status: 200, headers: { 'x-sentry-rate-limits': '60:transaction:key' } }), 0, 'not for errors');
    assert.equal(waitFrom({ status: 400, headers: {} }), 0);
});

test('a refusal, a dead end or no answer is a failure, never a retry or a throw', async () => {
    const sender = fresh();
    answer = { status: 400 };
    assert.equal(await sender.send(outgoing('a'), T0), 'failed');
    answer = { status: 200, hang: true };
    assert.equal(await sender.send(outgoing('b'), T0 + 1), 'failed');
    assert.equal(received.length, 2);

    const nowhere = createSender({ SENTRY_DSN: 'http://k@127.0.0.1:9/1' }, { timeoutMs: 200 });
    assert.equal(await nowhere.send(outgoing('c'), T0), 'failed');
});

test('without a DSN, while the site builds, or on the edge, nothing is sent', async () => {
    received = [];
    for (const env of [{}, { SENTRY_DSN: dsn, NEXT_PHASE: 'phase-production-build' }, { SENTRY_DSN: dsn, NEXT_RUNTIME: 'edge' }]) {
        assert.equal(await createSender(env).send(outgoing('x'), T0), 'skipped', JSON.stringify(env));
    }
    assert.equal(received.length, 0);
});

test('settled() waits for every send in flight', async () => {
    const sender = fresh();
    void sender.send(outgoing('a'), T0);
    void sender.send(outgoing('b'), T0);
    await sender.settled();
    assert.equal(received.length, 2);
});
