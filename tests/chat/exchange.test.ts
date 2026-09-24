import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EXCHANGES_PER_CHAT, MAX_MESSAGE_CHARS } from '@/lib/chat/config';
import {
    MAX_HISTORY_EXCHANGES,
    buildHistory,
    errorCodeFromResponse,
    nextOrder,
    planRetry,
    planSend,
    settleReply,
    shouldReplaceReply,
    toDisplayItems,
    type SendContext,
    type SendPlan,
} from '@/lib/chat/exchange';
import { normalizeTranscript, type Entry, type Exchange, type Transcript } from '@/lib/chat/transcript';
import { NANAK, SIKHAI, exchange, ids, notice, reply } from './helpers';

const ctx = (over: Partial<SendContext> = {}): SendContext => ({ now: 10_000, newId: ids(), settings: SIKHAI, ...over });

function sent(t: Transcript, text: string, c = ctx()): SendPlan {
    const result = planSend(t, text, c);
    assert.equal(result.kind, 'send');
    return (result as { plan: SendPlan }).plan;
}

// What a store holds after carrying out a plan: its notices removed, its
// notice and exchange put by id.
function apply(t: Transcript, plan: SendPlan): Transcript {
    const byId = new Map<string, Entry>(t.filter((e) => !plan.removeNoticeIds.includes(e.id)).map((e) => [e.id, e]));
    if (plan.notice) byId.set(plan.notice.id, plan.notice);
    byId.set(plan.exchange.id, plan.exchange);
    return normalizeTranscript([...byId.values()], { allowStreaming: true });
}

const summary = (t: Transcript) => t.map((e) => (e.kind === 'notice' ? `N:${e.lensId}` : `${e.question.text}→${e.reply.status}`));

test('the reported bug: a failed question asked again stays one question', () => {
    let t: Transcript = [];
    let plan = sent(t, 'Explain the meaning of the Mool Mantar');
    t = apply(t, plan);
    const busy = settleReply(plan.exchange.reply, { kind: 'http', code: 'chat_busy' }, 11_000);
    t = apply(t, { ...plan, exchange: { ...plan.exchange, reply: busy }, removeNoticeIds: [] });

    plan = sent(t, '  explain the meaning of the mool mantar ', ctx({ now: 20_000 }));
    assert.equal(plan.isNew, false);
    assert.equal(plan.replacedReplyId, busy.id);
    t = apply(t, plan);
    assert.deepEqual(summary(t), ['explain the meaning of the mool mantar→streaming']);
});

test('history holds only answered exchanges, whole, the last five, before the one being answered', () => {
    const t: Transcript = [
        exchange('failed', { order: 1, reply: { status: 'error', errorCode: 'chat_busy' } }),
        exchange('stopped', { order: 2, reply: { status: 'stopped', text: '' } }),
        exchange('cut', { order: 3, reply: { status: 'interrupted', text: 'Half' } }),
        ...Array.from({ length: 6 }, (_, i) => exchange(`q${i}`, { order: 10 + i, reply: { text: `a${i}` } })),
    ];
    const history = buildHistory(t);
    assert.equal(history.length, MAX_HISTORY_EXCHANGES * 2);
    assert.deepEqual(history.slice(0, 2), [{ role: 'user', text: 'q1' }, { role: 'ai', text: 'a1' }]);
    assert.ok(history.every((turn, i) => turn.role === (i % 2 ? 'ai' : 'user')));

    const before = buildHistory(t, (t[4] as Exchange).id);
    assert.deepEqual(before.map((h) => h.text), ['cut', 'Half', 'q0', 'a0']);

    const long = buildHistory([exchange('x'.repeat(MAX_MESSAGE_CHARS + 5), { reply: { text: 'y'.repeat(MAX_MESSAGE_CHARS + 5) } })]);
    assert.deepEqual(long.map((h) => h.text.length), [MAX_MESSAGE_CHARS, MAX_MESSAGE_CHARS]);
});

test('order never goes backwards, whatever the clock says', () => {
    assert.equal(nextOrder([], 1234.7), 1234);
    assert.equal(nextOrder([exchange('a', { order: 5_000 })], 100), 5_001);
    assert.equal(nextOrder([exchange('a', { order: 5 })], 9_000), 9_000);
});

test('a new question is appended; a blank one is not; nothing is sent over a reply still streaming', () => {
    const plan = sent([], 'What is Seva?');
    assert.equal(plan.isNew, true);
    assert.deepEqual([plan.exchange.question.text, plan.exchange.reply.status, plan.exchange.reply.settings], ['What is Seva?', 'streaming', SIKHAI]);
    assert.equal(plan.notice, undefined, 'the first answer needs no notice');
    assert.equal(planSend([], '   ', ctx()).kind, 'empty');
    assert.equal(planSend([exchange('a', { reply: { status: 'streaming', text: '' } })], 'next', ctx()).kind, 'busy');
});

test('asking again after a failure, a stop or a cut-off answer replaces that attempt; after an answer it is a new question', () => {
    for (const status of ['error', 'stopped', 'interrupted'] as const) {
        const last = exchange('Q', { reply: { status, text: status === 'interrupted' ? 'part' : '' } });
        const plan = sent([last], 'q');
        assert.equal(plan.exchange.id, last.id, status);
        assert.notEqual(plan.exchange.reply.id, last.reply.id);
        assert.equal(plan.exchange.question.text, 'q');
    }
    // Composed and decomposed forms of the same Gurmukhi are the same question.
    const composed = exchange('ਖ਼', { reply: { status: 'error' } });
    assert.equal(sent([composed], 'ਖ਼').isNew, false);

    const answered = exchange('Q');
    assert.equal(sent([answered], 'Q').isNew, true);
    assert.equal(sent([exchange('Q', { reply: { status: 'error' } })], 'Different').isNew, true);
});

test('a full chat takes no new question, but a failed last one can still be asked again', () => {
    const full = Array.from({ length: MAX_EXCHANGES_PER_CHAT }, (_, i) => exchange(`q${i}`, { order: i + 1 }));
    assert.equal(planSend(full, 'one more', ctx()).kind, 'full');
    full[full.length - 1] = exchange('last', { order: MAX_EXCHANGES_PER_CHAT, reply: { status: 'error' } });
    assert.equal(planSend(full, 'last', ctx()).kind, 'send');
});

test('a notice marks a change of lens since the last answer, at the moment of sending', () => {
    let t: Transcript = [exchange('One', { order: 1, reply: { settings: SIKHAI } })];
    const plan = sent(t, 'Two', ctx({ settings: NANAK }));
    assert.equal(plan.notice?.lensId, 'guru-nanak');
    assert.ok(plan.notice!.order < plan.exchange.order);
    t = apply(t, plan);
    assert.deepEqual(summary(t), ['One→done', 'N:guru-nanak', 'Two→streaming']);

    // A failed answer said nothing in any lens: the comparison skips it.
    const withFailure: Transcript = [
        exchange('One', { order: 1, reply: { settings: NANAK } }),
        exchange('Two', { order: 2, reply: { status: 'error', settings: SIKHAI } }),
    ];
    assert.equal(sent(withFailure, 'Three', ctx({ settings: NANAK })).notice, undefined);
    // Old answers without settings can't be compared: no notice.
    assert.equal(sent([exchange('One', { reply: { settings: undefined } })], 'Two', ctx({ settings: NANAK })).notice, undefined);
});

test('regenerating under another lens moves the notice to match, or removes it', () => {
    const base: Transcript = [
        exchange('One', { order: 1, reply: { settings: SIKHAI } }),
        notice('guru-nanak', 2, 'n-old'),
        exchange('Two', { id: 'two', order: 3, reply: { settings: NANAK } }),
    ];
    // Same lens as before: the existing notice is kept, not copied.
    const same = planRetry(base, ctx({ settings: NANAK }))!;
    assert.equal(same.notice?.id, 'n-old');
    assert.deepEqual(same.removeNoticeIds, []);
    // Back to the lens of the answer before: the notice goes.
    const back = planRetry(base, ctx({ settings: SIKHAI }))!;
    assert.equal(back.notice, undefined);
    assert.deepEqual(back.removeNoticeIds, ['n-old']);
    assert.deepEqual(summary(apply(base, back)), ['One→done', 'Two→streaming']);
});

test('retry works on the last exchange only, and not while it streams', () => {
    assert.equal(planRetry([], ctx()), null);
    assert.equal(planRetry([exchange('a', { reply: { status: 'streaming', text: '' } })], ctx()), null);
    const t: Transcript = [exchange('first', { order: 1, reply: { status: 'error' } }), exchange('second', { order: 2 })];
    const plan = planRetry(t, ctx())!;
    assert.equal(plan.exchange.question.text, 'second');
    assert.equal(plan.exchange.question.createdAt, (t[1] as Exchange).question.createdAt, 'the question itself is unchanged');
    assert.equal(plan.replacedReplyId, (t[1] as Exchange).reply.id);
});

test('every way a stream ends settles into a state with something to show', () => {
    const streaming = (text: string) => reply({ status: 'streaming', text });
    const cases: [string, ReturnType<typeof settleReply>, string, string?][] = [
        ['closed with text', settleReply(streaming('Hi'), { kind: 'closed' }, 5), 'done'],
        ['closed empty', settleReply(streaming(''), { kind: 'closed' }, 5), 'error', 'generic'],
        ['http error', settleReply(streaming(''), { kind: 'http', code: 'chat_blocked' }, 5), 'error', 'chat_blocked'],
        ['broke after text', settleReply(streaming('Hi'), { kind: 'failed' }, 5), 'interrupted'],
        ['broke before text', settleReply(streaming(''), { kind: 'failed' }, 5), 'error', 'generic'],
        ['stopped after text', settleReply(streaming('Hi'), { kind: 'aborted' }, 5), 'interrupted'],
        ['stopped before text', settleReply(streaming(''), { kind: 'aborted' }, 5), 'stopped'],
    ];
    for (const [name, r, status, code] of cases) {
        assert.equal(r.status, status, name);
        assert.equal(r.errorCode, code, name);
        assert.equal(r.finishedAt, 5, name);
    }
});

test('a failed response maps to a code the reply can show', () => {
    assert.equal(errorCodeFromResponse(422, { error: '…', code: 'chat_blocked' }), 'chat_blocked');
    assert.equal(errorCodeFromResponse(429, null), 'chat_busy');
    assert.equal(errorCodeFromResponse(502, null), 'generic');
    assert.equal(errorCodeFromResponse(500, { code: 'translate_busy' }), 'generic');
});

test('a slow write from a replaced attempt never overwrites the newer reply', () => {
    const older = reply({ id: 'old', startedAt: 100 });
    const newer = reply({ id: 'new', startedAt: 200 });
    assert.equal(shouldReplaceReply(undefined, older), true);
    assert.equal(shouldReplaceReply(older, reply({ id: 'old', status: 'interrupted', startedAt: 100 })), true);
    assert.equal(shouldReplaceReply(older, newer), true);
    assert.equal(shouldReplaceReply(newer, older), false);
});

test('only the last reply offers Retry or Regenerate, and never while it streams', () => {
    const items = toDisplayItems([
        exchange('a', { order: 1, reply: { status: 'error' } }),
        notice('guru-nanak', 2),
        exchange('b', { order: 3, reply: { status: 'stopped', text: '' } }),
    ]);
    const replies = items.filter((i) => i.kind === 'reply');
    assert.deepEqual(replies.map((r) => [r.isLast, r.canRetry, r.canRegenerate]), [[false, false, false], [true, true, false]]);
    assert.deepEqual(items.map((i) => i.kind), ['question', 'reply', 'notice', 'question', 'reply']);

    const done = toDisplayItems([exchange('a')]).at(-1)!;
    assert.deepEqual(done.kind === 'reply' && [done.canRetry, done.canRegenerate], [false, true]);
    const live = toDisplayItems([exchange('a', { reply: { status: 'streaming', text: 'x' } })]).at(-1)!;
    assert.deepEqual(live.kind === 'reply' && [live.canRetry, live.canRegenerate], [false, false]);
});
