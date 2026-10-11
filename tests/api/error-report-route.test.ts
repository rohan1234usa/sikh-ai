import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { sentry } from '@/lib/errors/sentry';
import { VISITOR_LIMITS } from '@/lib/api/allowance';
import { postJson } from '../helpers/routes';
import { startSentryMock, type SentryMock } from '../helpers/sentryMock';

const SITE = 'http://local';
const CHUNK = `${SITE}/_next/static/chunks/0a1b2c3d.js`;
const SHARE_ID = 'AbCdEfGhIjKlMnOpQrSt';
const SENTINELS = ['ZEBRA', 'ਵਾਹਿਗੁਰੂ', SHARE_ID, 'q=private'];

const report = (over: Record<string, unknown> = {}) => ({
    kind: 'page',
    name: 'TypeError',
    message: 'Cannot use "ZEBRA asked about ਵਾਹਿਗੁਰੂ" here',
    page: `/pa/share/${SHARE_ID}?q=private`,
    frames: [`at Foo (${CHUNK}?dpl=x:1:2345)`, `at inline (${SITE}/pa/share/${SHARE_ID}:3:4)`],
    ...over,
});

let POST: (req: Request) => Promise<Response>;
let mock: SentryMock;
before(async () => {
    mock = await startSentryMock();
    delete process.env.SENTRY_DSN;
    process.env.APP_LOG = 'off';
    ({ POST } = await import('@/app/api/error-report/route'));
});
after(() => mock.close());

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

test("a page's report is logged and sent on to Sentry, without anything the visitor wrote or an ID", async () => {
    process.env.SENTRY_DSN = mock.dsn;
    mock.received.length = 0;
    try {
        const lines = await capture(async () => {
            const res = await POST(postJson(`${SITE}/api/error-report`, report(), {
                'user-agent': 'Mozilla/5.0 (Test)',
                'x-vercel-id': 'iad1::rep-1',
                'x-forwarded-for': '203.0.113.10',
                cookie: 'secret=ZEBRA',
                referer: `${SITE}/shabad?q=private`,
            }));
            assert.equal(res.status, 204);
            await sentry.settled();
        });
        assert.equal(lines.length, 1);
        assert.deepEqual(lines[0], {
            evt: 'client_error',
            requestId: 'iad1::rep-1',
            route: '/api/error-report',
            kind: 'page',
            error: 'TypeError: Cannot use "…" here',
            page: '/pa/share/:id',
            frames: [`Foo ${CHUNK}:1:2345`, 'inline /pa/share/:id:3:4'],
        });
        assert.equal(mock.received.length, 1);
        const [{ body, event }] = mock.received;
        assert.equal(event.platform, 'javascript');
        assert.equal(event.transaction, '/pa/share/:id');
        assert.deepEqual(event.request, { url: `${SITE}/pa/share/:id`, headers: { 'User-Agent': 'Mozilla/5.0 (Test)' } });
        assert.deepEqual(event.tags, { kind: 'page', runtime: 'browser', requestId: 'iad1::rep-1' });
        assert.deepEqual(event.exception!.values[0].stacktrace!.frames.map((f) => f.abs_path ?? f.filename), ['/pa/share/:id', CHUNK]);
        for (const text of [JSON.stringify(lines), body])
            for (const leak of SENTINELS) assert.equal(text.includes(leak), false, leak);
    } finally {
        delete process.env.SENTRY_DSN;
    }
});

test("another site's page, a body that isn't JSON or one too big is refused before it's read", async () => {
    const from = { 'x-forwarded-for': '203.0.113.40' };
    const lines = await capture(async () => {
        assert.equal((await POST(postJson(`${SITE}/api/error-report`, report(), { ...from, 'sec-fetch-site': 'cross-site' }))).status, 403);
        assert.equal((await POST(postJson(`${SITE}/api/error-report`, report(), { ...from, 'content-type': 'text/plain' }))).status, 415);
        assert.equal((await POST(postJson(`${SITE}/api/error-report`, report({ message: 'x'.repeat(20_000) }), from))).status, 413);
        const notJson = new Request(`${SITE}/api/error-report`, { method: 'POST', headers: { ...from, 'content-type': 'application/json' }, body: 'not json' });
        assert.equal((await POST(notJson)).status, 400);
    });
    assert.deepEqual(lines.map((l) => l.evt), ['request_refused', 'request_refused']);
});

test('a browser sending Global Privacy Control, or something that is not a report, leaves no trace', async () => {
    process.env.SENTRY_DSN = mock.dsn;
    mock.received.length = 0;
    try {
        const lines = await capture(async () => {
            const from = { 'x-forwarded-for': '203.0.113.41' };
            for (const req of [
                postJson(`${SITE}/api/error-report`, report(), { ...from, 'sec-gpc': '1' }),
                postJson(`${SITE}/api/error-report`, report({ frames: ['at f (https://other.example/x.js:1:1)'] }), from),
                postJson(`${SITE}/api/error-report`, report({ kind: 'nonsense' }), from),
                postJson(`${SITE}/api/error-report`, ['not', 'a', 'report'], from),
            ]) assert.equal((await POST(req)).status, 204);
            await sentry.settled();
        });
        assert.deepEqual(lines, []);
        assert.equal(mock.received.length, 0);
    } finally {
        delete process.env.SENTRY_DSN;
    }
});

test("one visitor gets 10 posts a minute, whether they're reports or not", async () => {
    const from = { 'x-forwarded-for': '203.0.113.30' };
    for (let i = 0; i < VISITOR_LIMITS.errorReport.perMinute; i++)
        assert.equal((await POST(postJson(`${SITE}/api/error-report`, { junk: i }, from))).status, 204);
    assert.equal((await POST(postJson(`${SITE}/api/error-report`, report(), from))).status, 429);
});

test('one visitor gets 10 reports a minute', async () => {
    const from = { 'x-forwarded-for': '203.0.113.20' };
    const statuses: number[] = [];
    for (let i = 0; i <= VISITOR_LIMITS.errorReport.perMinute; i++)
        statuses.push((await POST(postJson(`${SITE}/api/error-report`, report({ message: `n${i}` }), from))).status);
    assert.deepEqual(statuses, [...Array(VISITOR_LIMITS.errorReport.perMinute).fill(204), 429]);
    const refused = await POST(postJson(`${SITE}/api/error-report`, report(), from));
    assert.deepEqual(await refused.json(), { code: 'error_report_busy', error: 'Too many error reports. Please wait a minute.' });
});
