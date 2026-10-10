import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_REPORTS_PER_PAGE, errorReporter, sendErrorReport, type ReporterDeps } from '@/lib/errors/client';
import type { ClientReport } from '@/lib/errors/report';

const SITE = 'https://sikhai.vercel.app';
const CHUNK = `${SITE}/_next/static/chunks/0a1b2c3d.js`;
const SHARE_ID = 'AbCdEfGhIjKlMnOpQrSt';

// An error as a browser throws it from the site's own script.
function thrown(message: string, { name = 'TypeError', at = CHUNK, extra = {} }: { name?: string; at?: string; extra?: object } = {}) {
    const error = Object.assign(new Error(message), extra);
    error.name = name;
    error.stack = `${name}: ${message}\n    at Foo (${at}?dpl=dpl_1:1:2345)\n    at ${at}:2:10`;
    return error;
}

function reporter(over: Partial<ReporterDeps> = {}) {
    const posted: ClientReport[] = [];
    const report = errorReporter({
        enabled: true,
        counted: () => true,
        href: () => `${SITE}/pa/share/${SHARE_ID}?q=private#top`,
        origin: () => SITE,
        post: (body) => { posted.push(JSON.parse(body)); },
        ...over,
    });
    return { report, posted };
}

test("a report says what failed and where, scrubbed before it leaves the page", () => {
    const { report, posted } = reporter();
    report(thrown('Unknown lens "ZEBRA ਵਾਹਿਗੁਰੂ"'), 'page');
    assert.deepEqual(posted, [{
        kind: 'page',
        name: 'TypeError',
        message: 'Unknown lens "…"',
        frames: [`at Foo (${CHUNK}:1:2345)`, `at ${CHUNK}:2:10`],
        page: '/pa/share/:id',
    }]);
});

test('nothing is sent with counting switched off or Global Privacy Control, nor from a development build', () => {
    for (const over of [{ counted: () => false }, { enabled: false }]) {
        const { report, posted } = reporter(over);
        report(thrown('x'), 'uncaught');
        assert.deepEqual(posted, [], JSON.stringify(over));
    }
});

test("the server's own errors, cancelled requests and things that aren't errors are left alone", () => {
    const { report, posted } = reporter();
    report(thrown('An error occurred in the Server Components render.', { name: 'Error', extra: { digest: '2804958613' } }), 'page');
    report(thrown('The user aborted a request.', { name: 'AbortError' }), 'rejection');
    report(thrown('ResizeObserver loop completed with undelivered notifications.', { name: 'Error' }), 'uncaught');
    report('a string', 'rejection');
    report({ message: 'an object' }, 'rejection');
    report(null, 'rejection');
    assert.deepEqual(posted, []);
});

test("an error with no frame from this site, such as an extension's, isn't sent", () => {
    const { report, posted } = reporter();
    report(thrown('x', { at: 'chrome-extension://abcdefghijklmnop/content.js' }), 'uncaught');
    const noStack = new Error('x');
    noStack.stack = undefined;
    report(noStack, 'uncaught');
    assert.deepEqual(posted, []);
});

test('the same error goes once, and a page sends five at most', () => {
    const { report, posted } = reporter();
    report(thrown('same'), 'uncaught');
    report(thrown('same'), 'uncaught');
    assert.equal(posted.length, 1);
    for (let i = 0; i < 10; i++) report(thrown(`error ${i}`), 'uncaught');
    assert.equal(posted.length, MAX_REPORTS_PER_PAGE);
});

test('the reporter never throws, whatever fails inside it', () => {
    const { report } = reporter({ counted: () => { throw new Error('storage blocked'); } });
    assert.doesNotThrow(() => report(thrown('x'), 'uncaught'));
    const { report: failingPost } = reporter({ post: () => { throw new Error('offline'); } });
    assert.doesNotThrow(() => failingPost(thrown('x'), 'uncaught'));
    // The page's own, outside a production build, does nothing at all.
    assert.doesNotThrow(() => sendErrorReport(thrown('x'), 'page'));
});
