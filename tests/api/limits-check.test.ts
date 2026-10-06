import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    codeOf,
    edgeOf,
    isFirewallLimit,
    isRouteLimit,
    judgeAnswer,
    judgeLeftOut,
    judgeRateLimited,
    judgeVisitorLimit,
    nextStart,
    tally,
    type Answer,
} from '../../scripts/limits-check/verdicts';

type Like = Partial<Omit<Answer, 'n'>> & { status: number };

// A burst's answers from runs of the same one: run([20, a], [25, b]).
function run(...parts: [number, Like][]): Answer[] {
    const answers: Answer[] = [];
    for (const [count, like] of parts) {
        for (let i = 0; i < count; i++) {
            answers.push({ code: null, retryAfter: null, cacheControl: null, mitigated: null, edge: 'sfo1::iad1', ...like, n: answers.length + 1 });
        }
    }
    return answers;
}

const one = (like: Like) => run([1, like])[0];
const EMPTY = { status: 400, code: 'chat_empty' };
const FIREWALL = { status: 429 };

test("the routes' 429 carries a code; the firewall's has none, and a challenge is neither", () => {
    assert.equal(isRouteLimit(one({ status: 429, code: 'verify_busy' })), true);
    assert.equal(isRouteLimit(one({ status: 429, code: 'chat_limit' })), true);
    assert.equal(isFirewallLimit(one({ status: 429, code: 'verify_busy' })), false);
    assert.equal(isFirewallLimit(one(FIREWALL)), true);
    assert.equal(isFirewallLimit(one({ status: 429, mitigated: 'challenge' })), false);
    assert.equal(isFirewallLimit(one(EMPTY)), false);
});

test('codeOf reads only a top-level string code', () => {
    assert.equal(codeOf('{"error":"Please wait","code":"verify_busy"}'), 'verify_busy');
    assert.equal(codeOf('{"error":{"code":"challenge"}}'), null);
    assert.equal(codeOf('{"citations":[]}'), null);
    assert.equal(codeOf('[]'), null);
    assert.equal(codeOf(''), null);
    assert.equal(codeOf('<html>Too Many Requests</html>'), null);
});

test('edgeOf keeps the regions and drops the request id', () => {
    assert.equal(edgeOf('sfo1::iad1::abcd1-1791233894519-ffd9f8c8e384'), 'sfo1::iad1');
    assert.equal(edgeOf('iad1::abcd1-1791233894519'), 'iad1');
    assert.equal(edgeOf('no-separator'), null);
    assert.equal(edgeOf(null), null);
});

test('tally counts each kind of answer in the order it first came', () => {
    assert.equal(tally(run([10, { status: 200 }], [2, { status: 429, code: 'verify_busy' }])), '10 × 200, 2 × 429 verify_busy');
    assert.equal(tally(run([1, FIREWALL], [1, EMPTY], [1, FIREWALL])), '2 × 429, 1 × 400 chat_empty');
});

test('a burst starts three seconds into the first minute that is late enough', () => {
    const minute = Date.UTC(2026, 9, 6, 0, 24);
    assert.equal(nextStart(minute + 2_500, 0), minute + 3_000);
    assert.equal(nextStart(minute + 3_000, 0), minute + 3_000);
    assert.equal(nextStart(minute + 3_001, 0), minute + 63_000);
    assert.equal(nextStart(minute, minute + 75_000), minute + 123_000);
});

test('a refusal needs its status and no-store; the search needs only its 200', () => {
    assert.deepEqual(judgeAnswer(one({ status: 415, cacheControl: 'no-store' }), { status: 415 }, true), { ok: true, detail: '415, no-store' });
    assert.equal(judgeAnswer(one({ status: 415, cacheControl: 'public, max-age=0' }), { status: 415 }, true).ok, false);
    assert.equal(judgeAnswer(one(EMPTY), { status: 415 }, true).detail, 'got 400 chat_empty, wanted 415');
    assert.equal(judgeAnswer(one({ status: 200, cacheControl: 'public, max-age=3600' }), { status: 200 }, false).ok, true);
});

test("the per-visitor limit passes on the route's own 429, and fails when nothing counts", () => {
    const limited = judgeVisitorLimit(run([10, { status: 200 }], [2, { status: 429, code: 'verify_busy', retryAfter: '54' }]), 'verify');
    assert.deepEqual(limited, { ok: true, detail: '10 × 200, 2 × 429 verify_busy: verify_busy from #11, Retry-After 54' });
    const uncounted = judgeVisitorLimit(run([12, { status: 200 }]), 'verify');
    assert.equal(uncounted.ok, false);
    assert.match(uncounted.detail, /limit_skipped/);
    assert.equal(judgeVisitorLimit(run([10, { status: 200 }], [2, FIREWALL]), 'verify').ok, false);
    assert.equal(judgeVisitorLimit(run([10, { status: 200 }], [2, { status: 429, code: 'verify_busy' }]), 'verify').ok, false, 'needs a Retry-After');
    assert.equal(judgeVisitorLimit(run([10, { status: 200 }], [2, { status: 429, code: 'chat_busy', retryAfter: '9' }]), 'verify').ok, false);
    assert.equal(judgeVisitorLimit(run([12, { status: 429, code: 'verify_busy', retryAfter: '30' }]), 'verify').ok, null);
});

test("the firewall passes once its bare 429 cuts into the routes' 400s", () => {
    assert.deepEqual(judgeRateLimited(run([20, EMPTY], [25, FIREWALL]), EMPTY, 20), {
        ok: true,
        detail: "20 × 400 chat_empty, 25 × 429: the firewall's 429 from #21",
    });
    // Straddling two windows, or the counts lagging, lets more through.
    assert.equal(judgeRateLimited(run([38, EMPTY], [7, FIREWALL]), EMPTY, 20).ok, true);
    assert.match(judgeRateLimited(run([10, EMPTY], [35, FIREWALL]), EMPTY, 20).detail, /sooner than the 20 a minute/);
});

test("the firewall fails when it never limits, or denies instead; a leftover or challenge can't tell", () => {
    const never = judgeRateLimited(run([45, EMPTY]), EMPTY, 20);
    assert.equal(never.ok, false);
    assert.match(never.detail, /no 429 in 45, so the rule is missing, unpublished, set above 45 a minute, or only logging/);
    assert.match(judgeRateLimited(run([20, EMPTY], [25, { status: 403 }]), EMPTY, 20).detail, /denies past the limit/);
    assert.equal(judgeRateLimited(run([45, FIREWALL]), EMPTY, 20).ok, null);
    assert.equal(judgeRateLimited(run([20, EMPTY], [25, { status: 429, mitigated: 'challenge' }]), EMPTY, 20).ok, null);
    assert.equal(judgeRateLimited(run([20, EMPTY], [1, { status: 500, code: 'chat_failed' }]), EMPTY, 20).ok, false);
});

test('a path the rule leaves out passes only if it is never limited', () => {
    assert.deepEqual(judgeLeftOut(run([45, { status: 204 }]), { status: 204 }), { ok: true, detail: '45 × 204: never limited' });
    assert.match(judgeLeftOut(run([20, { status: 204 }], [25, FIREWALL]), { status: 204 }).detail, /counts this path/);
    assert.equal(judgeLeftOut(run([45, FIREWALL]), { status: 204 }).ok, null);
});
