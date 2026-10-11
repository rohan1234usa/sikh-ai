import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { logRequestError } from '@/lib/errors/requestError';
import { SourceUnavailable } from '@/lib/errors/unavailable';
import { startSentryMock, type SentryMock } from '../helpers/sentryMock';

let mock: SentryMock;
before(async () => { mock = await startSentryMock(); });
after(() => mock.close());

const SHARE_ID = 'AbCdEfGhIjKlMnOpQrSt';
const render = { routerKind: 'App Router', routePath: '/[lang]/share/[shareId]', routeType: 'render', renderSource: 'server-rendering', revalidateReason: undefined } as const;

// Collects the JSON lines logged, whatever the level.
async function capture(run: () => Promise<void>): Promise<Record<string, unknown>[]> {
    delete process.env.APP_LOG;
    const lines: Record<string, unknown>[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const collect = (line: string) => { lines.push(JSON.parse(line)); };
    console.log = collect;
    console.warn = collect;
    console.error = collect;
    try {
        await run();
    } finally {
        Object.assign(console, saved);
        process.env.APP_LOG = 'off';
    }
    return lines;
}

test("a page that failed to render is logged with its scrubbed path and Vercel's ID, and sent once before it resolves", async () => {
    process.env.SENTRY_DSN = mock.dsn;
    mock.received.length = 0;
    const error = Object.assign(new Error('Share link unavailable'), { digest: '2804958613' });
    const request = {
        path: `/pa/share/${SHARE_ID}?q=my%20private%20question`,
        method: 'GET',
        headers: { 'x-vercel-id': 'iad1::req-1', cookie: 'sikhai.lang=pa; secret=ZEBRA', 'user-agent': 'ZEBRA-agent' },
    };
    try {
        const lines = await capture(() => logRequestError(error, request, render));
        assert.equal(mock.received.length, 1, 'sent by the time it resolves');
        assert.equal(lines.length, 1);
        const [line] = lines;
        assert.equal(line.evt, 'request_error');
        assert.equal(line.requestId, 'iad1::req-1');
        assert.equal(line.path, '/pa/share/:id');
        assert.equal(line.method, 'GET');
        assert.equal(line.routePath, '/[lang]/share/[shareId]');
        assert.equal(line.digest, '2804958613');
        assert.equal(line.error, 'Error: Share link unavailable');
        assert.ok(Array.isArray(line.stack));
        for (const text of [JSON.stringify(line), mock.received[0].body]) {
            for (const leak of [SHARE_ID, 'private', 'ZEBRA']) assert.equal(text.includes(leak), false, leak);
        }
        const { event } = mock.received[0];
        assert.equal(event.transaction, '/[lang]/share/[shareId]');
        assert.deepEqual(event.request, { url: '/pa/share/:id', method: 'GET' });
        assert.deepEqual(event.exception!.values[0].mechanism, { type: 'request_error', handled: false });
    } finally {
        delete process.env.SENTRY_DSN;
    }
});

test("Vercel's ID may come as a list, and a request without one is logged all the same", async () => {
    const lines = await capture(async () => {
        await logRequestError(new Error('x'), { path: '/', method: 'GET', headers: { 'x-vercel-id': ['iad1::req-2', 'other'] } }, render);
        await logRequestError('a string', { path: '/seva/AbCdEfGhIjKlMnOpQrSt', method: 'POST', headers: {} }, { ...render, routeType: 'action' });
    });
    assert.equal(lines[0].requestId, 'iad1::req-2');
    assert.equal('requestId' in lines[1], false);
    assert.equal(lines[1].path, '/seva/:id');
    assert.equal(lines[1].error, 'string');
});

test("a page whose source is down is a warning, and isn't sent, however many ids fail", async () => {
    process.env.SENTRY_DSN = mock.dsn;
    mock.received.length = 0;
    const shabadPage = { ...render, routePath: '/[lang]/shabad/s/[shabadId]' };
    try {
        const lines = await capture(async () => {
            for (const id of ['ZZZZZZ', 'ZZZZZY', 'ABCDEF'])
                await logRequestError(new SourceUnavailable(`GurbaniNow gave no usable answer for shabad ${id}`), { path: `/shabad/s/${id}`, method: 'GET', headers: {} }, shabadPage);
        });
        assert.deepEqual(lines.map((l) => [l.evt, l.error]), [
            ['request_error', 'SourceUnavailable: GurbaniNow gave no usable answer for shabad ZZZZZZ'],
            ['request_error', 'SourceUnavailable: GurbaniNow gave no usable answer for shabad ZZZZZY'],
            ['request_error', 'SourceUnavailable: GurbaniNow gave no usable answer for shabad ABCDEF'],
        ]);
        assert.equal(mock.received.length, 0);
    } finally {
        delete process.env.SENTRY_DSN;
    }
});
